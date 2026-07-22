-- Mercado Pago payout rail (org-level OAuth + checkout provider)
-- TiDB / MySQL 8 compatible

ALTER TABLE `organizers`
  ADD COLUMN `payout_rail` ENUM('stripe','mercadopago') NOT NULL DEFAULT 'stripe'
    COMMENT 'Preferred checkout/payout rail';

ALTER TABLE `organizers`
  ADD COLUMN `mp_user_id` VARCHAR(64) DEFAULT NULL,
  ADD COLUMN `mp_access_token_enc` TEXT DEFAULT NULL,
  ADD COLUMN `mp_refresh_token_enc` TEXT DEFAULT NULL,
  ADD COLUMN `mp_token_expires_at` DATETIME DEFAULT NULL,
  ADD COLUMN `mp_public_key` VARCHAR(255) DEFAULT NULL,
  ADD COLUMN `mp_oauth_status` ENUM('not_started','pending','ready','revoked','error') NOT NULL DEFAULT 'not_started',
  ADD COLUMN `mp_oauth_connected_at` DATETIME DEFAULT NULL,
  ADD COLUMN `mp_oauth_last_synced_at` DATETIME DEFAULT NULL;

ALTER TABLE `payments`
  MODIFY COLUMN `provider` ENUM('stripe','mock','manual','mercadopago') NOT NULL DEFAULT 'stripe';

ALTER TABLE `payments`
  ADD COLUMN `mercadopago_payment_id` VARCHAR(64) DEFAULT NULL,
  ADD COLUMN `mercadopago_preference_id` VARCHAR(64) DEFAULT NULL;

ALTER TABLE `payments`
  ADD KEY `idx_payments_mp_payment` (`mercadopago_payment_id`),
  ADD KEY `idx_payments_mp_preference` (`mercadopago_preference_id`);

ALTER TABLE `payment_refunds`
  MODIFY COLUMN `provider` ENUM('stripe','mock','mercadopago') NOT NULL DEFAULT 'stripe';

ALTER TABLE `payment_refunds`
  ADD COLUMN `mercadopago_refund_id` VARCHAR(64) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `mercadopago_webhook_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `mp_event_id` VARCHAR(128) NOT NULL,
  `topic` VARCHAR(64) DEFAULT NULL,
  `action` VARCHAR(64) DEFAULT NULL,
  `payload_json` JSON DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mp_webhook_event` (`mp_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
