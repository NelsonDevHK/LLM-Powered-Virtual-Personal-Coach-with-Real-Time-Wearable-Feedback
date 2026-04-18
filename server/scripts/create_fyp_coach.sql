-- OPTIONAL: start clean
-- DROP DATABASE IF EXISTS fyp_coach;

CREATE DATABASE IF NOT EXISTS fyp_coach
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE fyp_coach;

-- =========================
-- users
-- =========================
CREATE TABLE IF NOT EXISTS `users` (
  `user_id`        INT           NOT NULL AUTO_INCREMENT,
  `user_name`      VARCHAR(100)  NOT NULL,
  `password`       VARCHAR(255)  NOT NULL,
  `name`           VARCHAR(100)  NOT NULL,
  `age`            INT           NULL,
  `gender`         VARCHAR(16)   NULL,
  `exercise_level` VARCHAR(50)   NOT NULL,
  `fitness_goal`   VARCHAR(50)   NOT NULL,
  `injuries`       TEXT          NULL,
  `created_at`     DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `ux_users_user_name` (`user_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- user_progress (streak + pet system for gamification)
-- =========================
CREATE TABLE IF NOT EXISTS `user_progress` (
  `progress_id`     INT                              NOT NULL AUTO_INCREMENT,
  `user_id`         INT                              NOT NULL,
  `current_streak`  INT                              NULL DEFAULT 0,
  `weekly_goal`     INT                              NULL DEFAULT 4,
  `last_workout_date` DATE                            NULL,
  `feed_count`      INT                              NULL DEFAULT 0,
  `pet_mood`        ENUM('happy','okay','sad')       NULL DEFAULT 'okay',
  `weeks_inactive`  INT                              NULL DEFAULT 0,
  `updated_at`      DATETIME                         NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at`      DATETIME                         NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`progress_id`),
  KEY `idx_progress_user_id` (`user_id`),
  CONSTRAINT `fk_progress_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- conversation_history
-- =========================
CREATE TABLE IF NOT EXISTS `conversation_history` (
  `message_id`      INT                      NOT NULL AUTO_INCREMENT,
  `user_id`         INT                      NOT NULL,
  `role`            ENUM('user','assistant') NOT NULL,
  `session_summary` TEXT                     NOT NULL,
  `created_at`      DATETIME                 NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_conv_user_id` (`user_id`),
  CONSTRAINT `fk_conv_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- wearable_data
-- =========================
CREATE TABLE IF NOT EXISTS `wearable_data` (
  `data_id`        INT          NOT NULL AUTO_INCREMENT,
  `user_id`        INT          NOT NULL,
  `heart_rate`     INT          NOT NULL,
  `current_speed`  DECIMAL(5,2) NOT NULL,
  `exercise_type`  VARCHAR(50)  NULL DEFAULT 'General',
  `set_count`      INT          NULL DEFAULT 0,
  `sleep_duration` INT          NULL,
  `sleep_quality`  INT          NULL,
  `rest_duration`  INT          NULL,
  `recorded_at`    DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`data_id`),
  KEY `idx_wearable_user_id` (`user_id`),
  CONSTRAINT `fk_wearable_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;