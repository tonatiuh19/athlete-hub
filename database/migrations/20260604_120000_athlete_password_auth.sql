-- Athlete email/password auth (replaces OTP for athletes; staff OTP unchanged)
-- Existing athletes: password_hash stays NULL until they use forgot-password.

ALTER TABLE `athletes`
  ADD COLUMN `password_hash` VARCHAR(255) DEFAULT NULL COMMENT 'scrypt hash; NULL = must set via reset' AFTER `email_verified_at`;

ALTER TABLE `athletes`
  ADD COLUMN `password_set_at` DATETIME DEFAULT NULL AFTER `password_hash`;

ALTER TABLE `athletes`
  ADD COLUMN `clerk_user_id` VARCHAR(255) DEFAULT NULL COMMENT 'Clerk user id (sub) for SSO linking' AFTER `facebook_id`;

ALTER TABLE `athletes`
  ADD UNIQUE KEY `uk_athletes_clerk_user_id` (`clerk_user_id`);

CREATE TABLE IF NOT EXISTS `athlete_password_resets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `athlete_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_athlete_password_resets_athlete` (`athlete_id`),
  KEY `idx_athlete_password_resets_expires` (`expires_at`),
  KEY `idx_athlete_password_resets_lookup` (`token_hash`, `expires_at`),
  CONSTRAINT `fk_athlete_password_resets_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
