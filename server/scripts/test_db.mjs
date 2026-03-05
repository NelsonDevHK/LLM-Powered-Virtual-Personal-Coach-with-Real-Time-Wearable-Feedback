#!/usr/bin/env node
/**
 * Comprehensive Database Testing Script
 * Tests connection, tables, and CRUD operations
 */

import 'dotenv/config';
import { db, userRepository, wearableRepository, conversationRepository } from '../src/database/index.js';

async function runTests() {
  console.log('='.repeat(60));
  console.log('DATABASE TESTING SUITE');
  console.log('='.repeat(60));

  try {
    // TEST 1: Connection Details
    console.log('\n📍 TEST 1: Connection Details');
    console.log(`   Host: ${process.env.DB_HOST || '127.0.0.1'}`);
    console.log(`   Port: ${process.env.DB_PORT || '3306'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'fyp_coach'}`);
    console.log(`   User: ${process.env.DB_USER || 'root'}`);

    // TEST 2: Initialize Connection
    console.log('\n🔌 TEST 2: Initialize Connection');
    await db.initialize();
    console.log('   ✅ Connection pool initialized');

    // TEST 3: Health Check
    console.log('\n💓 TEST 3: Health Check');
    const healthCheck = await db.query('SELECT 1 AS result');
    console.log(`   ✅ Query successful: ${JSON.stringify(healthCheck[0])}`);

    // TEST 4: List Tables
    console.log('\n📋 TEST 4: Database Tables');
    const tables = await db.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(`   Tables found: ${tableNames.join(', ')}`);
    if (tableNames.includes('users') && tableNames.includes('wearable_data') && tableNames.includes('conversation_history')) {
      console.log('   ✅ All expected tables exist');
    } else {
      console.log('   ❌ Missing expected tables');
    }

    // TEST 5: Table Schemas
    console.log('\n🏗️  TEST 5: Table Schemas');
    for (const tableName of ['users', 'wearable_data', 'conversation_history']) {
      const schema = await userRepository.describeTable(tableName);
      const columns = schema.map(col => col.Field).join(', ');
      console.log(`   ${tableName}: ${columns}`);
    }

    // TEST 6: Row Counts
    console.log('\n📊 TEST 6: Row Counts');
    const userCount = await db.query('SELECT COUNT(*) as cnt FROM users');
    const wearableCount = await db.query('SELECT COUNT(*) as cnt FROM wearable_data');
    const conversationCount = await db.query('SELECT COUNT(*) as cnt FROM conversation_history');
    console.log(`   users: ${userCount[0].cnt} rows`);
    console.log(`   wearable_data: ${wearableCount[0].cnt} rows`);
    console.log(`   conversation_history: ${conversationCount[0].cnt} rows`);

    // TEST 7: Query All Users
    console.log('\n👥 TEST 7: Query All Users');
    const users = await userRepository.findAll();
    if (users.length > 0) {
      console.log(`   ✅ Found ${users.length} user(s):`);
      users.slice(0, 3).forEach((u, i) => {
        console.log(`      ${i + 1}. ${u.user_name} (ID: ${u.user_id})`);
      });
    } else {
      console.log('   ℹ️  No users in database');
    }

    // TEST 8: Find User by Username
    console.log('\n🔍 TEST 8: Find User by Username');
    if (users.length > 0) {
      const testUser = await userRepository.findByUsername(users[0].user_name);
      if (testUser) {
        console.log(`   ✅ Found user: ${testUser.user_name} (ID: ${testUser.user_id})`);
      } else {
        console.log('   ❌ Failed to find user by username');
      }
    } else {
      console.log('   ⊘ Skipped (no users in database)');
    }

    // TEST 9: Check Foreign Keys (wearable_data)
    console.log('\n🔗 TEST 9: Foreign Key Integrity (wearable_data)');
    const wearables = await db.query('SELECT * FROM wearable_data LIMIT 1');
    if (wearables.length > 0) {
      const userId = wearables[0].user_id;
      const user = await userRepository.findById(userId);
      if (user) {
        console.log(`   ✅ Foreign key valid: wearable_data.user_id=${userId} -> users.user_id=${user.user_id}`);
      } else {
        console.log(`   ❌ Foreign key broken: user_id=${userId} not found in users table`);
      }
    } else {
      console.log('   ⊘ Skipped (no wearable data)');
    }

    // TEST 10: Check Foreign Keys (conversation_history)
    console.log('\n🔗 TEST 10: Foreign Key Integrity (conversation_history)');
    const conversations = await db.query('SELECT * FROM conversation_history LIMIT 1');
    if (conversations.length > 0) {
      const userId = conversations[0].user_id;
      const user = await userRepository.findById(userId);
      if (user) {
        console.log(`   ✅ Foreign key valid: conversation_history.user_id=${userId} -> users.user_id=${user.user_id}`);
      } else {
        console.log(`   ❌ Foreign key broken: user_id=${userId} not found in users table`);
      }
    } else {
      console.log('   ⊘ Skipped (no conversation history)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

runTests();
