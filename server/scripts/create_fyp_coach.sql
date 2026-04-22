-- Create and select the database
CREATE DATABASE IF NOT EXISTS fyp_coach CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fyp_coach;

-- Table: users (Figure 3a)
CREATE TABLE users (
    user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    age INT NULL,
    gender VARCHAR(16) NULL,
    exercise_level VARCHAR(50) NOT NULL,
    fitness_goal VARCHAR(50) NOT NULL,
    injuries TEXT NULL,
    created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: wearable_data (Figure 3b)
CREATE TABLE wearable_data (
    data_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    heart_rate INT NOT NULL,
    exercise_type VARCHAR(50) NULL DEFAULT 'General',
    set_count INT NULL DEFAULT 0,
    sleep_duration INT NULL,
    sleep_quality INT NULL,
    rest_duration INT NULL,
    recorded_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Table: user_progress (Figure 3c)
CREATE TABLE user_progress (
    progress_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    current_streak INT NULL DEFAULT 0,
    weekly_goal INT NULL DEFAULT 4,
    last_workout_date DATE NULL,
    feed_count INT NULL DEFAULT 0,
    pet_mood ENUM('happy', 'okay', 'sad') NULL DEFAULT 'okay',
    weeks_inactive INT NULL DEFAULT 0,
    updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);