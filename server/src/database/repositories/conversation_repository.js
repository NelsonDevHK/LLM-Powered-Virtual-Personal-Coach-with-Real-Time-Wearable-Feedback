import {db} from '../index.js';
import { TABLES } from '../../config/db.config.js';
import logger from '../../utils/logger.js';

class ConversationRepository {
        /**
         * Save a chat message to the conversation history table
         * @param {number} userId
         * @param {Object} conversationData - { question: string, answer: string, timestamp?: Date }
         * @returns {Promise<void>}
         */
    async saveChatMessage(userId, conversationData) {
        // conversationData: { session_summary: string, role: 'user' | 'assistant', timestamp?: Date }
        const { session_summary, role, timestamp } = conversationData;
        const query = `INSERT INTO \`${TABLES.CONVERSATION_HISTORY}\` (user_id, role, session_summary, created_at) VALUES (?, ?, ?, ?)`;
        // Format timestamp as 'YYYY-MM-DD HH:MM:SS' for MySQL
        function formatDateToMySQL(dt) {
            const pad = n => n < 10 ? '0' + n : n;
            return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) + ' '
                + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
        }
        let createdAt;
        if (timestamp) {
            const dt = new Date(timestamp);
            createdAt = formatDateToMySQL(dt);
        } else {
            createdAt = formatDateToMySQL(new Date());
        }
        try {
            await db.query(query, [userId, role, session_summary, createdAt]);
            logger.info(`Saved chat message for user_id=${userId}`);
        } catch (error) {
            logger.error(`Error saving chat message for user_id=${userId}:`, error);
            throw error;
        }
    }
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