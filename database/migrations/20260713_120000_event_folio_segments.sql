-- Custom registration folio segments per event (category + coupon rules, pattern builder).

CREATE TABLE IF NOT EXISTS `event_folio_segments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `category_scope` enum('all_categories','selected_categories') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all_categories',
  `coupon_scope` enum('any','none','any_coupon','specific_coupon') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'any',
  `discount_code_id` int unsigned DEFAULT NULL,
  `counter_scope` enum('segment','event','category') COLLATE utf8mb4_unicode_ci NOT NULL,
  `prefix_value` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `category_code` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pattern_tokens` json NOT NULL,
  `seq_padding` tinyint unsigned NOT NULL DEFAULT 5,
  `start_number` int unsigned NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_folio_segments_event` (`event_id`,`sort_order`),
  KEY `fk_folio_segments_discount` (`discount_code_id`),
  CONSTRAINT `fk_folio_segments_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_folio_segments_discount` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_folio_segment_categories` (
  `folio_segment_id` int unsigned NOT NULL,
  `event_category_id` int unsigned NOT NULL,
  PRIMARY KEY (`folio_segment_id`,`event_category_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_folio_seg_cat_category` (`event_category_id`),
  CONSTRAINT `fk_folio_seg_cat_segment` FOREIGN KEY (`folio_segment_id`) REFERENCES `event_folio_segments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_folio_seg_cat_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_folio_counters` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `counter_scope` enum('segment','event','category') COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_issued_number` int unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uk_folio_counter` (`event_id`,`counter_scope`,`scope_key`),
  CONSTRAINT `fk_folio_counters_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `registrations`
  ADD COLUMN `folio_segment_id` int unsigned DEFAULT NULL AFTER `registration_number`;

ALTER TABLE `registrations`
  ADD KEY `fk_registrations_folio_segment` (`folio_segment_id`);

ALTER TABLE `registrations`
  ADD CONSTRAINT `fk_registrations_folio_segment` FOREIGN KEY (`folio_segment_id`) REFERENCES `event_folio_segments` (`id`) ON DELETE SET NULL;
