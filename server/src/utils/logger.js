// server/src/utils/logger.mjs
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------
// FIX FOR ES MODULES: __dirname does not exist in .mjs
// We need to manually calculate the directory name
// ---------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const { combine, timestamp, printf, colorize } = winston.format;

// Define a custom format for the logs
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Create the logger instance
const logger = winston.createLogger({
  // Set the log level. 
  // You can change this via environment variable (e.g., LOG_LEVEL=debug)
  level: process.env.LOG_LEVEL || 'info', 
  
  // Define where the logs go (Transports)
  transports: [
    // 1. Console Transport (Shows in terminal with colors)
    new winston.transports.Console({
      format: combine(
        colorize(), // Adds colors to level (info=blue, error=red)
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    
    // 2. File Transport (Saves errors to a file)
    // This creates a 'logs' folder inside your server directory
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/all_log'),
      level: 'info', // Only log errors to this file
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json() // Save as JSON for easier reading later
      ),
    }),
  ],
});

// Export the logger to be used in other files
export default logger;