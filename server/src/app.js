import wearableRepository from './database/repositories/wearable_repository.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import routes from './routes/index.js';
import logger from './utils/logger.js';
import { db, userRepository } from './database/index.js';
import { getLLMResponse } from './services/llm_client.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());



// Get all wearable data for a user
app.get('/api/wearable/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const data = await wearableRepository.findById(userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health Check
app.get('/api/health', async (req, res, next) => {
  try {
    const { db: appDb } = req.app.locals;
    const status = await appDb.healthCheck();
    if (status.status === 'ok') {
      return res.json({ status: 'ok', db: status.db });
    }
    return res.status(500).json({ status: 'db_error', error: status.error });
  } catch (err) {
    next(err);
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { user_name, password, name, gender, exercise_level, fitness_goal, injuries } = req.body || {};
    if (!user_name || !password) {
      return res.status(400).json({ error: 'user_name and password required' });
    }

    const existing = await userRepository.findByUsername(user_name);
    if (existing) {
      return res.status(409).json({ error: 'username already taken' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (user_name,password,name,gender,exercise_level,fitness_goal,injuries) VALUES (?,?,?,?,?,?,?)',
      [user_name, hashed, name || '', gender || '', exercise_level || '', fitness_goal || '', injuries || '']
    );

    return res.json({ success: true, user_id: result.insertId });
  } catch (err) {
    logger.error('Register error:', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
});

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

    delete user.password;
    return res.json({ success: true, token, user });
  } catch (err) {
    logger.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
});

app.post('/api/ask', async (req, res) => {
  try {
    const { question, messages } = req.body || {};
    if (!question && !messages) {
      return res.status(400).json({ error: 'Missing "question" (string) or "messages" (array).' });
    }

    const input = messages ?? question;
    const result = await getLLMResponse(input);
    return res.json({ result });
  } catch (err) {
    logger.error('Ask route error:', err?.response?.data || err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unknown error' });
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