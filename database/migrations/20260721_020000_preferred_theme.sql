-- Persist UI color theme preference (light | dark | system) on user profiles
ALTER TABLE `athletes`
  ADD COLUMN `preferred_theme` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system'
  COMMENT 'UI theme: light | dark | system'
  AFTER `preferred_language`;

ALTER TABLE `admins`
  ADD COLUMN `preferred_theme` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system'
  COMMENT 'UI theme: light | dark | system'
  AFTER `preferred_language`;

ALTER TABLE `organizer_members`
  ADD COLUMN `preferred_theme` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system'
  COMMENT 'UI theme: light | dark | system'
  AFTER `preferred_language`;
