/**
 * Watch Controller (Phase 1)
 * Handles HTTP requests for rest-feedback and session-end endpoints
 */
import watchService from '../services/watch.service.js';
import logger from '../utils/logger.js';

class WatchController {
    /**
     * POST /api/watch/in-session-feedback
     * Generate personalized in-session feedback without persisting to DB
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     */
    static async getInSessionFeedback(req, res, next) {
        try {
            const userId = req.user?.user_id;
            const sessionData = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            logger.info(`In-session feedback request from user ${userId}`);
            const result = await watchService.generateInSessionFeedback(userId, sessionData);

            if (!result.success) {
                return res.status(result.statusCode || 400).json({
                    success: false,
                    errors: result.errors || [result.error]
                });
            }

            return res.status(200).json({
                success: true,
                suggestion: result.suggestion,
                metrics: result.metrics,
                context: result.context
            });
        } catch (error) {
            logger.error(`In-session feedback controller error: ${error.message}`);
            next(error);
        }
    }

    /**
     * POST /api/watch/rest-feedback
     * Generate rest-phase feedback without persisting to DB
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     */
    static async getRestFeedback(req, res, next) {
        // Backward-compatible alias to the new Phase 2 path.
        return WatchController.getInSessionFeedback(req, res, next);
    }

    /**
     * POST /api/watch/session-end
     * End workout session and persist final metrics to DB
     * Only one row is written per complete session
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     */
    static async endSession(req, res, next) {
        try {
            const userId = req.user?.user_id; // From JWT middleware
            const sessionData = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            logger.info(`Session-end request from user ${userId}`);

            const result = await watchService.endSession(userId, sessionData);

            if (!result.success) {
                return res.status(result.statusCode || 400).json({
                    success: false,
                    errors: result.errors || [result.error]
                });
            }

            return res.status(201).json({
                success: true,
                dataId: result.dataId,
                message: result.message,
                sessionSummary: result.sessionSummary
            });
        } catch (error) {
            logger.error(`Session-end controller error: ${error.message}`);
            next(error);
        }
    }

    /**
     * GET /api/watch/health
     * Health check for watch endpoints
     * @param {Object} req
     * @param {Object} res
     */
    static async health(req, res) {
        return res.status(200).json({
            success: true,
            message: 'Watch endpoints are healthy',
            timestamp: new Date().toISOString()
        });
    }
}

export default WatchController;
