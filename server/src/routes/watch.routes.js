/**
 * Watch Routes (Phase 2)
 * Routes for watch app endpoints: in-session-feedback, rest-feedback (alias), and session-end
 */
import { Router } from 'express';
import WatchController from '../controllers/watch.controller.js';
import { authenticateJWT } from '../middleware/authenticateJWT.js';

const router = Router();

/**
 * POST /api/watch/pair-init
 * Generate a short-lived pairing code for logged-in user.
 * Protected: Requires frontend JWT token.
 */
router.post('/pair-init', authenticateJWT, WatchController.pairInit);

/**
 * POST /api/watch/pair-confirm
 * Confirm pairing from watch app and issue watch JWT.
 * Public: uses pairing code + device UUID.
 */
router.post('/pair-confirm', WatchController.pairConfirm);

/**
 * GET /api/watch/pair-status
 * Check whether current user already paired a watch.
 * Protected: Requires frontend JWT token.
 */
router.get('/pair-status', authenticateJWT, WatchController.pairStatus);

/**
 * POST /api/watch/in-session-feedback
 * Generate personalized in-session watch feedback (no DB persistence)
 * Protected: Requires JWT token
 * Body: { heart_rate, current_speed, exercise_type, set_count, sleep_duration, sleep_quality, rest_duration }
 * Response: { success, suggestion, metrics, context }
 */
router.post('/in-session-feedback', authenticateJWT, WatchController.getInSessionFeedback);

/**
 * POST /api/watch/rest-feedback
 * Backward-compatible alias for in-session feedback
 * Protected: Requires JWT token
 * Body: { heart_rate, current_speed, exercise_type, set_count, sleep_duration, sleep_quality, rest_duration }
 * Response: { success, suggestion, metrics, context }
 */
router.post('/rest-feedback', authenticateJWT, WatchController.getRestFeedback);

/**
 * POST /api/watch/session-end
 * End workout session and persist final aggregated metrics to wearable_data table
 * Protected: Requires JWT token
 * Body: { heart_rate, current_speed, exercise_type, set_count, sleep_duration, sleep_quality, rest_duration }
 * Response: { success, dataId, message, sessionSummary }
 */
router.post('/session-end', authenticateJWT, WatchController.endSession);

/**
 * GET /api/watch/health
 * Health check for watch endpoints
 */
router.get('/health', WatchController.health);

export default router;
