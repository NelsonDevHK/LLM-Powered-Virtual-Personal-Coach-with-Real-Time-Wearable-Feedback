/**
 * Watch Data Validation Service (Phase 1)
 * Validates and prepares watch session data for REST feedback and session-end persistence
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

        // Required fields for both rest-feedback and session-end
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

        if (typeof payload.current_speed !== 'number' || payload.current_speed < 0) {
            errors.push('current_speed is required and must be a non-negative number');
        } else {
            validatedData.current_speed = parseFloat(payload.current_speed).toFixed(2);
        }

        // Exercise type validation (required for session-end, optional for rest-feedback)
        if (payload.exercise_type) {
            const validExerciseTypes = ['Strength', 'HIIT', 'Cardio', 'General'];
            if (!validExerciseTypes.includes(payload.exercise_type)) {
                errors.push(`invalid exercise_type: must be one of ${validExerciseTypes.join(', ')}`);
            } else {
                validatedData.exercise_type = payload.exercise_type;
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

        // Sleep metrics (optional for rest-feedback, recommended for session-end)
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
            current_speed: validatedData.current_speed,
            exercise_type: validatedData.exercise_type,
            set_count: validatedData.set_count,
            rest_duration: validatedData.rest_duration,
            sleep_quality: validatedData.sleep_quality
        };
    }

    /**
     * Prepare data for session-end persistence (writes to DB)
     * @param {Object} validatedData 
     * @returns {Object}
     */
    prepareForSessionEnd(validatedData) {
        return {
            heart_rate: validatedData.heart_rate,
            current_speed: validatedData.current_speed,
            exercise_type: validatedData.exercise_type,
            set_count: validatedData.set_count,
            sleep_duration: validatedData.sleep_duration,
            sleep_quality: validatedData.sleep_quality,
            rest_duration: validatedData.rest_duration
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
