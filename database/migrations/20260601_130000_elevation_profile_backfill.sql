-- Backfill elevation_profile_json for DBs created from event_courses migration before column was added.
-- Safe to run once; ignore ER_DUP_FIELDNAME if column already exists.

ALTER TABLE `event_courses`
  ADD COLUMN `elevation_profile_json` JSON DEFAULT NULL COMMENT 'Array of {km, elevation_m}' AFTER `elevation_gain_m`;
