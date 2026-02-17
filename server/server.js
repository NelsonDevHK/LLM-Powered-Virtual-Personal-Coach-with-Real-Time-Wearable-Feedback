// server/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// ✅ Add .js extension to local imports
import { pool } from './src/config/db.js';
import { initRAG } from './src/services/rag/index.js';
import { getLLMResponse } from './src/services/llm_client.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: rows[0].ok });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'db_error' });
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

// 1. Initialize RAG (Load embeddings, connect to Chroma)
console.log('🔄 Initializing RAG Engine...');
await initRAG();
console.log('✅ RAG Engine Ready');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on ${port}`));
