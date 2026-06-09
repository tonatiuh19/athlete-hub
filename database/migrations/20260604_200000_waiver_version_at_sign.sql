-- Store waiver version at time of athlete signature (re-sign detection)
ALTER TABLE `registration_waiver_signatures`
  ADD COLUMN `waiver_version_at_sign` int unsigned DEFAULT NULL AFTER `waiver_id`;

-- Legacy rows: assume version 1 at sign time
UPDATE `registration_waiver_signatures`
SET `waiver_version_at_sign` = 1
WHERE `waiver_version_at_sign` IS NULL;
