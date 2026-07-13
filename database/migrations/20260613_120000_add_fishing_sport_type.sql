-- Add fishing sport type (inactive by default until product is ready).
-- Safe to re-run.

INSERT INTO `sport_types` (`slug`, `name`, `description`, `sort_order`, `is_active`) VALUES
  ('fishing', 'Fishing', 'Sport fishing tournaments, derbies, and catch-and-release events', 9, 0)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
