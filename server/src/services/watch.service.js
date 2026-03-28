/**
 * Watch Service (Phase 1)
 * Handles rest-feedback generation and session-end persistence
 */
import watchValidationService from './watch_validation.service.js';
import userRepository from '../database/repositories/user_repository.js';
import wearableRepository from '../database/repositories/wearable_repository.js';
import conversationRepository from '../database/repositories/conversation_repository.js';
import ragService from './rag.service.js';
import { getLLMResponse } from './llm_client.js';
import logger from '../utils/logger.js';

const SESSION_CONTEXT_TTL_MS = Number(process.env.WATCH_SESSION_CACHE_TTL_MS || 60 * 60 * 1000);

class WatchService {
    constructor() {
        this.sessionContextCache = new Map();
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

            watchValidationService.logValidation(validation, 'in-session-feedback');
            const preparedData = watchValidationService.prepareForRestFeedback(validation.data);
            const cacheKey = this._getSessionCacheKey(userId, sessionData);

            const sessionContext = await this._getOrBuildSessionContext(userId, cacheKey);
            const {
                profile,
                recentSessions,
                ragAdvice,
                lastAssistantMessage
            } = sessionContext;

            const prompt = this._buildPersonalizedInSessionPrompt({
                metrics: preparedData,
                profile,
                recentSessions,
                ragAdvice,
                lastAssistantMessage
            });

            let suggestion = null;
            try {
                suggestion = await getLLMResponse(prompt);
            } catch (llmError) {
                logger.warn(`LLM query failed for in-session feedback: ${llmError.message}`);
            }

            if (!suggestion || !suggestion.trim()) {
                suggestion = this._generateFallbackRestSuggestion(preparedData, profile, recentSessions);
            }

            if (this._isTooSimilarSuggestion(suggestion, lastAssistantMessage)) {
                suggestion = this._generateDiverseFallbackSuggestion(preparedData, profile);
            }

            suggestion = this._trimToSingleSentence(suggestion);
            this._updateCachedLastAssistantMessage(cacheKey, suggestion);

            return {
                success: true,
                suggestion,
                metrics: {
                    heart_rate: preparedData.heart_rate,
                    current_speed: preparedData.current_speed,
                    exercise_type: preparedData.exercise_type,
                    set_count: preparedData.set_count,
                    sleep_duration: preparedData.sleep_duration ?? null,
                    sleep_quality: preparedData.sleep_quality ?? null,
                    rest_duration: preparedData.rest_duration ?? null
                },
                context: {
                    used_profile: Boolean(profile),
                    recent_sessions_count: Array.isArray(recentSessions) ? recentSessions.length : 0,
                    used_rag: Boolean(ragAdvice)
                }
            };
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
     * End workout session and persist to DB
     * Saves exactly one row with final aggregated metrics
     * @param {number} userId
     * @param {Object} sessionData - Final session metrics with aggregates
     * @returns {Promise<Object>} - { success: boolean, dataId: number, message: string }
     */
    async endSession(userId, sessionData) {
        try {
            // Validate incoming data
            const validation = watchValidationService.validateSessionPayload({
                user_id: userId,
                ...sessionData
            });

            if (!validation.isValid) {
                logger.warn(`Session-end validation failed for user ${userId}`);
                return {
                    success: false,
                    errors: validation.errors,
                    statusCode: 400
                };
            }

            watchValidationService.logValidation(validation, 'session-end');
            const preparedData = watchValidationService.prepareForSessionEnd(validation.data);

            // Persist to database
            const result = await wearableRepository.save(userId, preparedData);

            if (!result.insertId) {
                throw new Error('Failed to insert wearable data');
            }

            logger.info(`✅ Session ended for user ${userId}, data_id: ${result.insertId}`);
            this._clearUserSessionCache(userId);

            return {
                success: true,
                dataId: result.insertId,
                message: 'Session data persisted successfully',
                sessionSummary: {
                    exercise_type: preparedData.exercise_type,
                    set_count: preparedData.set_count,
                    heart_rate: preparedData.heart_rate,
                    current_speed: preparedData.current_speed,
                    rest_duration: preparedData.rest_duration
                }
            };
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
    _buildPersonalizedInSessionPrompt({ metrics, profile, recentSessions, ragAdvice, lastAssistantMessage }) {
        const recentAvgHeartRate = this._average((recentSessions || []).map((row) => Number(row.heart_rate)).filter(Number.isFinite));
        const recentAvgRest = this._average((recentSessions || []).map((row) => Number(row.rest_duration)).filter(Number.isFinite));

        return `You are a real-time watch workout coach. Return exactly one short sentence (max 22 words), direct and actionable.

Current in-session metrics:
- Exercise type: ${metrics.exercise_type}
- Heart rate: ${metrics.heart_rate} bpm
- Current speed: ${metrics.current_speed} km/h
- Sets completed: ${metrics.set_count}
- Rest duration: ${metrics.rest_duration ?? 'unknown'} min
- Sleep duration: ${metrics.sleep_duration ?? 'unknown'} h
- Sleep quality: ${metrics.sleep_quality ?? 'unknown'}

User profile:
- Exercise level: ${profile?.exercise_level || 'unknown'}
- Fitness goal: ${profile?.fitness_goal || 'unknown'}
- Injuries: ${profile?.injuries || 'none reported'}

Recent history trend:
- Recent sessions analyzed: ${(recentSessions || []).length}
- Avg recent heart rate: ${recentAvgHeartRate ?? 'unknown'}
- Avg recent rest duration: ${recentAvgRest ?? 'unknown'}

Retrieved advice context:
${ragAdvice || 'No RAG context available.'}

Avoid repeating this previous assistant feedback:
${lastAssistantMessage || 'none'}

Output only the one-sentence feedback.`;
    }

    /**
     * Rule-based fallback suggestion for rest-feedback
     * @private
     * @param {Object} metrics 
     * @returns {string}
     */
    _generateFallbackRestSuggestion(metrics, profile = null, recentSessions = []) {
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

        return suggestion;
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
            options.unshift('Hold rest a bit longer and restart at a slightly easier pace to keep intensity safe.');
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

        const [profile, recentSessions, lastAssistantMessage] = await Promise.all([
            userRepository.findProfileForCoaching(userId),
            wearableRepository.findRecentByUserId(userId, 5),
            conversationRepository.getLastAssistantMessage(userId)
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
            const ragAdviceArr = await ragService.getAdviceContent(userId, groupedUserData);
            ragAdvice = Array.isArray(ragAdviceArr) ? ragAdviceArr.join('\n') : '';
        } catch (ragError) {
            logger.warn(`RAG lookup failed for in-session feedback user ${userId}: ${ragError.message}`);
        }

        const entry = {
            profile,
            recentSessions,
            ragAdvice,
            lastAssistantMessage,
            createdAt: Date.now(),
            expiresAt: Date.now() + SESSION_CONTEXT_TTL_MS
        };
        this.sessionContextCache.set(cacheKey, entry);
        return entry;
    }

    _updateCachedLastAssistantMessage(cacheKey, message) {
        const cached = this.sessionContextCache.get(cacheKey);
        if (!cached) return;
        cached.lastAssistantMessage = message;
        cached.expiresAt = Date.now() + SESSION_CONTEXT_TTL_MS;
        this.sessionContextCache.set(cacheKey, cached);
    }

    _clearUserSessionCache(userId) {
        const prefix = `${userId}:`;
        for (const key of this.sessionContextCache.keys()) {
            if (key.startsWith(prefix)) {
                this.sessionContextCache.delete(key);
            }
        }
    }
}

export default new WatchService();
