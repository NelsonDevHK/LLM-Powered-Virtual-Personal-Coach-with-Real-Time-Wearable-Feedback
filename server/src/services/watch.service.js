/**
 * Watch Service (Phase 1)
 * Handles rest-feedback generation and session-end persistence
 */
import watchValidationService from './watch_validation.service.js';
import wearableRepository from '../database/repositories/wearable_repository.js';
import llmService from './llm.service.js';
import logger from '../utils/logger.js';

class WatchService {
    /**
     * Generate rest-feedback suggestion (transient, no DB persistence)
     * Uses LLM-first approach with fallback to rule-based suggestions
     * @param {number} userId
     * @param {Object} sessionData - Current session metrics
     * @returns {Promise<Object>} - { success: boolean, suggestion: string, metrics: Object }
     */
    async generateRestFeedback(userId, sessionData) {
        try {
            // Validate incoming data
            const validation = watchValidationService.validateSessionPayload({
                user_id: userId,
                ...sessionData
            });

            if (!validation.isValid) {
                logger.warn(`Rest-feedback validation failed for user ${userId}`);
                return {
                    success: false,
                    errors: validation.errors,
                    statusCode: 400
                };
            }

            watchValidationService.logValidation(validation, 'rest-feedback');
            const preparedData = watchValidationService.prepareForRestFeedback(validation.data);

            // Build LLM prompt from session metrics
            const prompt = this._buildRestFeedbackPrompt(preparedData);

            // Try LLM-first approach
            let suggestion = null;
            try {
                const llmResponse = await llmService.query(prompt);
                suggestion = llmResponse?.response || null;
            } catch (llmError) {
                logger.warn(`LLM query failed for rest-feedback: ${llmError.message}`);
                // Fall through to rule-based fallback
            }

            // If LLM failed or returned empty, use rule-based fallback
            if (!suggestion) {
                suggestion = this._generateFallbackRestSuggestion(preparedData);
                logger.info(`Using fallback suggestion for rest-feedback (user: ${userId})`);
            }

            return {
                success: true,
                suggestion,
                metrics: {
                    heart_rate: preparedData.heart_rate,
                    current_speed: preparedData.current_speed,
                    exercise_type: preparedData.exercise_type,
                    set_count: preparedData.set_count
                }
            };
        } catch (error) {
            logger.error(`Rest-feedback generation error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                statusCode: 500
            };
        }
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
    _buildRestFeedbackPrompt(metrics) {
        const prompt = `Based on the following workout metrics during a rest phase, provide brief, actionable rest-phase feedback (1-2 sentences):

Exercise Type: ${metrics.exercise_type}
Current Heart Rate: ${metrics.heart_rate} bpm
Current Speed: ${metrics.current_speed} km/h
Sets Completed: ${metrics.set_count}
Rest Duration So Far: ${metrics.rest_duration} minutes
Previous Night Sleep Quality: ${metrics.sleep_quality ? `${metrics.sleep_quality}/5` : 'Not provided'}

Provide encouragement and recovery tips tailored to these metrics.`;
        return prompt;
    }

    /**
     * Rule-based fallback suggestion for rest-feedback
     * @private
     * @param {Object} metrics 
     * @returns {string}
     */
    _generateFallbackRestSuggestion(metrics) {
        let suggestion = 'Keep up the great work! ';

        // HR-based feedback
        if (metrics.heart_rate > 150) {
            suggestion += 'Your heart rate is elevated—take deep breaths to recover. ';
        } else if (metrics.heart_rate < 80 && metrics.exercise_type !== 'Strength') {
            suggestion += 'You\'re recovering well. ';
        }

        // Set-based feedback
        if (metrics.set_count > 0) {
            suggestion += `${metrics.set_count} set${metrics.set_count > 1 ? 's' : ''} down, great effort! `;
        }

        // Sleep quality feedback
        if (metrics.sleep_quality && metrics.sleep_quality < 3) {
            suggestion += 'Rest well today to recovery faster.';
        } else {
            suggestion += 'You\'re ready for the next set!';
        }

        return suggestion;
    }
}

export default new WatchService();
