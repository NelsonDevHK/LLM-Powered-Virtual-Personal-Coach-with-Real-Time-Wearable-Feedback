/**
 * Watch Controller (Phase 1)
 * Handles HTTP requests for rest-feedback and session-end endpoints
 */
import watchService from '../services/watch.service.js';
import watchPairingService from '../services/watch_pairing.service.js';
import logger from '../utils/logger.js';

class WatchController {
    /**
     * POST /api/watch/pair-init
     * Create a short-lived pairing code for currently authenticated user.
     */
    static async pairInit(req, res, next) {
        try {
            const userId = req.user?.user_id;
            const userName = req.user?.user_name;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const result = watchPairingService.createPairCode(userId, userName);
            logger.info(`Created watch pairing code for user ${userId}`);

            return res.status(200).json({
                success: true,
                pairingCode: result.pairingCode,
                expiresInSeconds: result.expiresInSeconds,
                expiresAt: result.expiresAt
            });
        } catch (error) {
            logger.error(`Pair-init controller error: ${error.message}`);
            next(error);
        }
    }

    /**
     * POST /api/watch/pair-confirm
     * Confirm watch pairing by pairing code and issue watch JWT.
     */
    static async pairConfirm(req, res, next) {
        try {
            const { pairing_code: pairingCode, device_uuid: deviceUuid, device_model: deviceModel, os_version: osVersion, app_version: appVersion } = req.body || {};

            if (!pairingCode || !deviceUuid) {
                return res.status(400).json({
                    success: false,
                    error: 'pairing_code and device_uuid are required'
                });
            }

            const result = watchPairingService.confirmPairing({
                pairingCode,
                deviceUuid,
                deviceModel,
                osVersion,
                appVersion
            });

            if (!result.success) {
                return res.status(result.statusCode || 400).json({
                    success: false,
                    error: result.error
                });
            }

            logger.info(`Watch paired: user ${result.userId}, device ${deviceUuid}`);

            return res.status(200).json({
                success: true,
                token: result.token,
                user_id: result.userId,
                pairing: result.pairing
            });
        } catch (error) {
            logger.error(`Pair-confirm controller error: ${error.message}`);
            next(error);
        }
    }

    /**
     * GET /api/watch/pair-status
     * Return current user's watch pairing status.
     */
    static async pairStatus(req, res, next) {
        try {
            const userId = req.user?.user_id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const status = watchPairingService.getPairStatus(userId);
            return res.status(200).json({
                success: true,
                ...status
            });
        } catch (error) {
            logger.error(`Pair-status controller error: ${error.message}`);
            next(error);
        }
    }

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
