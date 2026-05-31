-- Schema hardening: scalability, maintainability, and production-readiness
-- TiDB Cloud Serverless (MySQL 8.0 compatible)

-- ============================================================================
-- VENUES (reusable locations — avoids duplicating geo data per event)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `venues` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_uuid` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `address_line1` VARCHAR(255) DEFAULT NULL,
  `address_line2` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `postal_code` VARCHAR(20) DEFAULT NULL,
  `country` CHAR(2) NOT NULL DEFAULT 'MX',
  `lat` DECIMAL(10,7) DEFAULT NULL,
  `lng` DECIMAL(10,7) DEFAULT NULL,
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',
  `capacity` INT UNSIGNED DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_venues_public_uuid` (`public_uuid`),
  KEY `idx_venues_city_country` (`city`, `country`),
  KEY `idx_venues_geo` (`lat`, `lng`),
  KEY `idx_venues_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TAGS (event discovery / filtering)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `tags` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(60) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `category` ENUM('distance','terrain','audience','feature','other') NOT NULL DEFAULT 'other',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tags_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_tags` (
  `event_id` INT UNSIGNED NOT NULL,
  `tag_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`, `tag_id`),
  KEY `idx_event_tags_tag` (`tag_id`),
  CONSTRAINT `fk_event_tags_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MEDIA ASSETS (centralized file references)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `media_assets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_uuid` CHAR(36) NOT NULL,
  `entity_type` ENUM('event','organizer','athlete','venue','sponsor') NOT NULL,
  `entity_id` INT UNSIGNED NOT NULL,
  `asset_type` ENUM('hero','banner','logo','gallery','document','route_map','other') NOT NULL DEFAULT 'other',
  `url` VARCHAR(1000) NOT NULL,
  `alt_text` VARCHAR(255) DEFAULT NULL,
  `mime_type` VARCHAR(100) DEFAULT NULL,
  `file_size_bytes` INT UNSIGNED DEFAULT NULL,
  `width_px` INT UNSIGNED DEFAULT NULL,
  `height_px` INT UNSIGNED DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_media_public_uuid` (`public_uuid`),
  KEY `idx_media_entity` (`entity_type`, `entity_id`, `asset_type`),
  KEY `idx_media_primary` (`entity_type`, `entity_id`, `is_primary`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- EVENT SPONSORS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `event_sponsors` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `logo_url` VARCHAR(500) DEFAULT NULL,
  `website_url` VARCHAR(500) DEFAULT NULL,
  `tier` ENUM('title','gold','silver','bronze','partner') NOT NULL DEFAULT 'partner',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_sponsors_event` (`event_id`, `sort_order`),
  CONSTRAINT `fk_event_sponsors_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- EVENT SCHEDULE WAVES (start waves / corrals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `event_schedule_waves` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `event_category_id` INT UNSIGNED DEFAULT NULL COMMENT 'Null = applies to all categories',
  `name` VARCHAR(100) NOT NULL,
  `starts_at` DATETIME NOT NULL,
  `capacity` INT UNSIGNED DEFAULT NULL,
  `registered_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_schedule_waves_event` (`event_id`, `starts_at`),
  CONSTRAINT `fk_schedule_waves_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_schedule_waves_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DISCOUNT CODES
-- ============================================================================
CREATE TABLE IF NOT EXISTS `discount_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED DEFAULT NULL COMMENT 'Null = platform-wide or organizer-wide via organizer_id',
  `organizer_id` INT UNSIGNED DEFAULT NULL,
  `code` VARCHAR(40) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `discount_type` ENUM('percent','fixed_cents') NOT NULL DEFAULT 'percent',
  `discount_value` INT UNSIGNED NOT NULL COMMENT 'Percent (1-100) or cents',
  `applies_to` ENUM('registration','service_fee','total') NOT NULL DEFAULT 'registration',
  `max_uses` INT UNSIGNED DEFAULT NULL,
  `used_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `min_purchase_cents` INT UNSIGNED DEFAULT NULL,
  `valid_from` DATETIME DEFAULT NULL,
  `valid_until` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_discount_code_event` (`event_id`, `code`),
  KEY `idx_discount_codes_organizer` (`organizer_id`),
  KEY `idx_discount_codes_active` (`is_active`, `valid_from`, `valid_until`),
  CONSTRAINT `fk_discount_codes_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_discount_codes_organizer` FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- WAITLIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS `waitlist_entries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `event_category_id` INT UNSIGNED NOT NULL,
  `athlete_id` INT UNSIGNED NOT NULL,
  `status` ENUM('waiting','offered','converted','expired','cancelled') NOT NULL DEFAULT 'waiting',
  `position` INT UNSIGNED NOT NULL DEFAULT 1,
  `offered_at` DATETIME DEFAULT NULL,
  `offer_expires_at` DATETIME DEFAULT NULL,
  `converted_registration_id` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_waitlist_athlete_category` (`event_category_id`, `athlete_id`),
  KEY `idx_waitlist_event_status` (`event_id`, `status`, `position`),
  CONSTRAINT `fk_waitlist_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waitlist_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waitlist_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- REGISTRATION STATUS HISTORY (audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `registration_status_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `from_status` VARCHAR(30) DEFAULT NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `actor_type` ENUM('athlete','organizer_member','admin','system') NOT NULL DEFAULT 'system',
  `actor_id` INT UNSIGNED DEFAULT NULL,
  `reason` VARCHAR(500) DEFAULT NULL,
  `metadata_json` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reg_status_hist_registration` (`registration_id`, `created_at`),
  CONSTRAINT `fk_reg_status_hist_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CHECK-IN LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `check_in_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `event_id` INT UNSIGNED NOT NULL,
  `checked_in_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `method` ENUM('qr_scan','manual','kiosk','api') NOT NULL DEFAULT 'qr_scan',
  `operator_type` ENUM('organizer_member','admin','system') DEFAULT NULL,
  `operator_id` INT UNSIGNED DEFAULT NULL,
  `location_label` VARCHAR(100) DEFAULT NULL,
  `device_info` VARCHAR(255) DEFAULT NULL,
  `metadata_json` JSON DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_check_in_registration` (`registration_id`),
  KEY `idx_check_in_event_time` (`event_id`, `checked_in_at`),
  CONSTRAINT `fk_check_in_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_check_in_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PAYMENT REFUNDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `payment_refunds` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` INT UNSIGNED NOT NULL,
  `amount_cents` INT UNSIGNED NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'MXN',
  `reason` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('pending','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
  `provider` ENUM('stripe','mock') NOT NULL DEFAULT 'stripe',
  `stripe_refund_id` VARCHAR(255) DEFAULT NULL,
  `requested_by_type` ENUM('athlete','organizer_member','admin','system') DEFAULT NULL,
  `requested_by_id` INT UNSIGNED DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_refunds_payment` (`payment_id`),
  KEY `idx_payment_refunds_stripe` (`stripe_refund_id`),
  CONSTRAINT `fk_payment_refunds_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- STRIPE WEBHOOK EVENTS (idempotent processing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `stripe_webhook_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `stripe_event_id` VARCHAR(255) NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `payload_json` JSON NOT NULL,
  `status` ENUM('received','processing','processed','failed','ignored') NOT NULL DEFAULT 'received',
  `error_message` TEXT DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stripe_event_id` (`stripe_event_id`),
  KEY `idx_stripe_webhooks_status` (`status`, `created_at`),
  KEY `idx_stripe_webhooks_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ORGANIZER SETTINGS (extensible key-value per organizer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `organizer_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organizer_id` INT UNSIGNED NOT NULL,
  `setting_key` VARCHAR(80) NOT NULL,
  `setting_value` JSON NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_organizer_setting` (`organizer_id`, `setting_key`),
  CONSTRAINT `fk_organizer_settings_organizer` FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Column/index hardening is in 20260531_120002_schema_hardening_complete.sql (TiDB requires split ALTERs)
