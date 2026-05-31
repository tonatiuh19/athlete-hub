-- Athlete Hub Database Schema
-- Last updated: 2026-05-30
-- Compatible with: TiDB Cloud Serverless (MySQL 8.0)
-- Phase 1 MVP: events, registrations, OTP auth, payments, basic CRM, results, QR, dynamic forms
-- Modify via migrations under database/migrations/

-- ============================================================================
-- SPORT TYPES (catalog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `sport_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sport_types_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `sport_types` (`slug`, `name`, `sort_order`) VALUES
  ('running', 'Running', 1),
  ('trail', 'Trail Running', 2),
  ('cycling', 'Cycling', 3),
  ('triathlon', 'Triathlon', 4),
  ('hyrox', 'Hyrox', 5),
  ('ocr', 'OCR / Spartan', 6),
  ('fitness', 'Fitness', 7),
  ('virtual', 'Virtual', 8)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================================================
-- PLATFORM ADMINS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `role` ENUM('super_admin','admin') NOT NULL DEFAULT 'admin',
  `status` ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admins_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_otp_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id` INT UNSIGNED NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `purpose` ENUM('login','email_verify') NOT NULL DEFAULT 'login',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_otp_admin_id` (`admin_id`),
  KEY `idx_admin_otp_expires` (`expires_at`),
  CONSTRAINT `fk_admin_otp_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_sessions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL UNIQUE,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_sessions_admin` (`admin_id`),
  KEY `idx_admin_sessions_expires` (`expires_at`),
  CONSTRAINT `fk_admin_sessions_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ORGANIZERS (event organizations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `organizers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `legal_name` VARCHAR(255) DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `website_url` VARCHAR(500) DEFAULT NULL,
  `logo_url` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `country` VARCHAR(2) NOT NULL DEFAULT 'MX',
  `city` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('pending','active','suspended','inactive') NOT NULL DEFAULT 'pending',
  `stripe_account_id` VARCHAR(255) DEFAULT NULL COMMENT 'Stripe Connect account ID',
  `stripe_onboarding_complete` TINYINT(1) NOT NULL DEFAULT 0,
  `service_fee_percent` DECIMAL(5,2) NOT NULL DEFAULT 11.00 COMMENT 'Platform service fee % (IVA included in display)',
  `rfc` VARCHAR(13) DEFAULT NULL COMMENT 'Mexican tax ID for invoicing',
  `tax_regime` VARCHAR(10) DEFAULT NULL,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_organizers_status` (`status`),
  KEY `idx_organizers_stripe` (`stripe_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `organizer_members` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organizer_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `role` ENUM('owner','organizer','marketing','finance','timing','operations','sponsor') NOT NULL DEFAULT 'organizer',
  `status` ENUM('invited','active','inactive','suspended') NOT NULL DEFAULT 'invited',
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_organizer_member_email` (`organizer_id`, `email`),
  KEY `idx_organizer_members_organizer` (`organizer_id`),
  KEY `idx_organizer_members_status` (`status`),
  CONSTRAINT `fk_organizer_members_organizer` FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `organizer_otp_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organizer_member_id` INT UNSIGNED NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `purpose` ENUM('login','email_verify') NOT NULL DEFAULT 'login',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_organizer_otp_member` (`organizer_member_id`),
  KEY `idx_organizer_otp_expires` (`expires_at`),
  CONSTRAINT `fk_organizer_otp_member` FOREIGN KEY (`organizer_member_id`) REFERENCES `organizer_members`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `organizer_sessions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organizer_member_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL UNIQUE,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_organizer_sessions_member` (`organizer_member_id`),
  KEY `idx_organizer_sessions_expires` (`expires_at`),
  CONSTRAINT `fk_organizer_sessions_member` FOREIGN KEY (`organizer_member_id`) REFERENCES `organizer_members`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ATHLETES (participants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `athletes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `date_of_birth` DATE DEFAULT NULL,
  `gender` ENUM('male','female','other','prefer_not_to_say') DEFAULT NULL,
  `shirt_size` ENUM('XS','S','M','L','XL','XXL') DEFAULT NULL,
  `country` VARCHAR(2) DEFAULT 'MX',
  `city` VARCHAR(100) DEFAULT NULL,
  `emergency_contact_name` VARCHAR(200) DEFAULT NULL,
  `emergency_contact_phone` VARCHAR(20) DEFAULT NULL,
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `preferred_language` VARCHAR(5) NOT NULL DEFAULT 'es',
  `google_id` VARCHAR(255) DEFAULT NULL,
  `apple_id` VARCHAR(255) DEFAULT NULL,
  `facebook_id` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_athletes_email` (`email`),
  UNIQUE KEY `uk_athletes_phone` (`phone`),
  KEY `idx_athletes_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `athlete_otp_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `athlete_id` INT UNSIGNED NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `channel` ENUM('email','sms') NOT NULL DEFAULT 'email',
  `purpose` ENUM('login','register','verify') NOT NULL DEFAULT 'login',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_athlete_otp_athlete` (`athlete_id`),
  KEY `idx_athlete_otp_expires` (`expires_at`),
  CONSTRAINT `fk_athlete_otp_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `athlete_sessions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `athlete_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL UNIQUE,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_athlete_sessions_athlete` (`athlete_id`),
  KEY `idx_athlete_sessions_expires` (`expires_at`),
  CONSTRAINT `fk_athlete_sessions_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `events` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organizer_id` INT UNSIGNED NOT NULL,
  `sport_type_id` INT UNSIGNED NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `short_description` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `status` ENUM('draft','published','cancelled','completed') NOT NULL DEFAULT 'draft',
  `visibility` ENUM('public','private','unlisted') NOT NULL DEFAULT 'public',
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME DEFAULT NULL,
  `registration_opens_at` DATETIME DEFAULT NULL,
  `registration_closes_at` DATETIME DEFAULT NULL,
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',
  `location_name` VARCHAR(255) DEFAULT NULL,
  `location_address` VARCHAR(500) DEFAULT NULL,
  `location_city` VARCHAR(100) DEFAULT NULL,
  `location_state` VARCHAR(100) DEFAULT NULL,
  `location_country` VARCHAR(2) NOT NULL DEFAULT 'MX',
  `location_lat` DECIMAL(10,7) DEFAULT NULL,
  `location_lng` DECIMAL(10,7) DEFAULT NULL,
  `hero_image_url` VARCHAR(500) DEFAULT NULL,
  `banner_image_url` VARCHAR(500) DEFAULT NULL,
  `service_fee_percent` DECIMAL(5,2) DEFAULT NULL COMMENT 'Override organizer default; null = use organizer default',
  `allows_transfers` TINYINT(1) NOT NULL DEFAULT 0,
  `transfer_fee_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `requires_waiver` TINYINT(1) NOT NULL DEFAULT 1,
  `max_registrations` INT UNSIGNED DEFAULT NULL,
  `registration_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_events_organizer_slug` (`organizer_id`, `slug`),
  KEY `idx_events_status` (`status`),
  KEY `idx_events_start_date` (`start_date`),
  KEY `idx_events_sport` (`sport_type_id`),
  CONSTRAINT `fk_events_organizer` FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_events_sport_type` FOREIGN KEY (`sport_type_id`) REFERENCES `sport_types`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `distance_km` DECIMAL(8,2) DEFAULT NULL,
  `difficulty` ENUM('beginner','intermediate','advanced','expert') DEFAULT NULL,
  `capacity` INT UNSIGNED DEFAULT NULL,
  `sold_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `price_cents` INT UNSIGNED NOT NULL COMMENT 'Registration price IVA included (MXN cents)',
  `gender_restriction` ENUM('any','male','female') NOT NULL DEFAULT 'any',
  `min_age` TINYINT UNSIGNED DEFAULT NULL,
  `max_age` TINYINT UNSIGNED DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_categories_event` (`event_id`),
  CONSTRAINT `fk_event_categories_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_registration_fields` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `field_key` VARCHAR(80) NOT NULL,
  `label` VARCHAR(200) NOT NULL,
  `field_type` ENUM('text','textarea','select','checkbox','number','date','file') NOT NULL DEFAULT 'text',
  `options_json` JSON DEFAULT NULL COMMENT 'For select/checkbox options',
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `validation_rules_json` JSON DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_field_key` (`event_id`, `field_key`),
  CONSTRAINT `fk_event_reg_fields_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_waivers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content_html` MEDIUMTEXT NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_waivers_event` (`event_id`),
  CONSTRAINT `fk_event_waivers_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- REGISTRATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `event_category_id` INT UNSIGNED NOT NULL,
  `athlete_id` INT UNSIGNED NOT NULL,
  `registration_number` VARCHAR(30) NOT NULL,
  `qr_code_token` VARCHAR(64) NOT NULL UNIQUE,
  `bib_number` VARCHAR(20) DEFAULT NULL,
  `status` ENUM('pending_payment','confirmed','cancelled','transferred','refunded') NOT NULL DEFAULT 'pending_payment',
  `price_cents` INT UNSIGNED NOT NULL COMMENT 'Category price at time of registration',
  `service_fee_cents` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Platform service fee IVA included',
  `total_cents` INT UNSIGNED NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'MXN',
  `payment_id` INT UNSIGNED DEFAULT NULL,
  `waiver_signed_at` DATETIME DEFAULT NULL,
  `checked_in_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_registrations_number` (`event_id`, `registration_number`),
  KEY `idx_registrations_athlete` (`athlete_id`),
  KEY `idx_registrations_event` (`event_id`),
  KEY `idx_registrations_status` (`status`),
  CONSTRAINT `fk_registrations_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_registrations_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories`(`id`),
  CONSTRAINT `fk_registrations_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `registration_field_values` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `field_id` INT UNSIGNED NOT NULL,
  `value_text` TEXT DEFAULT NULL,
  `value_file_url` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reg_field_value` (`registration_id`, `field_id`),
  CONSTRAINT `fk_reg_field_values_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_field_values_field` FOREIGN KEY (`field_id`) REFERENCES `event_registration_fields`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `registration_waiver_signatures` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `waiver_id` INT UNSIGNED NOT NULL,
  `signed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `device_info` VARCHAR(255) DEFAULT NULL,
  `signature_data` TEXT DEFAULT NULL COMMENT 'Base64 signature image or typed name',
  PRIMARY KEY (`id`),
  KEY `idx_waiver_sigs_registration` (`registration_id`),
  CONSTRAINT `fk_waiver_sigs_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waiver_sigs_waiver` FOREIGN KEY (`waiver_id`) REFERENCES `event_waivers`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `registration_transfers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `from_athlete_id` INT UNSIGNED NOT NULL,
  `to_athlete_id` INT UNSIGNED NOT NULL,
  `transfer_fee_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  `payment_id` INT UNSIGNED DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reg_transfers_registration` (`registration_id`),
  CONSTRAINT `fk_reg_transfers_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_transfers_from` FOREIGN KEY (`from_athlete_id`) REFERENCES `athletes`(`id`),
  CONSTRAINT `fk_reg_transfers_to` FOREIGN KEY (`to_athlete_id`) REFERENCES `athletes`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PAYMENTS (Stripe Connect)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED DEFAULT NULL,
  `athlete_id` INT UNSIGNED NOT NULL,
  `organizer_id` INT UNSIGNED NOT NULL,
  `event_id` INT UNSIGNED DEFAULT NULL,
  `amount_cents` INT UNSIGNED NOT NULL COMMENT 'Total charged to participant',
  `registration_amount_cents` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Portion for organizer (inscription)',
  `service_fee_cents` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Platform service fee',
  `currency` CHAR(3) NOT NULL DEFAULT 'MXN',
  `status` ENUM('pending','processing','succeeded','failed','refunded','partially_refunded') NOT NULL DEFAULT 'pending',
  `provider` ENUM('stripe','mock') NOT NULL DEFAULT 'stripe',
  `stripe_payment_intent_id` VARCHAR(255) DEFAULT NULL,
  `stripe_charge_id` VARCHAR(255) DEFAULT NULL,
  `stripe_transfer_id` VARCHAR(255) DEFAULT NULL COMMENT 'Transfer to organizer Connect account',
  `stripe_application_fee_id` VARCHAR(255) DEFAULT NULL,
  `metadata_json` JSON DEFAULT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payments_registration` (`registration_id`),
  KEY `idx_payments_athlete` (`athlete_id`),
  KEY `idx_payments_organizer` (`organizer_id`),
  KEY `idx_payments_event` (`event_id`),
  KEY `idx_payments_status` (`status`),
  KEY `idx_payments_stripe_pi` (`stripe_payment_intent_id`),
  CONSTRAINT `fk_payments_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`),
  CONSTRAINT `fk_payments_organizer` FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`),
  CONSTRAINT `fk_payments_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `registrations`
  ADD CONSTRAINT `fk_registrations_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL;

ALTER TABLE `registration_transfers`
  ADD CONSTRAINT `fk_reg_transfers_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL;

-- ============================================================================
-- INVOICING (Facturama CFDI — Mexico)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `invoice_requests` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` INT UNSIGNED NOT NULL,
  `athlete_id` INT UNSIGNED NOT NULL,
  `rfc` VARCHAR(13) NOT NULL,
  `legal_name` VARCHAR(255) NOT NULL,
  `tax_regime` VARCHAR(10) NOT NULL,
  `cfdi_use` VARCHAR(10) NOT NULL,
  `postal_code` VARCHAR(10) DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL,
  `status` ENUM('pending','processing','issued','failed') NOT NULL DEFAULT 'pending',
  `organizer_cfdi_uuid` VARCHAR(36) DEFAULT NULL COMMENT 'CFDI for registration (organizer)',
  `platform_cfdi_uuid` VARCHAR(36) DEFAULT NULL COMMENT 'CFDI for service fee (platform)',
  `organizer_pdf_url` VARCHAR(500) DEFAULT NULL,
  `organizer_xml_url` VARCHAR(500) DEFAULT NULL,
  `platform_pdf_url` VARCHAR(500) DEFAULT NULL,
  `platform_xml_url` VARCHAR(500) DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `issued_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_requests_payment` (`payment_id`),
  KEY `idx_invoice_requests_athlete` (`athlete_id`),
  KEY `idx_invoice_requests_status` (`status`),
  CONSTRAINT `fk_invoice_requests_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`),
  CONSTRAINT `fk_invoice_requests_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- RESULTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `event_results` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `registration_id` INT UNSIGNED NOT NULL,
  `event_category_id` INT UNSIGNED NOT NULL,
  `overall_rank` INT UNSIGNED DEFAULT NULL,
  `category_rank` INT UNSIGNED DEFAULT NULL,
  `gender_rank` INT UNSIGNED DEFAULT NULL,
  `finish_time_ms` INT UNSIGNED DEFAULT NULL COMMENT 'Finish time in milliseconds',
  `status` ENUM('finished','dnf','dns','dq') NOT NULL DEFAULT 'finished',
  `pace_per_km_ms` INT UNSIGNED DEFAULT NULL,
  `published_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_results_registration` (`registration_id`),
  KEY `idx_event_results_event` (`event_id`),
  KEY `idx_event_results_category` (`event_category_id`),
  CONSTRAINT `fk_event_results_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_results_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_results_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `result_splits` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `result_id` INT UNSIGNED NOT NULL,
  `split_name` VARCHAR(100) NOT NULL,
  `split_order` INT NOT NULL DEFAULT 0,
  `distance_km` DECIMAL(8,2) DEFAULT NULL,
  `elapsed_ms` INT UNSIGNED NOT NULL COMMENT 'Elapsed time at split in ms',
  `pace_per_km_ms` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_result_splits_result` (`result_id`),
  CONSTRAINT `fk_result_splits_result` FOREIGN KEY (`result_id`) REFERENCES `event_results`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- NOTIFICATIONS & AUDIT
-- ============================================================================
CREATE TABLE IF NOT EXISTS `notification_queue` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipient_type` ENUM('athlete','organizer_member','admin') NOT NULL,
  `recipient_id` INT UNSIGNED NOT NULL,
  `channel` ENUM('email','sms','push') NOT NULL DEFAULT 'email',
  `to_address` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(500) DEFAULT NULL,
  `body` MEDIUMTEXT NOT NULL,
  `status` ENUM('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
  `scheduled_for` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` DATETIME DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,
  `payload_json` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_queue_status` (`status`, `scheduled_for`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_type` ENUM('athlete','organizer_member','admin','system') NOT NULL,
  `actor_id` INT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) DEFAULT NULL,
  `entity_id` INT UNSIGNED DEFAULT NULL,
  `metadata_json` JSON DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_actor` (`actor_type`, `actor_id`),
  KEY `idx_audit_logs_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
