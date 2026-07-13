-- Temporarily hide fishing from marketplace filters and event creation.
-- Safe to re-run.

UPDATE `sport_types`
SET `is_active` = 0
WHERE `slug` = 'fishing';
