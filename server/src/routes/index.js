// src/routes/index.js
import express from 'express';
import watchRoutes from './watch.routes.js';

const router = express.Router();

router.use('/watch', watchRoutes); // Phase 1: /api/watch/rest-feedback, /api/watch/session-end

export default router;