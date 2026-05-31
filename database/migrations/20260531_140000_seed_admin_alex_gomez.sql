-- Seed primary platform admin: Alex Gomez
INSERT INTO `admins` (`public_uuid`, `email`, `first_name`, `last_name`, `role`, `status`)
VALUES (
  UUID(),
  'alex@disruptinglabs.com',
  'Alex',
  'Gomez',
  'super_admin',
  'active'
)
ON DUPLICATE KEY UPDATE
  `first_name` = VALUES(`first_name`),
  `last_name` = VALUES(`last_name`),
  `role` = VALUES(`role`),
  `status` = VALUES(`status`),
  `deleted_at` = NULL;
