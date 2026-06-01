-- Phase 2: Teams, gamification, achievements
-- Compatible with TiDB Cloud Serverless (MySQL 8.0)

CREATE TABLE IF NOT EXISTS `athlete_teams` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_uuid` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `owner_athlete_id` INT UNSIGNED NOT NULL,
  `description` TEXT DEFAULT NULL,
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `invite_code` VARCHAR(12) NOT NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT 1,
  `member_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_athlete_teams_public_uuid` (`public_uuid`),
  UNIQUE KEY `uk_athlete_teams_slug` (`slug`),
  UNIQUE KEY `uk_athlete_teams_invite_code` (`invite_code`),
  KEY `idx_athlete_teams_owner` (`owner_athlete_id`),
  KEY `idx_athlete_teams_public` (`is_public`, `member_count`),
  CONSTRAINT `fk_athlete_teams_owner` FOREIGN KEY (`owner_athlete_id`) REFERENCES `athletes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `athlete_team_members` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_id` INT UNSIGNED NOT NULL,
  `athlete_id` INT UNSIGNED NOT NULL,
  `role` ENUM('owner','member') NOT NULL DEFAULT 'member',
  `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_member_athlete` (`team_id`, `athlete_id`),
  KEY `idx_team_members_athlete` (`athlete_id`),
  CONSTRAINT `fk_team_members_team` FOREIGN KEY (`team_id`) REFERENCES `athlete_teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_team_members_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `achievement_definitions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `icon` VARCHAR(80) DEFAULT NULL,
  `xp_reward` INT UNSIGNED NOT NULL DEFAULT 0,
  `criteria_type` ENUM('registration','result','streak','team') NOT NULL,
  `criteria_value` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_achievement_definitions_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `athlete_achievements` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `athlete_id` INT UNSIGNED NOT NULL,
  `achievement_id` INT UNSIGNED NOT NULL,
  `earned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_athlete_achievement` (`athlete_id`, `achievement_id`),
  KEY `idx_athlete_achievements_earned` (`athlete_id`, `earned_at`),
  KEY `fk_athlete_achievements_event` (`event_id`),
  CONSTRAINT `fk_athlete_achievements_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_athlete_achievements_definition` FOREIGN KEY (`achievement_id`) REFERENCES `achievement_definitions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_athlete_achievements_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `athlete_gamification` (
  `athlete_id` INT UNSIGNED NOT NULL,
  `xp_total` INT UNSIGNED NOT NULL DEFAULT 0,
  `level` INT UNSIGNED NOT NULL DEFAULT 1,
  `streak_days` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_activity_date` DATE DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`athlete_id`),
  CONSTRAINT `fk_athlete_gamification_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `achievement_definitions` (`slug`, `name`, `description`, `icon`, `xp_reward`, `criteria_type`, `criteria_value`) VALUES
  ('first-registration', 'First Steps', 'Complete your first event registration', 'flag', 50, 'registration', 1),
  ('first-result', 'Finisher', 'Earn your first published race result', 'medal', 75, 'result', 1),
  ('streak-7', 'Week Warrior', 'Maintain a 7-day activity streak', 'flame', 100, 'streak', 7),
  ('team-join', 'Team Player', 'Join an athlete team', 'users', 25, 'team', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
