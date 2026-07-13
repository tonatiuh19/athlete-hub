-- Event extras: category scope, sales window, per-extra athlete fields, answer storage

ALTER TABLE `event_extras`
  ADD COLUMN `scope_type` enum('all_categories','selected_categories') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all_categories' AFTER `is_active`;

ALTER TABLE `event_extras`
  ADD COLUMN `sales_opens_at` datetime DEFAULT NULL AFTER `scope_type`;

ALTER TABLE `event_extras`
  ADD COLUMN `sales_closes_at` datetime DEFAULT NULL AFTER `sales_opens_at`;

CREATE TABLE IF NOT EXISTS `event_extra_categories` (
  `event_extra_id` int unsigned NOT NULL,
  `event_category_id` int unsigned NOT NULL,
  PRIMARY KEY (`event_extra_id`,`event_category_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_event_extra_categories_category` (`event_category_id`),
  CONSTRAINT `fk_event_extra_categories_extra` FOREIGN KEY (`event_extra_id`) REFERENCES `event_extras` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_extra_categories_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_extra_fields` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_extra_id` int unsigned NOT NULL,
  `field_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `field_type` enum('text','textarea','select','checkbox','number','date') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `field_kind` enum('standard','mx_shipping_block') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standard',
  `options_json` json DEFAULT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uk_event_extra_field_key` (`event_extra_id`,`field_key`),
  KEY `idx_event_extra_fields_extra` (`event_extra_id`,`sort_order`),
  CONSTRAINT `fk_event_extra_fields_extra` FOREIGN KEY (`event_extra_id`) REFERENCES `event_extras` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `registration_extra_field_values` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `registration_extra_id` int unsigned NOT NULL,
  `field_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_text` text COLLATE utf8mb4_unicode_ci,
  `value_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_reg_extra_field_values_line` (`registration_extra_id`),
  CONSTRAINT `fk_reg_extra_field_values_line` FOREIGN KEY (`registration_extra_id`) REFERENCES `registration_extras` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
