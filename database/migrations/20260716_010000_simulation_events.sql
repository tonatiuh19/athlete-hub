-- Simulation events: organizer Stripe test-kit dry-runs (no Connect, not published).
-- TiDB / MySQL 8 compatible — one ALTER per statement where needed.

ALTER TABLE `events`
  ADD COLUMN `is_simulation` tinyint(1) NOT NULL DEFAULT 0
    COMMENT '1 = organizer simulation; never marketplace-listed'
    AFTER `bib_mode`;

ALTER TABLE `events`
  ADD COLUMN `simulation_access_token` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL
    COMMENT 'Opaque token for gated sim checkout URL'
    AFTER `is_simulation`;

ALTER TABLE `events`
  ADD COLUMN `simulation_expires_at` datetime DEFAULT NULL
    COMMENT 'Wipe generated data after this (3d from last activity)'
    AFTER `simulation_access_token`;

ALTER TABLE `events`
  ADD COLUMN `simulation_last_activity_at` datetime DEFAULT NULL
    COMMENT 'Last checkout/reg/reset activity'
    AFTER `simulation_expires_at`;

ALTER TABLE `events`
  ADD COLUMN `cloned_from_event_id` int unsigned DEFAULT NULL
    COMMENT 'Source event when cloned into a simulation'
    AFTER `simulation_last_activity_at`;

ALTER TABLE `events`
  ADD KEY `idx_events_simulation_expiry` (`is_simulation`, `simulation_expires_at`);

ALTER TABLE `events`
  ADD UNIQUE KEY `uk_events_simulation_token` (`simulation_access_token`);

ALTER TABLE `registrations`
  ADD COLUMN `is_simulation` tinyint(1) NOT NULL DEFAULT 0 AFTER `deleted_at`;

ALTER TABLE `registrations`
  ADD KEY `idx_registrations_simulation` (`is_simulation`, `event_id`);

ALTER TABLE `payments`
  ADD COLUMN `is_simulation` tinyint(1) NOT NULL DEFAULT 0 AFTER `updated_at`;

ALTER TABLE `payments`
  ADD KEY `idx_payments_simulation` (`is_simulation`, `event_id`);

ALTER TABLE `registration_orders`
  ADD COLUMN `is_simulation` tinyint(1) NOT NULL DEFAULT 0 AFTER `updated_at`;

ALTER TABLE `athletes`
  ADD COLUMN `is_simulation` tinyint(1) NOT NULL DEFAULT 0
    COMMENT 'Throwaway sim athlete (safe to wipe if no live regs)'
    AFTER `deleted_at`;
