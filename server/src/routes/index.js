// src/routes/index.js
import express from 'express';
import ragRoutes from './rag.routes.js';
import llmRoutes from './llm.routes.js';

const router = express.Router();

router.use('/rag', ragRoutes); // 變成 /api/rag/ragAdvice/:userId
router.use('/llm', llmRoutes); // 變成 /api/llm/fullLLM/:userId

export default router;