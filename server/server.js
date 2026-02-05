// server/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool } = require('./db');

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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on ${port}`));
