// src/routes/llm.routes.js
import express from 'express';
import llmController from '../controllers/llm.controller.js';

const router = express.Router();

router.get('/fullLLM/:userId', llmController.getResponse);

export default router;