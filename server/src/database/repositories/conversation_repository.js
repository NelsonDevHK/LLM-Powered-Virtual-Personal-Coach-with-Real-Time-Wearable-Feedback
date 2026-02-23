import {db} from '../index.js';
import { TABLES } from '../../config/db.config.js';
import logger from '../../utils/logger.js';

class ConversationRepository {
    /**
     * Get conversation by ID
     * @param {number} conversationId 
     * @returns {Promise<Object|null>}
        */
    async findById(userId) {
        const query = `SELECT * FROM \`${TABLES.CONVERSATION_HISTORY}\` WHERE user_id = ?`;
        const rows = await db.query(query, [userId]);
        return rows[0] || null;
    }

    async getConversationHistory(userId) {
        const query = `SELECT session_summary FROM \`${TABLES.CONVERSATION_HISTORY}\` WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1`;
        const rows = await db.query(query, [userId]);
        return rows[0]?.session_summary || null;
    }
    
    /**
     * Get all conversations
     * @returns {Promise<Array>}
     */
    async findAll() {
        const query = `SELECT * FROM \`${TABLES.CONVERSATION}\``;
        return await db.query(query);
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

export default new ConversationRepository();