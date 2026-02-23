// src/app.js
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import logger from './utils/logger.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', async (req, res, next) => {
  try {
    // 假設 db 已經在 server.js 初始化並掛載到 app  locals 或 global
    const { db } = req.app.locals; 
    const status = await db.healthCheck();
    res.json({ status: 'ok', db: status.db });
  } catch (err) {
    next(err); // 交給錯誤處理中間件
  }
});

// Routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Global Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;