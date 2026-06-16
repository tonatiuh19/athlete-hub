-- INEGI Marco Geoestadístico: catalog columns for all MX municipios
-- Split ALTERs for TiDB compatibility.

ALTER TABLE `geo_cities`
  ADD COLUMN `cvegeo` char(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `name`;

ALTER TABLE `geo_cities`
  ADD COLUMN `cve_ent` char(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `cvegeo`;

ALTER TABLE `geo_cities`
  ADD COLUMN `cve_mun` char(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `cve_ent`;

ALTER TABLE `geo_cities`
  ADD COLUMN `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'seed' AFTER `lng`;

ALTER TABLE `geo_cities`
  ADD UNIQUE KEY `uk_geo_cities_cvegeo` (`cvegeo`);

ALTER TABLE `geo_cities`
  ADD KEY `idx_geo_cities_source` (`source`);
