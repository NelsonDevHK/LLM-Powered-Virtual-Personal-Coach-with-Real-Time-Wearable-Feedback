/**
 * Watch Service (Phase 1)
 * Handles rest-feedback generation and set-end persistence
 */
import watchValidationService from './watch_validation.service.js';
import userRepository from '../database/repositories/user_repository.js';
import wearableRepository from '../database/repositories/wearable_repository.js';
import ragService from './rag.service.js';
import { getLLMResponse } from './llm_client.js';
import llmGateService from './llm_gate.service.js';
import progressService from './progress.service.js';
import logger from '../utils/logger.js';

const SESSION_CONTEXT_TTL_MS = Number(process.env.WATCH_SESSION_CACHE_TTL_MS || 60 * 60 * 1000);
const FEEDBACK_DEDUP_MS = 3000; // Prevent duplicate requests within 3 seconds

class WatchService {
    constructor() {
        this.sessionContextCache = new Map();
        this.pendingFeedbackRequests = new Map(); // Track in-flight requests for deduplication
        this.lastFeedbackTime = new Map(); // Track when last feedback was sent per session
        
        // Auto-cleanup expired cache entries every 30 seconds
        this.cacheCleanupInterval = setInterval(() => {
            this._cleanupExpiredCache();
        }, 30 * 1000);
    }

    /**
     * Cleanup expired cache entries to prevent memory leak
     * @private
     */
    _cleanupExpiredCache() {
        let cleaned = 0;
        for (const [key, entry] of this.sessionContextCache.entries()) {
            if (!this._isCacheEntryValid(entry)) {
                this.sessionContextCache.delete(key);
                this.pendingFeedbackRequests.delete(key);
                this.lastFeedbackTime.delete(key);
                cleaned++;
            }
        }
        // Keep dedup map bounded even if a session never reaches set-end.
        for (const [key, ts] of this.lastFeedbackTime.entries()) {
            if (Date.now() - ts > FEEDBACK_DEDUP_MS * 10) {
                this.lastFeedbackTime.delete(key);
            }
        }
        if (cleaned > 0) {
            logger.info(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
        }
    }

    /**
     * Check if duplicate feedback request (too soon)
     * @private
     */
    _isDuplicateRequest(cacheKey) {
        const lastTime = this.lastFeedbackTime.get(cacheKey);
        if (!lastTime) return false;
        return Date.now() - lastTime < FEEDBACK_DEDUP_MS;
    }

    /**
     * Generate personalized in-session watch feedback.
     * Phase 2 flow: profile + recent wearable history + RAG + LLM + anti-repetition guard.
     * @param {number} userId
     * @param {Object} sessionData
     * @returns {Promise<Object>}
     */
    async generateInSessionFeedback(userId, sessionData) {
        try {
            const validation = watchValidationService.validateSessionPayload({
                user_id: userId,
                ...sessionData
            });

            if (!validation.isValid) {
                logger.warn(`In-session feedback validation failed for user ${userId}`);
                return {
                    success: false,
                    errors: validation.errors,
                    statusCode: 400
                };
            }

            return llmGateService.runExclusive(userId, 'watch-feedback', async () => {
                watchValidationService.logValidation(validation, 'in-session-feedback');
                const preparedData = watchValidationService.prepareForRestFeedback(validation.data);
                const cacheKey = this._getSessionCacheKey(userId, sessionData);

                // DEDUPLICATION: Reject if same user/session sent feedback too recently
                if (this._isDuplicateRequest(cacheKey)) {
                    logger.warn(`⏱️ Duplicate feedback request (too soon) for ${cacheKey}, rejecting`);
                    return {
                        success: false,
                        error: 'Too many feedback requests. Wait a moment.',
                        statusCode: 429
                    };
                }

                // CHECK FOR PENDING REQUEST: If already processing, reuse that promise
                if (this.pendingFeedbackRequests.has(cacheKey)) {
                    logger.info(`⏳ Reusing pending feedback for ${cacheKey}`);
                    return this.pendingFeedbackRequests.get(cacheKey);
                }

                // Mark as pending to prevent duplicate processing
                const feedbackPromise = this._generateFeedbackInternal(userId, sessionData, cacheKey, preparedData);
                this.pendingFeedbackRequests.set(cacheKey, feedbackPromise);

                // Await and clean up pending marker
                let result;
                try {
                    result = await feedbackPromise;
                } finally {
                    // Always clear pending marker, including when errors occur.
                    this.pendingFeedbackRequests.delete(cacheKey);
                }

                // Record timestamp for deduplication
                this.lastFeedbackTime.set(cacheKey, Date.now());

                return result;
            });
        } catch (error) {
            logger.error(`In-session feedback generation error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                statusCode: 500
            };
        }
    }

    /**
     * Internal method to generate feedback (separated for deduplication)
     * @private
     */
    async _generateFeedbackInternal(userId, sessionData, cacheKey, preparedData) {
        const sessionContext = await this._getOrBuildSessionContext(userId, cacheKey);
        const {
            profile,
            recentSessions,
            ragAdvice
        } = sessionContext;

        const hrAnalysis = this._analyzeHeartRate(preparedData, profile);

        const prompt = this._buildPersonalizedInSessionPrompt({
            metrics: preparedData,
            profile,
            recentSessions,
            ragAdvice,
            hrAnalysis
        });

        let suggestion = null;
        try {
            suggestion = await getLLMResponse(prompt);
        } catch (llmError) {
            logger.warn(`LLM query failed for in-session feedback: ${llmError.message}`);
        }

        if (!suggestion || !suggestion.trim()) {
            suggestion = this._generateFallbackRestSuggestion(preparedData, profile, recentSessions, hrAnalysis);
        }

        suggestion = this._enforceSpecificFeedback(suggestion, hrAnalysis, preparedData, profile);
        suggestion = this._trimToSingleSentence(suggestion);

        return {
            success: true,
            suggestion,
            metrics: {
                heart_rate: preparedData.heart_rate,
                exercise_type: preparedData.exercise_type,
                set_count: preparedData.set_count,
                sleep_duration: preparedData.sleep_duration ?? null,
                sleep_quality: preparedData.sleep_quality ?? null,
                rest_duration: preparedData.rest_duration ?? null
            },
            context: {
                used_profile: Boolean(profile),
                recent_sessions_count: Array.isArray(recentSessions) ? recentSessions.length : 0,
                used_rag: Boolean(ragAdvice),
                hr_trend: hrAnalysis.trend,
                hr_zone_status: hrAnalysis.zoneStatus,
                training_action: hrAnalysis.action
            }
        };
    }

    /**
     * Generate rest-feedback suggestion (transient, no DB persistence)
     * Uses LLM-first approach with fallback to rule-based suggestions
     * @param {number} userId
     * @param {Object} sessionData - Current session metrics
     * @returns {Promise<Object>} - { success: boolean, suggestion: string, metrics: Object }
     */
    async generateRestFeedback(userId, sessionData) {
        // Phase 2: keep old endpoint as a compatibility alias.
        return this.generateInSessionFeedback(userId, sessionData);
    }

    /**
     * Clean up resources on service shutdown
     */
    destroy() {
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            logger.info('🛑 Watch service cleanup interval stopped');
        }
    }

    /**
    * End set and persist to DB
     * Saves exactly one row with final aggregated metrics
     * @param {number} userId
    * @param {Object} sessionData - Final set metrics with aggregates
     * @returns {Promise<Object>} - { success: boolean, dataId: number, message: string }
     */
    async endSet(userId, sessionData) {
        try {
            // Validate incoming data
            const validation = watchValidationService.validateSessionPayload({
                user_id: userId,
                ...sessionData
            });

            if (!validation.isValid) {
                logger.warn(`Set-end validation failed for user ${userId}`);
                return {
                    success: false,
                    errors: validation.errors,
                    statusCode: 400
                };
            }

            watchValidationService.logValidation(validation, 'set-end');
            const preparedData = watchValidationService.prepareForSetEnd(validation.data);

            // Persist to database
            const result = await wearableRepository.save(userId, preparedData);

            if (!result.insertId) {
                throw new Error('Failed to insert wearable data');
            }

            logger.info(`✅ Set ended for user ${userId}, data_id: ${result.insertId}`);
            this._clearUserSessionCache(userId);

            return {
                success: true,
                dataId: result.insertId,
                message: 'Set data persisted successfully',
                sessionSummary: {
                    exercise_type: preparedData.exercise_type,
                    set_count: preparedData.set_count,
                    heart_rate: preparedData.heart_rate,
                    current_speed: preparedData.current_speed,
                    rest_duration: preparedData.rest_duration
                }
            };
        } catch (error) {
            logger.error(`Set-end error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                statusCode: 500
            };
        }
    }

    /**
     * End workout session and update streak / pet progress.
     * @param {number} userId
     * @param {Object} sessionData
     * @returns {Promise<Object>}
     */
    async endSession(userId, sessionData) {
        try {
            const result = await progressService.recordSessionEnd(userId, sessionData);

            if (result.success && result.counted) {
                this._clearUserSessionCache(userId);
            }

            return result;
        } catch (error) {
            logger.error(`Session-end error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                statusCode: 500
            };
        }
    }

    /**
     * Build LLM prompt for rest-feedback generation
     * @private
     * @param {Object} metrics 
     * @returns {string}
     */
    _buildPersonalizedInSessionPrompt({ metrics, profile, recentSessions, ragAdvice, hrAnalysis }) {
        const recentAvgHeartRate = this._average((recentSessions || []).map((row) => Number(row.heart_rate)).filter(Number.isFinite));
        const recentAvgRest = this._average((recentSessions || []).map((row) => Number(row.rest_duration)).filter(Number.isFinite));
        const inSessionHrHistory = Array.isArray(metrics?.heart_rate_history) ? metrics.heart_rate_history : [];

        return `You are a real-time watch workout coach. Return exactly one short sentence (max 50 words), direct and actionable.

Current in-session metrics:
- Exercise type: ${metrics.exercise_type}
- Heart rate: ${metrics.heart_rate} bpm
- Sets completed: ${metrics.set_count}
- Rest duration: ${metrics.rest_duration ?? 'unknown'} min
- Sleep duration: ${metrics.sleep_duration ?? 'unknown'} min
- Sleep quality: ${metrics.sleep_quality ?? 'unknown'}

User profile:
- Exercise level: ${profile?.exercise_level || 'unknown'}
- Fitness goal: ${profile?.fitness_goal || 'unknown'}
- Injuries: ${profile?.injuries || 'none reported'}

Recent history trend:
- Recent sessions analyzed: ${(recentSessions || []).length}
- Avg recent heart rate: ${recentAvgHeartRate ?? 'unknown'}
- Avg recent rest duration: ${recentAvgRest ?? 'unknown'}

Current workout HR history (last 10 readings):
- HR readings: ${inSessionHrHistory.length > 0 ? inSessionHrHistory.join(' → ') : 'no recent readings available'}

Computed HR analysis (must use this):
- HR trend: ${hrAnalysis.trend} (${hrAnalysis.deltaBpm >= 0 ? '+' : ''}${hrAnalysis.deltaBpm} bpm)
- Target HR range: ${hrAnalysis.targetLow}-${hrAnalysis.targetHigh} bpm
- Zone status: ${hrAnalysis.zoneStatus}
- Required training action: ${hrAnalysis.action}

Retrieved advice context:
${ragAdvice || 'No RAG context available.'}

Rules:
- Explicitly mention HR trend, zone status, and action.
- Action must be one of: DELOAD, INCREASE_VOLUME, MAINTAIN.
- If zone is above and trend is increasing, choose DELOAD.
- If zone is below and trend is decreasing or stable, choose INCREASE_VOLUME.
- Otherwise choose MAINTAIN.
- Keep the sentence concrete and include at least one numeric value.

Output only the one-sentence feedback.`;
    }

    /**
     * Rule-based fallback suggestion for rest-feedback
     * @private
     * @param {Object} metrics 
     * @returns {string}
     */
    _generateFallbackRestSuggestion(metrics, profile = null, recentSessions = [], hrAnalysis = null) {
        let suggestion = 'Keep up the great work! ';
        const exerciseLevel = profile?.exercise_level || 'Unknown';
        const fitnessGoal = profile?.fitness_goal || null;

        // HR-based feedback
        const elevatedThreshold = exerciseLevel === 'Beginner' ? 145 : 155;
        if (metrics.heart_rate > elevatedThreshold) {
            suggestion += 'Your heart rate is elevated—take deep breaths to recover. ';
        } else if (metrics.heart_rate < 80 && metrics.exercise_type !== 'Strength') {
            suggestion += 'You\'re recovering well. ';
        }

        // Set-based feedback
        if (metrics.set_count > 0) {
            suggestion += `${metrics.set_count} set${metrics.set_count > 1 ? 's' : ''} down, great effort! `;
        }

        if (Array.isArray(recentSessions) && recentSessions.length > 0) {
            const latest = recentSessions[0];
            if (Number.isFinite(Number(latest?.heart_rate)) && Number(latest.heart_rate) > 0) {
                if (metrics.heart_rate > Number(latest.heart_rate) + 12) {
                    suggestion += 'Today is running hotter than your recent baseline, so extend rest slightly. ';
                }
            }
        }

        // Sleep quality feedback
        if (metrics.sleep_quality && metrics.sleep_quality < 3) {
            suggestion += 'Rest well today to recover faster. ';
        }

        if (fitnessGoal) {
            suggestion += `Stay aligned with your ${fitnessGoal} goal.`;
        } else {
            suggestion += 'You\'re ready for the next set!';
        }

        if (hrAnalysis) {
            suggestion = `HR is ${hrAnalysis.trend} (${hrAnalysis.deltaBpm >= 0 ? '+' : ''}${hrAnalysis.deltaBpm} bpm), ${hrAnalysis.zoneStatus} range ${hrAnalysis.targetLow}-${hrAnalysis.targetHigh}; action ${hrAnalysis.action}.`;
        }

        return suggestion;
    }

    _enforceSpecificFeedback(suggestion, hrAnalysis, metrics, profile = null) {
        const text = String(suggestion || '').trim();
        const lower = text.toLowerCase();
        const hasTrend = /increasing|decreasing|stable/.test(lower);
        const hasZone = /above|below|within/.test(lower);
        const hasAction = /deload|increase_volume|increase volume|maintain/.test(lower);

        if (hasTrend && hasZone && hasAction) {
            return text;
        }

        const goalText = profile?.fitness_goal ? ` for your ${profile.fitness_goal} goal` : '';
        return `HR is ${hrAnalysis.trend} (${hrAnalysis.deltaBpm >= 0 ? '+' : ''}${hrAnalysis.deltaBpm} bpm), ${hrAnalysis.zoneStatus} ${hrAnalysis.targetLow}-${hrAnalysis.targetHigh}; ${hrAnalysis.action === 'INCREASE_VOLUME' ? 'increase volume' : hrAnalysis.action.toLowerCase()}${goalText}.`;
    }

    _analyzeHeartRate(metrics, profile = null) {
        const history = Array.isArray(metrics?.heart_rate_history)
            ? metrics.heart_rate_history.map((v) => Number(v)).filter(Number.isFinite)
            : [];
        const currentHr = Number(metrics?.heart_rate);
        const firstHr = history.length > 0 ? history[0] : currentHr;
        const lastHr = history.length > 0 ? history[history.length - 1] : currentHr;
        const deltaRaw = Number.isFinite(lastHr - firstHr) ? (lastHr - firstHr) : 0;
        const deltaBpm = Math.round(deltaRaw);

        let trend = 'stable';
        if (deltaBpm >= 5) trend = 'increasing';
        if (deltaBpm <= -5) trend = 'decreasing';

        const age = Number(profile?.age);
        const level = String(profile?.exercise_level || 'Unknown').toLowerCase();
        const estimatedMaxHr = Number.isFinite(age) && age > 0 ? (220 - age) : 190;

        let lowPct = 0.65;
        let highPct = 0.8;
        if (level === 'beginner') {
            lowPct = 0.6;
            highPct = 0.75;
        } else if (level === 'advanced') {
            lowPct = 0.7;
            highPct = 0.85;
        }

        const targetLow = Math.round(estimatedMaxHr * lowPct);
        const targetHigh = Math.round(estimatedMaxHr * highPct);

        let zoneStatus = 'within';
        if (Number.isFinite(currentHr) && currentHr < targetLow) zoneStatus = 'below';
        if (Number.isFinite(currentHr) && currentHr > targetHigh) zoneStatus = 'above';

        let action = 'MAINTAIN';
        if (zoneStatus === 'above' && trend === 'increasing') {
            action = 'DELOAD';
        } else if (zoneStatus === 'below' && (trend === 'decreasing' || trend === 'stable')) {
            action = 'INCREASE_VOLUME';
        }

        return {
            currentHr,
            deltaBpm,
            trend,
            targetLow,
            targetHigh,
            zoneStatus,
            action
        };
    }

    _generateDiverseFallbackSuggestion(metrics, profile) {
        const options = [
            'Take two slow breaths and restart when your form feels stable.',
            'Sip water now and begin the next set only when your breathing is steady.',
            'Keep your posture tall, recover for a few more seconds, then resume with control.'
        ];

        if ((profile?.injuries || '').trim()) {
            options.unshift('Prioritize joint-safe form and resume only when movement feels pain-free and controlled.');
        }

        if (Number(metrics.heart_rate) > 155) {
            options.unshift('Hold rest a bit longer and restart with lighter intensity to keep effort safe.');
        }

        return options[Math.floor(Math.random() * options.length)];
    }

    _isTooSimilarSuggestion(current, previous) {
        if (!current || !previous) return false;
        const a = this._normalizeText(current);
        const b = this._normalizeText(previous);
        if (!a || !b) return false;
        if (a === b) return true;

        const aWords = new Set(a.split(' ').filter(Boolean));
        const bWords = new Set(b.split(' ').filter(Boolean));
        const intersection = [...aWords].filter((w) => bWords.has(w)).length;
        const union = new Set([...aWords, ...bWords]).size;
        const similarity = union > 0 ? intersection / union : 0;
        return similarity >= 0.8;
    }

    _normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _trimToSingleSentence(text) {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (!clean) return 'Take a short controlled rest and continue when your breathing is steady.';
        const parts = clean.match(/[^.!?]+[.!?]?/g) || [clean];
        const first = parts[0].trim();
        const words = first.split(' ');
        return words.length <= 22 ? first : `${words.slice(0, 22).join(' ')}.`;
    }

    _toAgeGroup(age) {
        const n = Number(age);
        if (!Number.isFinite(n)) return 'Unknown';
        if (n >= 13 && n <= 19) return 'Teen';
        if (n >= 20 && n <= 34) return 'Young adult';
        if (n >= 35 && n <= 59) return 'Mid adult';
        if (n >= 60) return 'Older adult';
        return 'Unknown';
    }

    _average(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        const sum = values.reduce((acc, num) => acc + num, 0);
        return Number((sum / values.length).toFixed(1));
    }

    _getSessionCacheKey(userId, sessionData = {}) {
        const sessionId = sessionData?.workout_session_id
            || sessionData?.session_id
            || sessionData?.session_key
            || 'default';
        return `${userId}:${sessionId}`;
    }

    _isCacheEntryValid(entry) {
        return Boolean(entry && entry.expiresAt && entry.expiresAt > Date.now());
    }

    async _getOrBuildSessionContext(userId, cacheKey) {
        const cached = this.sessionContextCache.get(cacheKey);
        if (this._isCacheEntryValid(cached)) {
            return cached;
        }

        const [profile, recentSessions] = await Promise.all([
            userRepository.findProfileForCoaching(userId),
            wearableRepository.findRecentByUserId(userId, 5)
        ]);

        const groupedUserData = {
            user_id: userId,
            gender: profile?.gender || 'Unknown',
            age_group: this._toAgeGroup(profile?.age),
            exercise_level: profile?.exercise_level || 'Unknown',
            fitness_goal: profile?.fitness_goal || null,
            injuries: profile?.injuries || null,
            wearable_data: recentSessions || []
        };

        let ragAdvice = '';
        try {
            const ragAdviceArr = await ragService.getAdviceContent(userId, groupedUserData, { useGate: false });
            ragAdvice = Array.isArray(ragAdviceArr) ? ragAdviceArr.join('\n') : '';
        } catch (ragError) {
            logger.warn(`RAG lookup failed for in-session feedback user ${userId}: ${ragError.message}`);
        }

        const entry = {
            profile,
            recentSessions,
            ragAdvice,
            createdAt: Date.now(),
            expiresAt: Date.now() + SESSION_CONTEXT_TTL_MS
        };
        this.sessionContextCache.set(cacheKey, entry);
        return entry;
    }

    _clearUserSessionCache(userId) {
        const prefix = `${userId}:`;
        let cleared = 0;
        for (const key of this.sessionContextCache.keys()) {
            if (key.startsWith(prefix)) {
                this.sessionContextCache.delete(key);
                this.lastFeedbackTime.delete(key);
                this.pendingFeedbackRequests.delete(key);
                cleared++;
            }
        }
        if (cleared > 0) {
            logger.info(`✅ Cleared ${cleared} cache entries for user ${userId}`);
        }
    }
}

export default new WatchService();
