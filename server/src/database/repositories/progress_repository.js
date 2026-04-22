import db from '../connection.js';
import { TABLES } from '../../config/db.config.js';

const ALLOWED_UPDATE_FIELDS = new Set([
  'current_streak',
  'weekly_goal',
  'last_workout_date',
  'feed_count',
  'pet_mood',
  'weeks_inactive'
]);

class ProgressRepository {
    async findByUserId(userId) {
        const query = `SELECT * FROM \`${TABLES.USER_PROGRESS}\` WHERE user_id = ? LIMIT 1`;
        const rows = await db.query(query, [userId]);
        return rows[0] || null;
    }

    async ensureRow(userId) {
        const query = `
            INSERT INTO \`${TABLES.USER_PROGRESS}\` (user_id)
            VALUES (?)
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)
        `;
        await db.query(query, [userId]);
        return await this.findByUserId(userId);
    }

    async updateByUserId(userId, fields) {
        const entries = Object.entries(fields || {}).filter(([field]) => ALLOWED_UPDATE_FIELDS.has(field));
        if (entries.length === 0) {
            return this.findByUserId(userId);
        }

        const setClause = entries.map(([field]) => `\`${field}\` = ?`).join(', ');
        const values = entries.map(([, value]) => value);
        const query = `UPDATE \`${TABLES.USER_PROGRESS}\` SET ${setClause} WHERE user_id = ?`;
        await db.query(query, [...values, userId]);
        return await this.findByUserId(userId);
    }

    async updateWeeklyGoal(userId, weeklyGoal) {
        return this.updateByUserId(userId, {
            weekly_goal: weeklyGoal
        });
    }
}

export default new ProgressRepository();