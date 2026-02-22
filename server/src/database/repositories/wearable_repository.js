import db from '../connection.js';
import { TABLES } from '../../config/db.config.js';



class WearableRepository {
    /**
     * Get wearable data by user ID
     * @param {number} userId 
     * @returns {Promise<Array>}
     */
    async findByUserId(userId) {
        const query = `SELECT * FROM \`${TABLES.WEARABLE_DATA}\` WHERE user_id = ?`;
        return await db.query(query, [userId]);
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