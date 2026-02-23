// src/routes/rag.routes.js
import express from 'express';
import ragController from '../controllers/rag.controller.js';

const router = express.Router();

router.get('/ragAdvice/:userId', ragController.getAdvice);

export default router;