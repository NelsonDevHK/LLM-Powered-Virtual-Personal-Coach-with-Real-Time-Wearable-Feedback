const { pool } = require('../db');

// Database access layer: all direct SQL lives here.
// Exposes small, focused helpers that services can consume.

async function getAllUSER() {
    const [rows] = await pool.query('SELECT * FROM USER');
    // Return the full result set array
    return rows;
}
async function getUserById(userId) {
    const [rows] = await pool.query('SELECT * FROM USER WHERE id = ? LIMIT 1', [userId]);
    return rows[0] ?? null;
}

async function saveUser(user) {
    const { id, name, email } = user;
    await pool.query(
        'INSERT INTO USER (id, name, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)',
        [id, name, email]
    );
}

module.exports = {
    getAllUSER,
    getUserById,
    saveUser,
};