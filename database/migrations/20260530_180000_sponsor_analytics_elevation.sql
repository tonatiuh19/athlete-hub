-- Sponsor analytics events (elevation_profile_json lives on event_courses via 160000 migration)

CREATE TABLE IF NOT EXISTS `sponsor_analytics_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_sponsor_id` int unsigned NOT NULL,
  `event_id` int unsigned NOT NULL,
  `event_type` enum('impression','click') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sponsor_analytics_sponsor` (`event_sponsor_id`,`event_type`),
  KEY `idx_sponsor_analytics_event` (`event_id`),
  CONSTRAINT `fk_sponsor_analytics_sponsor` FOREIGN KEY (`event_sponsor_id`) REFERENCES `event_sponsors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sponsor_analytics_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
