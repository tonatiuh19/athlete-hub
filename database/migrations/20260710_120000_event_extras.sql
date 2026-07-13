-- Event registration add-ons (merch, folios, services) + athlete selections at checkout.

CREATE TABLE IF NOT EXISTS `event_extras` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `public_uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` int unsigned NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_cents` int unsigned NOT NULL DEFAULT '0' COMMENT 'IVA included MXN cents',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MXN',
  `image_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extra_type` enum('merch','addon','folio','service','experience','custom') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'custom',
  `max_per_athlete` tinyint unsigned NOT NULL DEFAULT '1',
  `capacity` int unsigned DEFAULT NULL,
  `sold_count` int unsigned NOT NULL DEFAULT '0',
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_extras_public_uuid` (`public_uuid`),
  KEY `idx_event_extras_event` (`event_id`),
  KEY `idx_event_extras_active` (`event_id`,`is_active`,`sort_order`),
  CONSTRAINT `fk_event_extras_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `registration_extras` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `registration_id` int unsigned NOT NULL,
  `event_extra_id` int unsigned NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` tinyint unsigned NOT NULL DEFAULT '1',
  `unit_price_cents` int unsigned NOT NULL,
  `total_cents` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_registration_extras_registration` (`registration_id`),
  KEY `idx_registration_extras_extra` (`event_extra_id`),
  CONSTRAINT `fk_registration_extras_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_registration_extras_extra` FOREIGN KEY (`event_extra_id`) REFERENCES `event_extras` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
