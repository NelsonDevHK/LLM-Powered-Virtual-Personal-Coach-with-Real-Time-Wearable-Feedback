// src/routes/index.js
import express from 'express';
import ragRoutes from './rag.routes.js';
import llmRoutes from './llm.routes.js';
import watchRoutes from './watch.routes.js';

const router = express.Router();

router.use('/rag', ragRoutes); // 變成 /api/rag/ragAdvice/:userId
router.use('/llm', llmRoutes); // 變成 /api/llm/fullLLM/:userId
router.use('/watch', watchRoutes); // Phase 1: /api/watch/rest-feedback, /api/watch/session-end

export default router;