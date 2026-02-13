const { getAllUsers, getUserById, saveUser } = require('../database/db_data');

// Service layer: orchestrates data access, business logic, and validation.
// Does NOT talk to the DB directly—delegates to database/db_data.js.

async function getUserData(userId) {
    // Fetch a single user by id via the data access layer
    return (await getUserById(userId));
}

async function getAllUserData() {
    // Example aggregator: fetch all users via the data access layer
    return (await getAllUsers());
}

async function saveUserData(user) {
    // Persist via the data access layer (upsert)
    await saveUser(user);
}

module.exports = { getUserData, getAllUserData, saveUserData };