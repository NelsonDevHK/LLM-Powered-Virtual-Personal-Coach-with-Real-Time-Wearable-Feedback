import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure we load the repository root .env even when the process cwd is `server/`
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRootEnvPath = path.resolve(__dirname, '../../..', '.env');
dotenv.config({ path: repoRootEnvPath });

export const databaseConfig = {
  host: process.env.DB_HOST || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  // provide safe defaults and explicit radix to avoid NaN when env vars are missing
  port: parseInt(process.env.DB_PORT || '3306', 10),
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
};

// Table names (from your Python config)
export const TABLES = {
  USER: 'users',
  WEARABLE_DATA: 'wearable_data',
  CONVERSATION_HISTORY: 'conversation_history',
};
