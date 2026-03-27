/**
 * Watch Routes (Phase 1)
 * Routes for watch app endpoints: rest-feedback and session-end
 */
import { Router } from 'express';
import WatchController from '../controllers/watch.controller.js';
import { authenticateJWT } from '../middleware/authenticateJWT.js';

const router = Router();

/**
 * POST /api/watch/rest-feedback
 * Generate rest-phase feedback (LLM-first suggestion, no DB persistence)
 * Protected: Requires JWT token
 * Body: { heart_rate, current_speed, exercise_type, set_count, sleep_duration, sleep_quality, rest_duration }
 * Response: { success, suggestion, metrics }
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
