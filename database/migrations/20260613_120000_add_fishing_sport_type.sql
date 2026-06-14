-- Add fishing as an active sport type for event creation and marketplace filters.
-- Safe to re-run.

INSERT INTO `sport_types` (`slug`, `name`, `description`, `sort_order`, `is_active`) VALUES
  ('fishing', 'Fishing', 'Sport fishing tournaments, derbies, and catch-and-release events', 9, 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
