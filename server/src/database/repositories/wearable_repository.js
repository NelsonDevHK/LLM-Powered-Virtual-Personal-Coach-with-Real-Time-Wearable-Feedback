import db from '../connection.js';
import { TABLES } from '../../config/db.config.js';



class WearableRepository {
    /**
     * Get wearable data by user ID
     * @param {number} userId 
     * @returns {Promise<Array>}
     */
    async findById(userId) {
        const query = `SELECT * FROM \`${TABLES.WEARABLE_DATA}\` WHERE user_id = ?`;
        return await db.query(query, [userId]);
    }

    /**
     * Get most recent wearable sessions for personalization context
     * @param {number} userId
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async findRecentByUserId(userId, limit = 5) {
        const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 5;
        const query = `
            SELECT data_id, user_id, heart_rate, current_speed, exercise_type, set_count,
                   sleep_duration, sleep_quality, rest_duration, recorded_at
            FROM \`${TABLES.WEARABLE_DATA}\`
            WHERE user_id = ?
            ORDER BY recorded_at DESC
            LIMIT ${safeLimit}
        `;
        return await db.query(query, [userId]);
    }

    /**
     * Save new wearable data (Phase 1: session-end persistence)
     * @param {number} userId 
     * @param {Object} data - Wearable data object with heart_rate, current_speed, exercise_type, set_count, sleep_duration, sleep_quality, rest_duration
     * @returns {Promise<{insertId: number, affectedRows: number}>}
     */
    async save(userId, data) {
        const query = `
            INSERT INTO \`${TABLES.WEARABLE_DATA}\`
            (user_id, heart_rate, current_speed, exercise_type, set_count, sleep_duration, sleep_quality, rest_duration, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const values = [
            userId,
            data.heart_rate || 0,
            data.current_speed || 0,
            data.exercise_type || 'General',
            data.set_count || 0,
            data.sleep_duration || null,
            data.sleep_quality || null,
            data.rest_duration || null
        ];
        return await db.query(query, values);
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

export default new WearableRepository();