import { Router } from 'express';
import ProgressController from '../controllers/progress.controller.js';
import { authenticateJWT } from '../middleware/authenticateJWT.js';

const router = Router();

/**
 * GET /api/progress
 * Return the current user's streak and pet progress.
 */
router.get('/', authenticateJWT, ProgressController.getProgress);

/**
 * PUT /api/progress/weekly-goal
 * Update the current user's weekly goal.
 */
router.put('/weekly-goal', authenticateJWT, ProgressController.updateWeeklyGoal);

export default router;