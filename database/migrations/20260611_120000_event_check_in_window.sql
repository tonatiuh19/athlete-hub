-- Per-event QR check-in window (wall time in event timezone).
-- When both NULL, window is derived from event start/end dates on save and at runtime.

ALTER TABLE `events`
  ADD COLUMN `check_in_opens_at` datetime DEFAULT NULL,
  ADD COLUMN `check_in_closes_at` datetime DEFAULT NULL;
