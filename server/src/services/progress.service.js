import progressRepository from '../database/repositories/progress_repository.js';
import watchValidationService from './watch_validation.service.js';
import logger from '../utils/logger.js';

const MIN_QUALIFYING_WORKOUT_MINUTES = 10;
const MIN_REALISTIC_HEART_RATE = 60;
const MAX_REALISTIC_HEART_RATE = 220;
const BYPASS_SESSION_GATE = String(process.env.BYPASS_SESSION_GATE || '').toLowerCase() === 'true';
const HARDCODE_SESSION_TEST_DATA = String(process.env.HARDCODE_SESSION_TEST_DATA || '').toLowerCase() === 'true';
const SESSION_END_DEDUP_MS = 30 * 1000; // Prevent duplicate session-end within 30 seconds

class ProgressService {
    constructor() {
        this.lastSessionEndTime = new Map(); // Track last session-end request per user
        
        // Auto-cleanup expired dedup entries every 2 minutes
        this.dedupCleanupInterval = setInterval(() => {
            this._cleanupExpiredDedup();
        }, 2 * 60 * 1000);
    }

    /**
     * Cleanup expired dedup entries to prevent memory leak
     * @private
     */
    _cleanupExpiredDedup() {
        let cleaned = 0;
        for (const [userId, timestamp] of this.lastSessionEndTime.entries()) {
            if (Date.now() - timestamp > SESSION_END_DEDUP_MS * 5) {
                this.lastSessionEndTime.delete(userId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.info(`🧹 Session-end dedup cleanup: removed ${cleaned} expired entries`);
        }
    }

    /**
     * Check if session-end request is a duplicate (too soon after last one)
     * @private
     */
    _isDuplicateSessionEnd(userId) {
        const lastTime = this.lastSessionEndTime.get(userId);
        if (!lastTime) return false;
        const timeSinceLastRequest = Date.now() - lastTime;
        return timeSinceLastRequest < SESSION_END_DEDUP_MS;
    }
    async getProgress(userId) {
        try {
            const row = await progressRepository.ensureRow(userId);
            return {
                success: true,
                progress: this._shapeProgress(row)
            };
        } catch (error) {
            logger.error(`Get progress error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                statusCode: 500
            };
        }
    }

    async updateWeeklyGoal(userId, weeklyGoal) {
        try {
            const goal = Number(weeklyGoal);
            if (!Number.isInteger(goal) || goal < 1 || goal > 14) {
                return {
                    success: false,
                    error: 'weekly_goal must be an integer between 1 and 14',
                    statusCode: 400
                };
            }

            await progressRepository.ensureRow(userId);
            const row = await progressRepository.updateWeeklyGoal(userId, goal);

            return {
                success: true,
                progress: this._shapeProgress(row),
                message: 'Weekly goal updated'
            };
        } catch (error) {
            logger.error(`Update weekly goal error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                statusCode: 500
            };
        }
    }

    async recordSessionEnd(userId, sessionData) {
        try {
            logger.info(
                `[session-end] request user=${userId} bypass=${BYPASS_SESSION_GATE} hardcode=${HARDCODE_SESSION_TEST_DATA}`
            );

            // DEDUPLICATION: Reject if same user sent session-end too recently
            if (!BYPASS_SESSION_GATE && this._isDuplicateSessionEnd(userId)) {
                const timeSinceLastRequest = Date.now() - this.lastSessionEndTime.get(userId);
                logger.info(
                    `[session-end] duplicate request ignored user=${userId} timeSinceLastMs=${timeSinceLastRequest}`
                );
                return {
                    success: true,
                    counted: false,
                    reason: 'Another workout session was just submitted. Please wait before submitting again.',
                    progress: await progressRepository.ensureRow(userId).then(row => this._shapeProgress(row)),
                    sessionSummary: { counted: false }
                };
            }

            const validation = watchValidationService.validateSessionPayload({
                user_id: userId,
                ...sessionData
            });

            if (!validation.isValid) {
                logger.warn(`[session-end] validation failed user=${userId} errors=${validation.errors.join(' | ')}`);
                return {
                    success: false,
                    errors: validation.errors,
                    statusCode: 400
                };
            }

            // Record this session-end request time for deduplication
            this.lastSessionEndTime.set(userId, Date.now());

            let payload = watchValidationService.prepareForSessionEnd(validation.data);

            // ===== TESTING ONLY: HARD-CODED SESSION PAYLOAD (START) =====
            // Enable with HARDCODE_SESSION_TEST_DATA=true
            // This keeps normal gate logic active but forces deterministic passing values.
            if (HARDCODE_SESSION_TEST_DATA) {
                payload = {
                    ...payload,
                    heart_rate: 135,
                    set_count: 3,
                    rest_duration: 2,
                    workout_duration_minutes: 15
                };
                logger.info(`[session-end] hardcoded test payload enabled user=${userId}`);
            }
            // ===== TESTING ONLY: HARD-CODED SESSION PAYLOAD (END) =====

            // TEST SWITCH: Set BYPASS_SESSION_GATE=true to disable gating checks temporarily.
            const eligibility = BYPASS_SESSION_GATE
                ? { isQualifying: true, reason: 'BYPASS_SESSION_GATE enabled' }
                : this._assessSessionEligibility(payload);
            const currentRow = await progressRepository.ensureRow(userId);

            if (!eligibility.isQualifying) {
                logger.info(`[session-end] not counted user=${userId} reason="${eligibility.reason}"`);
                return {
                    success: true,
                    counted: false,
                    reason: eligibility.reason,
                    progress: this._shapeProgress(currentRow),
                    sessionSummary: this._buildSessionSummary(payload, eligibility)
                };
            }

            const now = new Date();
            const currentDate = this._toDateOnly(now);
            const lastWorkoutDate = currentRow?.last_workout_date ? this._toDateOnly(currentRow.last_workout_date) : null;

            if (!BYPASS_SESSION_GATE && lastWorkoutDate && this._isSameDay(lastWorkoutDate, currentDate)) {
                logger.info(`[session-end] not counted user=${userId} reason="Workout already recorded for today"`);
                return {
                    success: true,
                    counted: false,
                    reason: 'Workout already recorded for today',
                    progress: this._shapeProgress(currentRow),
                    sessionSummary: this._buildSessionSummary(payload, eligibility)
                };
            }

            let nextStreak = Number(currentRow?.current_streak || 0);
            const weeklyGoal = Number(currentRow?.weekly_goal || 4);
            let feedCount = Number(currentRow?.feed_count || 0);
            let weeksInactive = Number(currentRow?.weeks_inactive || 0);
            let streakResetHappened = false;

            // If we crossed into a new week, finalize last week's streak outcome first.
            if (lastWorkoutDate) {
                const currentWeekStart = this._startOfWeek(currentDate);
                const lastWeekStart = this._startOfWeek(lastWorkoutDate);
                const weekDiff = this._weeksBetween(lastWeekStart, currentWeekStart);

                if (weekDiff > 0) {
                    const previousWeekMetGoal = feedCount >= weeklyGoal;
                    if (!previousWeekMetGoal) {
                        nextStreak = 0;
                        streakResetHappened = true;
                        weeksInactive += weekDiff;
                    } else {
                        weeksInactive = 0;
                    }

                    // New week starts from zero feed progress.
                    feedCount = 0;
                }
            }

            // GATE: Prevent multiple streak increments in the same calendar week
            // Only allow streak increment if feedCount hasn't already reached the goal this week
            const hasAlreadyMetGoalThisWeek = feedCount >= weeklyGoal;

            // Each counted session contributes one feed point this week.
            const previousFeedCount = feedCount;
            feedCount = Math.min(feedCount + 1, weeklyGoal);
            const goalReachedThisSession = !hasAlreadyMetGoalThisWeek && previousFeedCount < weeklyGoal && feedCount === weeklyGoal;

            if (goalReachedThisSession) {
                nextStreak += 1;
                logger.info(`[session-end] streak incremented user=${userId} new_streak=${nextStreak}`);
                weeksInactive = 0;
            } else if (hasAlreadyMetGoalThisWeek) {
                logger.info(`[session-end] streak NOT incremented user=${userId} reason="Goal already met this week" current_streak=${nextStreak}`);
            }

            const petMood = this._derivePetMood({
                streakResetHappened,
                currentStreak: nextStreak,
                feedCount,
                weeklyGoal,
                goalReachedThisSession
            });

            const updatedRow = await progressRepository.updateByUserId(userId, {
                current_streak: nextStreak,
                last_workout_date: this._toDateOnlyString(currentDate),
                feed_count: feedCount,
                pet_mood: petMood,
                weeks_inactive: weeksInactive
            });

            logger.info(
                `[session-end] counted user=${userId} streak=${nextStreak} feed=${feedCount}/${weeklyGoal} mood=${petMood} reset=${streakResetHappened}`
            );

            return {
                success: true,
                counted: true,
                message: 'Workout session recorded',
                progress: this._shapeProgress(updatedRow),
                sessionSummary: this._buildSessionSummary(payload, eligibility)
            };
        } catch (error) {
            logger.error(`Record session end error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                statusCode: 500
            };
        }
    }

    _assessSessionEligibility(payload) {
        const durationMinutes = Number(payload?.workout_duration_minutes);
        const heartRate = Number(payload?.heart_rate);
        const setCount = Number(payload?.set_count);

        if (!Number.isFinite(durationMinutes) || durationMinutes < MIN_QUALIFYING_WORKOUT_MINUTES) {
            return {
                isQualifying: false,
                reason: `Workout duration must be at least ${MIN_QUALIFYING_WORKOUT_MINUTES} minutes to count toward your streak.`
            };
        }

        if (!Number.isFinite(heartRate) || heartRate < MIN_REALISTIC_HEART_RATE || heartRate > MAX_REALISTIC_HEART_RATE) {
            return {
                isQualifying: false,
                reason: 'Heart rate looks unrealistic, so this workout was not counted.'
            };
        }

        if (!Number.isInteger(setCount) || setCount < 1) {
            return {
                isQualifying: false,
                reason: 'At least one completed set is required before the session can count.'
            };
        }

        return {
            isQualifying: true,
            reason: ''
        };
    }

    _derivePetMood({ streakResetHappened, currentStreak, feedCount, weeklyGoal, goalReachedThisSession }) {
        if (streakResetHappened) {
            return 'sad';
        }

        if (goalReachedThisSession || feedCount >= weeklyGoal) {
            return 'happy';
        }

        return currentStreak > 0 ? 'okay' : 'sad';
    }

    _shapeProgress(row) {
        if (!row) {
            return null;
        }

        const currentStreak = Number(row.current_streak || 0);
        const weeklyGoal = Number(row.weekly_goal || 4);
        const feedCount = Number(row.feed_count || 0);
        const weeksInactive = Number(row.weeks_inactive || 0);
        const progressRatio = weeklyGoal > 0 ? Math.min(feedCount / weeklyGoal, 1) : 0;

        return {
            ...row,
            current_streak: currentStreak,
            weekly_goal: weeklyGoal,
            feed_count: feedCount,
            weeks_inactive: weeksInactive,
            progress_ratio: Number(progressRatio.toFixed(2)),
            goal_status: feedCount >= weeklyGoal ? 'goal-met' : currentStreak > 0 ? 'building' : 'inactive'
        };
    }

    _buildSessionSummary(payload, eligibility) {
        return {
            workout_duration_minutes: payload.workout_duration_minutes ?? null,
            heart_rate: payload.heart_rate,
            set_count: payload.set_count,
            rest_duration: payload.rest_duration ?? null,
            counted: Boolean(eligibility.isQualifying)
        };
    }

    _toDateOnly(value) {
        if (typeof value === 'string') {
            const parts = value.split('-').map((part) => Number(part));
            if (parts.length === 3 && parts.every((part) => Number.isInteger(part))) {
                const [year, month, day] = parts;
                return new Date(year, month - 1, day);
            }
        }

        const date = value instanceof Date ? value : new Date(value);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    _toDateOnlyString(value) {
        const date = value instanceof Date ? value : new Date(value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    _daysBetween(startDate, endDate) {
        const start = this._toDateOnly(startDate);
        const end = this._toDateOnly(endDate);
        return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    }

    _startOfWeek(value) {
        const date = this._toDateOnly(value);
        const day = date.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() + diffToMonday);
        return this._toDateOnly(weekStart);
    }

    _weeksBetween(startWeek, endWeek) {
        const start = this._toDateOnly(startWeek);
        const end = this._toDateOnly(endWeek);
        const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        return Math.max(0, Math.floor(days / 7));
    }

    _isSameDay(leftDate, rightDate) {
        return leftDate.getFullYear() === rightDate.getFullYear()
            && leftDate.getMonth() === rightDate.getMonth()
            && leftDate.getDate() === rightDate.getDate();
    }
}

export default new ProgressService();