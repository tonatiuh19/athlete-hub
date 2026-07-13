-- Manual sales (no platform commission) + organizer seller role.

ALTER TABLE `organizer_members`
  MODIFY COLUMN `role` enum(
    'owner','organizer','marketing','finance','timing','operations','sponsor','seller'
  ) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'organizer';

ALTER TABLE `payments`
  MODIFY COLUMN `provider` enum('stripe','mock','manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'stripe';

ALTER TABLE `payments`
  ADD COLUMN `recorded_by_member_id` int unsigned DEFAULT NULL AFTER `provider`;

ALTER TABLE `payments`
  ADD KEY `fk_payments_recorded_by_member` (`recorded_by_member_id`);

ALTER TABLE `payments`
  ADD CONSTRAINT `fk_payments_recorded_by_member` FOREIGN KEY (`recorded_by_member_id`) REFERENCES `organizer_members` (`id`) ON DELETE SET NULL;
