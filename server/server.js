// server/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import logger from './src/utils/logger.js';
import { db, userRepository } from './src/database/index.js';
import { initRAG } from './src/services/rag/index.js';
import { getLLMResponse } from './src/services/llm_client.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import RagPromptBuilder from './src/services/prompts/builder.js';


// Use environment SERVER_PORT = 3000 with a safe default
const PORT = process.env.SERVER_PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

async function startServer() {
  try {
  // 1. Initialize Database

  logger.info('🔄 stage 1 - Initializing database connection...');
  await db.initialize();
  logger.info('✅ Database ready');

    //1.5 test database connection and log schema
    try {
      logger.info('stage: 1.5 - testing database connection and prompt builder...');
      const prompt = await new RagPromptBuilder().builder(1);
      // logger.info(`Test RAG prompt for user_id=1: ${prompt}`);
    } catch (err) {
      logger.error('Database build prompt failed:', err?.message || err);
    } 

    // 2. Initialize RAG Engine (embeddings, Chroma, etc.) before starting HTTP server
    try {
      logger.info('🔄 stage 2 - Initializing RAG Engine...');
      await initRAG();
      logger.info('✅ RAG Engine Ready');
    } catch (err) {
      logger.error('Failed to initialize RAG Engine:', err?.message || err);
      // If RAG is critical to operation, rethrow to stop startup. Otherwise you could continue.
      throw err;
    }

    // 3. Start HTTP Server
    const server = app.listen(PORT, () => {
      logger.info(`stage 3 - 🚀 Server running on http://localhost:${PORT}`);
    });

    // 4. Graceful Shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Closing server...');
      server.close(async () => {
        await db.close();
        console.log('Server closed gracefully');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();


app.get('/api/health', async (req, res) => {
  try {
    const status = await db.healthCheck();
    if (status.status === 'ok') {
      res.json({ status: 'ok', db: status.db });
    } else {
      res.status(500).json({ status: 'db_error', error: status.error });
    }
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ status: 'db_error' });
  }
});

// --- authentication routes --------------------------------------------------
// register a new user with hashed password
app.post('/api/register', async (req, res) => {
  try {
    const { user_name, password, name, exercise_level, fitness_goal, injuries } = req.body || {};
    if (!user_name || !password) {
      return res.status(400).json({ error: 'user_name and password required' });
    }
    // simple existence check
    const existing = await userRepository.findByUsername(user_name);
    if (existing) {
      return res.status(409).json({ error: 'username already taken' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (user_name,password,name,exercise_level,fitness_goal,injuries) VALUES (?,?,?,?,?,?)',
      [user_name, hashed, name || '', exercise_level || '', fitness_goal || '', injuries || '']
    );
    res.json({ success: true, user_id: result.insertId });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: err.message || 'server error' });
  }
});

// login route issues JWT token
app.post('/api/login', async (req, res) => {
  try {
    const { user_name, password } = req.body || {};
    if (!user_name || !password) {
      return res.status(400).json({ error: 'user_name and password required' });
    }
    const user = await userRepository.findByUsername(user_name);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { user_id: user.user_id, user_name: user.user_name },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '24h' }
    );
    // don't return password
    delete user.password;
    res.json({ success: true, token, user });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: err.message || 'server error' });
  }
});

// POST /api/ask - send a prompt/messages to the LLM and return the response
app.post('/api/ask', async (req, res) => {
  try {
    const { question, messages } = req.body || {};
    if (!question && !messages) {
      return res.status(400).json({ error: 'Missing "question" (string) or "messages" (array).' });
    }

    // llm_client will normalize inputs (string or messages array)
    const input = messages ?? question;
    const result = await getLLMResponse(input);

    res.json({ result });
  } catch (err) {
    console.error('ask route error:', err?.response?.data || err?.message || err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});

// RAG initialization is performed inside startServer to ensure DB is ready first.
