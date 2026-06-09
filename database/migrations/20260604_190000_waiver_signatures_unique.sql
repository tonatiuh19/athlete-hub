-- Prevent duplicate waiver signature rows per registration
ALTER TABLE `registration_waiver_signatures`
  ADD UNIQUE KEY `uk_waiver_sig_registration_waiver` (`registration_id`, `waiver_id`);
