-- Complete schema hardening (TiDB-compatible — one operation per ALTER)
-- Picks up where 20260531_120000 left off after partial apply

-- ============================================================================
-- ADMINS — finish public_uuid (columns already added by partial 120000 run)
-- ============================================================================
UPDATE `admins` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `admins` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
-- Keys added below only if not present (ignore error 1061 on re-run)
ALTER TABLE `admins` ADD UNIQUE KEY `uk_admins_public_uuid` (`public_uuid`);
ALTER TABLE `admins` ADD KEY `idx_admins_deleted` (`deleted_at`);

-- ============================================================================
-- ORGANIZERS
-- ============================================================================
ALTER TABLE `organizers` ADD COLUMN `public_uuid` CHAR(36) DEFAULT NULL AFTER `id`;
ALTER TABLE `organizers` ADD COLUMN `billing_email` VARCHAR(255) DEFAULT NULL AFTER `email`;
ALTER TABLE `organizers` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`;
UPDATE `organizers` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `organizers` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
ALTER TABLE `organizers` ADD UNIQUE KEY `uk_organizers_public_uuid` (`public_uuid`);
ALTER TABLE `organizers` ADD KEY `idx_organizers_city` (`city`, `country`);
ALTER TABLE `organizers` ADD KEY `idx_organizers_deleted` (`deleted_at`);

-- ============================================================================
-- ORGANIZER MEMBERS
-- ============================================================================
ALTER TABLE `organizer_members` ADD COLUMN `public_uuid` CHAR(36) DEFAULT NULL AFTER `id`;
ALTER TABLE `organizer_members` ADD COLUMN `invited_at` DATETIME DEFAULT NULL AFTER `status`;
ALTER TABLE `organizer_members` ADD COLUMN `invited_by_member_id` INT UNSIGNED DEFAULT NULL AFTER `invited_at`;
ALTER TABLE `organizer_members` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`;
UPDATE `organizer_members` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `organizer_members` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
ALTER TABLE `organizer_members` ADD UNIQUE KEY `uk_organizer_members_public_uuid` (`public_uuid`);
ALTER TABLE `organizer_members` ADD KEY `idx_organizer_members_email` (`email`);
ALTER TABLE `organizer_members` ADD KEY `idx_organizer_members_deleted` (`deleted_at`);

-- ============================================================================
-- ATHLETES
-- ============================================================================
ALTER TABLE `athletes` ADD COLUMN `public_uuid` CHAR(36) DEFAULT NULL AFTER `id`;
ALTER TABLE `athletes` ADD COLUMN `email_verified_at` DATETIME DEFAULT NULL AFTER `email`;
ALTER TABLE `athletes` ADD COLUMN `phone_verified_at` DATETIME DEFAULT NULL AFTER `phone`;
ALTER TABLE `athletes` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`;
UPDATE `athletes` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `athletes` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
ALTER TABLE `athletes` ADD UNIQUE KEY `uk_athletes_public_uuid` (`public_uuid`);
ALTER TABLE `athletes` ADD KEY `idx_athletes_name` (`last_name`, `first_name`);
ALTER TABLE `athletes` ADD KEY `idx_athletes_city` (`city`, `country`);
ALTER TABLE `athletes` ADD KEY `idx_athletes_deleted` (`deleted_at`);

-- ============================================================================
-- EVENTS
-- ============================================================================
ALTER TABLE `events` ADD COLUMN `public_uuid` CHAR(36) DEFAULT NULL AFTER `id`;
ALTER TABLE `events` ADD COLUMN `venue_id` INT UNSIGNED DEFAULT NULL AFTER `sport_type_id`;
ALTER TABLE `events` ADD COLUMN `featured` TINYINT(1) NOT NULL DEFAULT 0 AFTER `visibility`;
ALTER TABLE `events` ADD COLUMN `search_keywords` VARCHAR(500) DEFAULT NULL AFTER `description`;
ALTER TABLE `events` ADD COLUMN `version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Optimistic locking' AFTER `registration_count`;
ALTER TABLE `events` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`;
UPDATE `events` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `events` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
ALTER TABLE `events` ADD UNIQUE KEY `uk_events_public_uuid` (`public_uuid`);
ALTER TABLE `events` ADD UNIQUE KEY `uk_events_slug_global` (`slug`);
ALTER TABLE `events` ADD KEY `idx_events_marketplace` (`status`, `visibility`, `start_date`);
ALTER TABLE `events` ADD KEY `idx_events_featured` (`featured`, `start_date`);
ALTER TABLE `events` ADD KEY `idx_events_city` (`location_city`, `location_country`);
ALTER TABLE `events` ADD KEY `idx_events_organizer_status` (`organizer_id`, `status`);
ALTER TABLE `events` ADD KEY `idx_events_deleted` (`deleted_at`);
ALTER TABLE `events` ADD CONSTRAINT `fk_events_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE SET NULL;

-- ============================================================================
-- EVENT CATEGORIES
-- ============================================================================
ALTER TABLE `event_categories` ADD COLUMN `public_uuid` CHAR(36) DEFAULT NULL AFTER `id`;
ALTER TABLE `event_categories` ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'MXN' AFTER `price_cents`;
ALTER TABLE `event_categories` ADD COLUMN `waitlist_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`;
ALTER TABLE `event_categories` ADD COLUMN `registration_opens_at` DATETIME DEFAULT NULL AFTER `waitlist_enabled`;
ALTER TABLE `event_categories` ADD COLUMN `registration_closes_at` DATETIME DEFAULT NULL AFTER `registration_opens_at`;
UPDATE `event_categories` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `event_categories` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
ALTER TABLE `event_categories` ADD UNIQUE KEY `uk_event_categories_public_uuid` (`public_uuid`);
ALTER TABLE `event_categories` ADD KEY `idx_event_categories_active_price` (`event_id`, `is_active`, `price_cents`);

-- ============================================================================
-- REGISTRATIONS
-- ============================================================================
ALTER TABLE `registrations` ADD COLUMN `public_uuid` CHAR(36) DEFAULT NULL AFTER `id`;
ALTER TABLE `registrations` ADD COLUMN `discount_code_id` INT UNSIGNED DEFAULT NULL AFTER `total_cents`;
ALTER TABLE `registrations` ADD COLUMN `schedule_wave_id` INT UNSIGNED DEFAULT NULL AFTER `discount_code_id`;
ALTER TABLE `registrations` ADD COLUMN `source` ENUM('web','mobile','admin','api','transfer') NOT NULL DEFAULT 'web' AFTER `schedule_wave_id`;
ALTER TABLE `registrations` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`;
UPDATE `registrations` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `registrations` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
ALTER TABLE `registrations` ADD UNIQUE KEY `uk_registrations_public_uuid` (`public_uuid`);
ALTER TABLE `registrations` ADD KEY `idx_registrations_event_status` (`event_id`, `status`);
ALTER TABLE `registrations` ADD KEY `idx_registrations_category_status` (`event_category_id`, `status`);
ALTER TABLE `registrations` ADD KEY `idx_registrations_created` (`created_at`);
ALTER TABLE `registrations` ADD KEY `idx_registrations_deleted` (`deleted_at`);
ALTER TABLE `registrations` ADD CONSTRAINT `fk_registrations_discount` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes`(`id`) ON DELETE SET NULL;
ALTER TABLE `registrations` ADD CONSTRAINT `fk_registrations_wave` FOREIGN KEY (`schedule_wave_id`) REFERENCES `event_schedule_waves`(`id`) ON DELETE SET NULL;

-- ============================================================================
-- PAYMENTS
-- ============================================================================
ALTER TABLE `payments` ADD COLUMN `public_uuid` CHAR(36) DEFAULT NULL AFTER `id`;
ALTER TABLE `payments` ADD COLUMN `idempotency_key` VARCHAR(64) DEFAULT NULL AFTER `public_uuid`;
ALTER TABLE `payments` ADD COLUMN `failure_code` VARCHAR(50) DEFAULT NULL AFTER `status`;
ALTER TABLE `payments` ADD COLUMN `failure_message` VARCHAR(500) DEFAULT NULL AFTER `failure_code`;
UPDATE `payments` SET `public_uuid` = UUID() WHERE `public_uuid` IS NULL OR `public_uuid` = '';
ALTER TABLE `payments` MODIFY COLUMN `public_uuid` CHAR(36) NOT NULL;
ALTER TABLE `payments` ADD UNIQUE KEY `uk_payments_public_uuid` (`public_uuid`);
ALTER TABLE `payments` ADD UNIQUE KEY `uk_payments_idempotency` (`idempotency_key`);
ALTER TABLE `payments` ADD UNIQUE KEY `uk_payments_stripe_pi` (`stripe_payment_intent_id`);
ALTER TABLE `payments` ADD KEY `idx_payments_created` (`created_at`);
ALTER TABLE `payments` ADD KEY `idx_payments_event_status` (`event_id`, `status`);

-- ============================================================================
-- WAITLIST FK
-- ============================================================================
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `fk_waitlist_registration` FOREIGN KEY (`converted_registration_id`) REFERENCES `registrations`(`id`) ON DELETE SET NULL;

-- ============================================================================
-- SPORT TYPES
-- ============================================================================
ALTER TABLE `sport_types` ADD COLUMN `description` VARCHAR(255) DEFAULT NULL AFTER `name`;
ALTER TABLE `sport_types` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;

-- ============================================================================
-- OTP + NOTIFICATION INDEXES
-- ============================================================================
ALTER TABLE `athlete_otp_codes` ADD KEY `idx_athlete_otp_lookup` (`athlete_id`, `purpose`, `expires_at`);
ALTER TABLE `admin_otp_codes` ADD KEY `idx_admin_otp_lookup` (`admin_id`, `purpose`, `expires_at`);
ALTER TABLE `organizer_otp_codes` ADD KEY `idx_organizer_otp_lookup` (`organizer_member_id`, `purpose`, `expires_at`);
ALTER TABLE `notification_queue` ADD KEY `idx_notification_queue_recipient` (`recipient_type`, `recipient_id`, `status`);

-- ============================================================================
-- DEFAULT TAGS
-- ============================================================================
INSERT INTO `tags` (`slug`, `name`, `category`, `sort_order`) VALUES
  ('5k', '5K', 'distance', 1),
  ('10k', '10K', 'distance', 2),
  ('half-marathon', 'Media Maratón', 'distance', 3),
  ('marathon', 'Maratón', 'distance', 4),
  ('ultra', 'Ultra', 'distance', 5),
  ('trail', 'Trail', 'terrain', 10),
  ('road', 'Asfalto', 'terrain', 11),
  ('family', 'Familiar', 'audience', 20),
  ('elite', 'Elite', 'audience', 21),
  ('charity', 'Benefico', 'feature', 30),
  ('chip-timing', 'Chip Timing', 'feature', 31)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
