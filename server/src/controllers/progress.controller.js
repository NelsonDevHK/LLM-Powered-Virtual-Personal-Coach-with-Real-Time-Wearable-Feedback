import progressService from '../services/progress.service.js';
import logger from '../utils/logger.js';

class ProgressController {
    /**
     * GET /api/progress
     * Return current user's streak/pet progress.
     */
    static async getProgress(req, res, next) {
        try {
            const userId = req.user?.user_id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const result = await progressService.getProgress(userId);
            if (!result.success) {
                return res.status(result.statusCode || 400).json({
                    success: false,
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                progress: result.progress
            });
        } catch (error) {
            logger.error(`Progress controller error: ${error.message}`);
            next(error);
        }
    }

    /**
     * PUT /api/progress/weekly-goal
     * Update the user's weekly workout goal.
     */
    static async updateWeeklyGoal(req, res, next) {
        try {
            const userId = req.user?.user_id;
            const weeklyGoal = req.body?.weekly_goal ?? req.body?.weeklyGoal;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const result = await progressService.updateWeeklyGoal(userId, weeklyGoal);
            if (!result.success) {
                return res.status(result.statusCode || 400).json({
                    success: false,
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                message: result.message,
                progress: result.progress
            });
        } catch (error) {
            logger.error(`Update weekly goal controller error: ${error.message}`);
            next(error);
        }
    }
}

export default ProgressController;