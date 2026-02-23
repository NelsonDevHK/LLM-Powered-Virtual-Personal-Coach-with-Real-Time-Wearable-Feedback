// db.config.js (or wherever this lives)

import mysql from 'mysql2/promise';

// We assume .env is already loaded by server.js via `import 'dotenv/config';`

export const databaseConfig = {
  host: process.env.DB_HOST || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
};

export const TABLES = {
  USER: 'users',
  WEARABLE_DATA: 'wearable_data',
  CONVERSATION_HISTORY: 'conversation_history',
};
