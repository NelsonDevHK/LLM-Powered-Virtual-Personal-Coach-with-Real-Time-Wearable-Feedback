// src/routes/index.js
import express from 'express';
import watchRoutes from './watch.routes.js';
import progressRoutes from './progress.routes.js';

const router = express.Router();

router.use('/watch', watchRoutes); // Watch APIs: feedback, set-end, session-end, and progress
router.use('/progress', progressRoutes); // Progress APIs for dashboard/state sync

export default router;