-- Extend avatar_url to store optimized data URLs (avatar upload)
ALTER TABLE `athletes`
  MODIFY COLUMN `avatar_url` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL;
