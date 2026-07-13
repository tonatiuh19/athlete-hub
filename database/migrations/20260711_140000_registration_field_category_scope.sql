-- Registration fields: category scope (all vs selected categories)

ALTER TABLE `event_registration_fields`
  ADD COLUMN `scope_type` enum('all_categories','selected_categories') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all_categories' AFTER `is_active`;

CREATE TABLE IF NOT EXISTS `event_registration_field_categories` (
  `event_registration_field_id` int unsigned NOT NULL,
  `event_category_id` int unsigned NOT NULL,
  PRIMARY KEY (`event_registration_field_id`,`event_category_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_event_reg_field_categories_category` (`event_category_id`),
  CONSTRAINT `fk_event_reg_field_categories_field` FOREIGN KEY (`event_registration_field_id`) REFERENCES `event_registration_fields` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_reg_field_categories_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
