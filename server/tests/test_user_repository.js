import test from 'node:test';
import assert from 'node:assert/strict';

// Import the real db connection singleton so we can monkey-patch its `query` method
import db from '../src/database/repositories/connection.js';
import userRepository from '../src/database/repositories/user_repository.js';

test('findById returns a user object when the DB returns rows', async () => {
  // Arrange: mock db.query to return an array of rows
  db.query = async (query, params) => {
    // Simple verification that query contains a WHERE
    assert.ok(query.toLowerCase().includes('where'));
    assert.deepEqual(params, [1]);
    return [ { user_id: 1, user_name: 'Alice' } ];
  };

  // Act
  const user = await userRepository.findById(1);

  // Assert
  assert.deepEqual(user, { user_id: 1, user_name: 'Alice' });
});

test('findById returns null when no rows are returned', async () => {
  db.query = async () => { return []; };

  const user = await userRepository.findById(999);
  assert.equal(user, null);
});

// Restore db.query if desired (not strictly necessary in isolated tests)
