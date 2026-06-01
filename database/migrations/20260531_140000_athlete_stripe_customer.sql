-- Athlete Stripe customer for saved payment methods
ALTER TABLE `athletes`
  ADD COLUMN `stripe_customer_id` VARCHAR(255) DEFAULT NULL COMMENT 'Stripe Customer ID for saved cards';

ALTER TABLE `athletes`
  ADD KEY `idx_athletes_stripe_customer` (`stripe_customer_id`);
