import db from '../connection.js';
import { TABLES } from '../../config/db.config.js';
import logger from '../../utils/logger.js';

class UserRepository {
    /**
     * Get user by ID
     * @param {number} userId 
     * @returns {Promise<Object|null>}
     */
    async findById(userId) {
    const query = `SELECT * FROM \`${TABLES.USER}\` WHERE user_id = ?`;
    // connection.query returns an array of rows
    const rows = await db.query(query, [userId]);
    logger.info(`UserRepository.findById: Queried for user_id=${userId}, details: ${JSON.stringify(rows, null, 2)}`);
    return rows[0] || null;
    }

    /**
     * Get all users
     * @returns {Promise<Array>}
     */
    async findAll() {
    const query = `SELECT * FROM \`${TABLES.USER}\``;
    return await db.query(query);
    }

    /**
     * Find a user by username (used for authentication)
     * @param {string} userName
     * @returns {Promise<Object|null>}
     */
    async findByUsername(userName) {
        const query = `SELECT * FROM \`${TABLES.USER}\` WHERE user_name = ?`;
        const rows = await db.query(query, [userName]);
        return rows[0] || null;
    }

    /**
     * Get table schema
     * @param {string} tableName 
     * @returns {Promise<Array>}
     */
    async describeTable(tableName) {
    const query = `SHOW COLUMNS FROM \`${tableName}\``;
    return await db.query(query);
    }
}

export default new UserRepository();