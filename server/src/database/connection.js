import mysql from 'mysql2/promise';
import { databaseConfig } from '../config/db.config.js';
import logger from '../utils/logger.js';

class DatabaseConnection {
  constructor() {
    this.pool = null;
  }

  /**
   * Initialize connection pool (call once at startup)
   */
  async initialize() {
    if (this.pool) {
      logger.warn('Database pool already initialized');
      return;
    }

    try {
  logger.info(`Creating MySQL pool with config: ${JSON.stringify(databaseConfig)}`);
        this.pool = mysql.createPool({
            host: databaseConfig.host,
            user: databaseConfig.user,
            password: databaseConfig.password,
            database: databaseConfig.database,
            port: databaseConfig.port,
            connectionLimit: databaseConfig.connectionLimit,
            waitForConnections: true,
            queueLimit: 0,
        });

        // Test connection
        const connection = await this.pool.getConnection();
        await connection.ping();
        connection.release();

        logger.info('✅ Database connection pool initialized');
    } catch (error) {
  logger.error(`❌ Database connection failed: ${error?.message || error}`);
        throw error;
    }
  }

  /**
   * Get a connection from pool (use with async/await)
   */
  async getConnection() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return await this.pool.getConnection();
  }

  /**
   * Execute query with automatic connection management
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @param {boolean} commit - Whether to commit transaction
   * @returns {Promise<Array|Object|null>} - Query results
   */
  async query(query, params = [], commit = false) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(query, params);
      
      if (commit) {
        await connection.commit();
      }
      
      return rows;
    } catch (error) {
      await connection.rollback();
  logger.error(`Database query error: ${error?.message || error}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute query within a transaction
   * @param {Function} callback - Async function receiving connection
   */
  async transaction(callback) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
  logger.error(`Transaction failed: ${error?.message || error}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const [rows] = await this.query('SELECT 1 AS ok');
      return { status: 'ok', db: rows[0]?.ok };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}

// Export singleton instance
export default new DatabaseConnection();