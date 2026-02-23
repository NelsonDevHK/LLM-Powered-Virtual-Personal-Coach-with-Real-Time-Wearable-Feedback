#!/usr/bin/env python3
"""
Database Schema Creator for 02test
Creates the exact table structure without sample data.
"""

import os
import mysql.connector
from mysql.connector import Error


def create_database_schema():
    # Get credentials from environment variables (more secure than hardcoding)
    db_config = {
        "host": "localhost",
        "user": "root",
        "password": "password",
        "port": 3306,
    }

    # Initialize for safe cleanup in exception paths
    connection = None
    cursor = None

    try:
        # Connect to MySQL server (without specifying database yet)
        connection = mysql.connector.connect(**db_config)
        if not connection.is_connected():
            raise Exception("Failed to connect to MySQL server")

        cursor = connection.cursor()

        print("✅ Connected to MySQL server")

        # 1. Create database (using backticks for special name starting with digit)
        cursor.execute(
            "CREATE DATABASE IF NOT EXISTS `02test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        print("✅ Database '02test' created/verified")

        # 2. Switch to the new database
        cursor.execute("USE `02test`")

        # 3. Create users table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS `users` (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                user_name VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                exercise_level VARCHAR(50) NOT NULL,
                fitness_goal VARCHAR(50) NOT NULL,
                injuries TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
        )
        print("✅ Table 'users' created")

        # 4. Create conversation_history table with foreign key
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS conversation_history (
                message_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                role ENUM('user', 'assistant') NOT NULL,
                session_summary TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES `users`(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
        )
        print("✅ Table 'conversation_history' created")

        # 5. Create wearable_data table with foreign key
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS wearable_data (
                data_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                heart_rate INT NOT NULL,
                current_speed DECIMAL(5,2) NOT NULL,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES `users`(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
        )
        print("✅ Table 'wearable_data' created")

        connection.commit()
        print("\n🎉 Database schema created successfully!")
        print(
            "💡 To use: Set environment variables DB_USER, DB_PASSWORD before running:"
        )
        print("   export DB_USER='your_username'")
        print("   export DB_PASSWORD='your_password'")
        print("   python3 src/database/create_db.py")

    except Error as e:
        print(f"\n❌ MySQL Error: {e}")
        if connection is not None:
            connection.rollback()
    except Exception as e:
        print(f"\n❌ General Error: {e}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()
            print("🔌 MySQL connection closed")


if __name__ == "__main__":
    create_database_schema()
