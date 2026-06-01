-- Per-member event access scope (optional subset of org events)
ALTER TABLE `organizer_members`
  ADD COLUMN `event_access_scope` ENUM('organization','events') NOT NULL DEFAULT 'organization'
  AFTER `role`;

CREATE TABLE IF NOT EXISTS `organizer_member_events` (
  `organizer_member_id` int unsigned NOT NULL,
  `event_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`organizer_member_id`, `event_id`),
  KEY `idx_organizer_member_events_event` (`event_id`),
  CONSTRAINT `fk_organizer_member_events_member` FOREIGN KEY (`organizer_member_id`) REFERENCES `organizer_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_organizer_member_events_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
