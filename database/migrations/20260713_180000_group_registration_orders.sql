-- Group / family registration orders (multi-ticket checkout)

ALTER TABLE `events`
  ADD COLUMN `max_registrations_per_order` int unsigned NOT NULL DEFAULT 10
  COMMENT 'Max tickets per single checkout (organizer configurable)' AFTER `max_registrations`;

ALTER TABLE `registrations`
  ADD COLUMN `order_id` int unsigned DEFAULT NULL COMMENT 'Group order when purchased with others' AFTER `payment_id`;

ALTER TABLE `registrations`
  ADD COLUMN `purchaser_athlete_id` int unsigned DEFAULT NULL COMMENT 'Who paid (may differ from athlete_id)' AFTER `order_id`;

ALTER TABLE `registrations`
  ADD COLUMN `guest_claim_token` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Guest invite to claim account' AFTER `purchaser_athlete_id`;

ALTER TABLE `registrations`
  ADD KEY `idx_registrations_order` (`order_id`),
  ADD KEY `idx_registrations_purchaser` (`purchaser_athlete_id`),
  ADD UNIQUE KEY `uk_registrations_guest_claim` (`guest_claim_token`);

CREATE TABLE `registration_orders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `public_uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` int unsigned NOT NULL,
  `purchaser_athlete_id` int unsigned NOT NULL,
  `payment_id` int unsigned DEFAULT NULL,
  `status` enum('pending','confirmed','cancelled','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `item_count` tinyint unsigned NOT NULL,
  `subtotal_cents` int unsigned NOT NULL DEFAULT 0,
  `service_fee_cents` int unsigned NOT NULL DEFAULT 0,
  `discount_code_id` int unsigned DEFAULT NULL,
  `discount_amount_cents` int unsigned NOT NULL DEFAULT 0,
  `total_cents` int unsigned NOT NULL DEFAULT 0,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MXN',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_registration_orders_public_uuid` (`public_uuid`),
  KEY `idx_registration_orders_event` (`event_id`),
  KEY `idx_registration_orders_purchaser` (`purchaser_athlete_id`),
  KEY `idx_registration_orders_payment` (`payment_id`),
  CONSTRAINT `fk_registration_orders_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_registration_orders_purchaser` FOREIGN KEY (`purchaser_athlete_id`) REFERENCES `athletes` (`id`),
  CONSTRAINT `fk_registration_orders_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_registration_orders_discount` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `registrations`
  ADD CONSTRAINT `fk_registrations_order` FOREIGN KEY (`order_id`) REFERENCES `registration_orders` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_registrations_purchaser` FOREIGN KEY (`purchaser_athlete_id`) REFERENCES `athletes` (`id`) ON DELETE SET NULL;

CREATE TABLE `waitlist_batches` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `public_uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` int unsigned NOT NULL,
  `purchaser_athlete_id` int unsigned NOT NULL,
  `status` enum('pending','partial','complete','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_waitlist_batches_public_uuid` (`public_uuid`),
  KEY `idx_waitlist_batches_event` (`event_id`),
  KEY `idx_waitlist_batches_purchaser` (`purchaser_athlete_id`),
  CONSTRAINT `fk_waitlist_batches_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waitlist_batches_purchaser` FOREIGN KEY (`purchaser_athlete_id`) REFERENCES `athletes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `waitlist_entries`
  ADD COLUMN `batch_id` int unsigned DEFAULT NULL AFTER `converted_registration_id`,
  ADD COLUMN `participant_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Guest email when not athlete account' AFTER `batch_id`,
  ADD KEY `idx_waitlist_batch` (`batch_id`),
  ADD CONSTRAINT `fk_waitlist_batch` FOREIGN KEY (`batch_id`) REFERENCES `waitlist_batches` (`id`) ON DELETE SET NULL;
