import 'dotenv/config';

export const databaseConfig = {
  host: process.env.DB_HOST || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
};

export const TABLES = {
  USER: process.env.TABLE_USER || 'users',
  WEARABLE_DATA: process.env.TABLE_WEARABLE || 'wearable_data',
  CONVERSATION_HISTORY: process.env.TABLE_CONVERSATION || 'conversation_history',
};
