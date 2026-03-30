// server.js
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import app from './app.js';
import { db } from './database/index.js';
import { initRAG } from './services/rag/index.js';
import { preheatModel } from './services/llm_client.js';

dotenv.config();

const PORT = process.env.SERVER_PORT || 3000;

async function startServer() {
  try {
    // 1. Init Database
    logger.info('🔄 Initializing database...');
    await db.initialize();
    
    // 2. Init RAG Engine
    logger.info('🔄 Initializing RAG Engine...');
    await initRAG();

    // 3. One-shot pre-heat (brief warm window for faster first response)
    logger.info('🔄 One-shot pre-heating Ollama model...');
    await preheatModel();

    // 4. Attach DB to app locals (so routes/controllers can access if needed directly)
    // 但建議透過 Service 層訪問，這裡只是備用
    app.locals.db = db;

    // 5. Start Server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
    });

    // 6. Graceful Shutdown
    const shutdown = async (signal) => {
      logger.info(`⚠️ ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await db.close();
        logger.info('✅ Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();