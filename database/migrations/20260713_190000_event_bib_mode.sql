-- Event policy: folio number is also the race bib (dorsal), or kept separate.
-- New events default to folio; existing rows are set to separate to preserve current ops.

ALTER TABLE `events`
  ADD COLUMN `bib_mode` enum('folio','separate') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'folio'
    COMMENT 'folio: registration_number is also bib_number at checkout; separate: staff assigns bib later'
    AFTER `max_registrations_per_order`;

UPDATE `events` SET `bib_mode` = 'separate' WHERE `deleted_at` IS NULL OR `deleted_at` IS NOT NULL;

-- Align bib length with folio so folio-as-bib copy does not truncate.
ALTER TABLE `registrations`
  MODIFY COLUMN `bib_number` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL;
