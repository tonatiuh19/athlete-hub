-- Allow homonymous municipio names within the same state (Oaxaca has 2 pairs).
-- Canonical identity is cvegeo (uk_geo_cities_cvegeo).

ALTER TABLE `geo_cities`
  DROP INDEX `uk_geo_cities_state_name`;

ALTER TABLE `geo_cities`
  ADD KEY `idx_geo_cities_state_name` (`state_id`, `name`);
