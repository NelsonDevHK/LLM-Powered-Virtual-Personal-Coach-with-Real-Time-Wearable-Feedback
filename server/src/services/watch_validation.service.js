/**
 * Watch Data Validation Service (Phase 1)
 * Validates and prepares watch session data for REST feedback and set-end persistence
 */
import logger from '../utils/logger.js';

class WatchValidationService {
    /**
     * Validate watch session payload
     * @param {Object} payload - Session data from watch app
     * @returns {Object} - { isValid: boolean, errors: string[], data: Object }
     */
    validateSessionPayload(payload) {
        const errors = [];
        const validatedData = {};

        // Required fields for both rest-feedback and set-end
        if (!payload.user_id || !Number.isInteger(payload.user_id)) {
            errors.push('user_id is required and must be an integer');
        } else {
            validatedData.user_id = payload.user_id;
        }

        if (typeof payload.heart_rate !== 'number' || payload.heart_rate < 0) {
            errors.push('heart_rate is required and must be a non-negative number');
        } else {
            validatedData.heart_rate = Math.round(payload.heart_rate);
        }

        if (payload.heart_rate_history !== undefined) {
            if (!Array.isArray(payload.heart_rate_history)) {
                errors.push('heart_rate_history must be an array of numbers');
            } else {
                const cleanedHistory = payload.heart_rate_history
                    .map((value) => Number(value))
                    .filter((value) => Number.isFinite(value) && value >= 0)
                    .map((value) => Math.round(value));
                validatedData.heart_rate_history = cleanedHistory.slice(-10);
            }
        } else {
            validatedData.heart_rate_history = [];
        }

        if (typeof payload.current_speed !== 'number' || payload.current_speed < 0) {
            errors.push('current_speed is required and must be a non-negative number');
        } else {
            validatedData.current_speed = parseFloat(payload.current_speed).toFixed(2);
        }

        // Exercise type validation (required for set-end, optional for rest-feedback)
        if (payload.exercise_type) {
            // Accept exercise_type case-insensitively and normalize to canonical values
            const typeMap = {
                'strength': 'Strength',
                'hiit': 'HIIT',
                'cardio': 'Cardio',
            };

            const rawType = String(payload.exercise_type || '').trim();
            const normalizedKey = rawType.toLowerCase();
            const mapped = typeMap[normalizedKey];

            if (!mapped) {
                const validExerciseTypes = Object.values(typeMap);
                errors.push(`invalid exercise_type: must be one of ${validExerciseTypes.join(', ')}`);
            } else {
                validatedData.exercise_type = mapped;
            }
        } else {
            validatedData.exercise_type = 'General';
        }

        // Set count (optional, defaults to 0)
        if (payload.set_count !== undefined) {
            if (!Number.isInteger(payload.set_count) || payload.set_count < 0) {
                errors.push('set_count must be a non-negative integer');
            } else {
                validatedData.set_count = payload.set_count;
            }
        } else {
            validatedData.set_count = 0;
        }

        // Sleep metrics (optional for rest-feedback, recommended for set-end)
        if (payload.sleep_duration !== undefined) {
            if (!Number.isInteger(payload.sleep_duration) || payload.sleep_duration < 0) {
                errors.push('sleep_duration must be a non-negative integer (minutes)');
            } else {
                validatedData.sleep_duration = payload.sleep_duration;
            }
        } else {
            validatedData.sleep_duration = null;
        }

        if (payload.sleep_quality !== undefined) {
            if (!Number.isInteger(payload.sleep_quality) || payload.sleep_quality < 1 || payload.sleep_quality > 5) {
                errors.push('sleep_quality must be an integer between 1 and 5');
            } else {
                validatedData.sleep_quality = payload.sleep_quality;
            }
        } else {
            validatedData.sleep_quality = null;
        }

        // Rest duration (optional, accumulated rest time during session)
        if (payload.rest_duration !== undefined) {
            if (!Number.isInteger(payload.rest_duration) || payload.rest_duration < 0) {
                errors.push('rest_duration must be a non-negative integer (minutes)');
            } else {
                validatedData.rest_duration = payload.rest_duration;
            }
        } else {
            validatedData.rest_duration = null;
        }

        if (payload.workout_duration_minutes !== undefined) {
            if (!Number.isInteger(payload.workout_duration_minutes) || payload.workout_duration_minutes < 0) {
                errors.push('workout_duration_minutes must be a non-negative integer (minutes)');
            } else {
                validatedData.workout_duration_minutes = payload.workout_duration_minutes;
            }
        } else {
            validatedData.workout_duration_minutes = null;
        }

        return {
            isValid: errors.length === 0,
            errors,
            data: validatedData
        };
    }

    /**
     * Prepare data for rest-feedback (transient, no persistence)
     * Returns only fields relevant for LLM suggestion generation
     * @param {Object} validatedData 
     * @returns {Object}
     */
    prepareForRestFeedback(validatedData) {
        return {
            user_id: validatedData.user_id,
            heart_rate: validatedData.heart_rate,
            heart_rate_history: validatedData.heart_rate_history,
            current_speed: validatedData.current_speed,
            exercise_type: validatedData.exercise_type,
            set_count: validatedData.set_count,
            sleep_duration: validatedData.sleep_duration,
            rest_duration: validatedData.rest_duration,
            sleep_quality: validatedData.sleep_quality
        };
    }

    /**
    * Prepare data for set-end persistence (writes to DB)
     * @param {Object} validatedData 
     * @returns {Object}
     */
    prepareForSetEnd(validatedData) {
        return {
            heart_rate: validatedData.heart_rate,
            heart_rate_history: validatedData.heart_rate_history,
            current_speed: validatedData.current_speed,
            exercise_type: validatedData.exercise_type,
            set_count: validatedData.set_count,
            sleep_duration: validatedData.sleep_duration,
            sleep_quality: validatedData.sleep_quality,
            rest_duration: validatedData.rest_duration
        };
    }

    /**
     * Prepare data for session-end streak updates
     * @param {Object} validatedData
     * @returns {Object}
     */
    prepareForSessionEnd(validatedData) {
        return {
            heart_rate: validatedData.heart_rate,
            heart_rate_history: validatedData.heart_rate_history,
            current_speed: validatedData.current_speed,
            exercise_type: validatedData.exercise_type,
            set_count: validatedData.set_count,
            sleep_duration: validatedData.sleep_duration,
            sleep_quality: validatedData.sleep_quality,
            rest_duration: validatedData.rest_duration,
            workout_duration_minutes: validatedData.workout_duration_minutes
        };
    }

    /**
     * Log validation results for debugging
     * @param {Object} result 
     * @param {string} context 
     */
    logValidation(result, context = 'watch-data') {
        if (result.isValid) {
            logger.info(`✅ ${context} validation passed`);
        } else {
            logger.warn(`⚠️  ${context} validation failed: ${result.errors.join('; ')}`);
        }
    }
}

export default new WatchValidationService();
