-- Add preferred_language to staff tables (matches athletes default: es)
ALTER TABLE `admins`
  ADD COLUMN `preferred_language` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'es' AFTER `avatar_url`;

ALTER TABLE `organizer_members`
  ADD COLUMN `preferred_language` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'es' AFTER `avatar_url`;
