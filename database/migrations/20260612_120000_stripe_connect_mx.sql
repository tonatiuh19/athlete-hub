-- Stripe Connect MX: organizer payout status + Triboo pre-checklist fields

ALTER TABLE `organizers`
  ADD COLUMN `stripe_connect_status` ENUM(
    'not_started','pending','action_required','ready','restricted','disabled'
  ) NOT NULL DEFAULT 'not_started' AFTER `stripe_onboarding_complete`;

ALTER TABLE `organizers`
  ADD COLUMN `stripe_charges_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `stripe_connect_status`;

ALTER TABLE `organizers`
  ADD COLUMN `stripe_payouts_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `stripe_charges_enabled`;

ALTER TABLE `organizers`
  ADD COLUMN `stripe_details_submitted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `stripe_payouts_enabled`;

ALTER TABLE `organizers`
  ADD COLUMN `stripe_connect_onboarded_at` DATETIME DEFAULT NULL AFTER `stripe_details_submitted`;

ALTER TABLE `organizers`
  ADD COLUMN `stripe_connect_last_synced_at` DATETIME DEFAULT NULL AFTER `stripe_connect_onboarded_at`;

ALTER TABLE `organizers`
  ADD COLUMN `stripe_connect_onboarding_mode` ENUM('self','admin') DEFAULT NULL AFTER `stripe_connect_last_synced_at`;

ALTER TABLE `organizers`
  ADD COLUMN `payout_terms_accepted_at` DATETIME DEFAULT NULL AFTER `stripe_connect_onboarding_mode`;

ALTER TABLE `organizers`
  ADD COLUMN `payout_fee_acknowledged_at` DATETIME DEFAULT NULL AFTER `payout_terms_accepted_at`;

UPDATE `organizers`
SET
  `stripe_connect_status` = 'ready',
  `stripe_charges_enabled` = 1,
  `stripe_payouts_enabled` = 1,
  `stripe_details_submitted` = 1,
  `stripe_connect_onboarded_at` = COALESCE(`stripe_connect_onboarded_at`, NOW())
WHERE `stripe_onboarding_complete` = 1 AND `stripe_account_id` IS NOT NULL;

UPDATE `organizers`
SET `stripe_connect_status` = 'pending'
WHERE `stripe_account_id` IS NOT NULL
  AND `stripe_onboarding_complete` = 0
  AND `stripe_connect_status` = 'not_started';
