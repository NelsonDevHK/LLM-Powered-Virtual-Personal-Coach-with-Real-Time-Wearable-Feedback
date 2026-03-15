import { authenticateJWT } from './middleware/authenticateJWT.js';
import { getGroupedUserData } from './services/grouped_user_data.js';
import ragService from './services/rag.service.js';
import dbService from './services/db.service.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import routes from './routes/index.js';
import logger from './utils/logger.js';
import { db } from './database/index.js';
import { getLLMResponse } from './services/llm_client.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());



// Get all wearable data for a user
app.get('/api/wearable/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const data = await dbService.findWearableByUserId(userId);
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
    const { user_name, password, name, age, gender, exercise_level, fitness_goal, injuries } = req.body || {};
    if (!user_name || !password) {
      return res.status(400).json({ error: 'user_name and password required' });
    }

    const existing = await dbService.findUserByUsername(user_name);
    if (existing) {
      return res.status(409).json({ error: 'username already taken' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (user_name,password,name,age,gender,exercise_level,fitness_goal,injuries) VALUES (?,?,?,?,?,?,?,?)',
      [user_name, hashed, name || '', age || null, gender || '', exercise_level || '', fitness_goal || '', injuries || '']
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

    const user = await dbService.findUserByUsername(user_name);
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

app.post('/api/ask', authenticateJWT, async (req, res) => {
  try {
    const { question, messages } = req.body || {};
    if (!question && !messages) {
      return res.status(400).json({ error: 'Missing "question" (string) or "messages" (array).' });
    }

    // Get user_id from JWT
    const user_id = req.user.user_id;
    // Fetch grouped user data
    const grouped = await getGroupedUserData(user_id);

    // Fetch conversation history for this user
    const conversationHistory = await dbService.getConversationHistory(user_id);
    grouped.conversation_history = conversationHistory || [];

    // Query RAG for relevant advice, passing groupedUserData (with history) for context-aware retrieval
    const userMsg = Array.isArray(messages) && messages.length > 0
      ? messages[messages.length - 1].content
      : (question || '');
    const ragAdviceArr = await ragService.getAdviceContent(user_id, grouped);
    const ragAdvice = ragAdviceArr && ragAdviceArr.length > 0 ? ragAdviceArr.join('\n') : '';

    // Format context for LLM
    const context = `User: ${grouped.gender}, Age group: ${grouped.age_group}, Level: ${grouped.exercise_level}, Wearable: ${JSON.stringify(grouped.wearable_data)}\nRelevant advice: ${ragAdvice}`;
    // Prepend context to prompt/messages
    let input;
    if (Array.isArray(messages)) {
      input = [
        { role: 'system', content: context },
        ...messages
      ];
    } else {
      input = `${context}\n${question}`;
    }
    logger.info('LLM input context:', JSON.stringify(input, null, 2));
    const result = await getLLMResponse(input);

    // Save the conversation message to history
    await dbService.saveChatMessage(user_id, {
      question: question || userMsg,
      answer: result,
      timestamp: new Date().toISOString(),
    });

    return res.json({ result });
  } catch (err) {
    logger.error('Ask route error:', err?.response?.data || err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});


// Get grouped user and wearable data for a user (testing endpoint)
app.get('/api/grouped-user-data/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const grouped = await getGroupedUserData(userId);
    res.json({ success: true, data: grouped });
  } catch (err) {
    logger.error('Grouped user data error:', err);
    res.status(500).json({ success: false, error: err.message });
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