-- Event course routes and aid stations (GeoJSON + points JSON)
CREATE TABLE IF NOT EXISTS `event_courses` (
  `event_id` int unsigned NOT NULL,
  `route_geojson` json NOT NULL COMMENT 'GeoJSON LineString or Feature',
  `points_json` json NOT NULL COMMENT 'Array of {type,name,lat,lng,km,description}',
  `distance_km` decimal(8,3) DEFAULT NULL,
  `elevation_gain_m` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  CONSTRAINT `fk_event_courses_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Maratón CDMX 2026 — simplified Reforma loop
INSERT INTO `event_courses` (`event_id`, `route_geojson`, `points_json`, `distance_km`, `elevation_gain_m`)
SELECT e.id,
  JSON_OBJECT(
    'type', 'LineString',
    'coordinates', JSON_ARRAY(
      JSON_ARRAY(-99.1332, 19.4326),
      JSON_ARRAY(-99.1520, 19.4270),
      JSON_ARRAY(-99.1670, 19.4240),
      JSON_ARRAY(-99.1800, 19.4210),
      JSON_ARRAY(-99.1950, 19.4200),
      JSON_ARRAY(-99.2100, 19.4150),
      JSON_ARRAY(-99.2000, 19.4080),
      JSON_ARRAY(-99.1750, 19.4100),
      JSON_ARRAY(-99.1520, 19.4180),
      JSON_ARRAY(-99.1332, 19.4326)
    )
  ),
  JSON_ARRAY(
    JSON_OBJECT('type', 'start', 'name', 'Salida Zócalo', 'lat', 19.4326, 'lng', -99.1332, 'km', 0, 'description', 'Calentamiento y zona de corral'),
    JSON_OBJECT('type', 'hydration', 'name', 'Hidratación Km 5', 'lat', 19.4270, 'lng', -99.1520, 'km', 5, 'description', 'Agua, electrolitos y fruta'),
    JSON_OBJECT('type', 'hydration', 'name', 'Hidratación Km 10', 'lat', 19.4240, 'lng', -99.1670, 'km', 10, 'description', 'Agua y geles'),
    JSON_OBJECT('type', 'aid', 'name', 'Av. Reforma', 'lat', 19.4210, 'lng', -99.1800, 'km', 15, 'description', 'Punto de apoyo médico'),
    JSON_OBJECT('type', 'hydration', 'name', 'Hidratación Km 21', 'lat', 19.4200, 'lng', -99.1950, 'km', 21, 'description', 'Media maratón — hidratación completa'),
    JSON_OBJECT('type', 'hydration', 'name', 'Hidratación Km 30', 'lat', 19.4150, 'lng', -99.2100, 'km', 30, 'description', 'Agua, electrolitos, hielo'),
    JSON_OBJECT('type', 'hydration', 'name', 'Hidratación Km 35', 'lat', 19.4080, 'lng', -99.2000, 'km', 35, 'description', 'Última estación antes de meta'),
    JSON_OBJECT('type', 'finish', 'name', 'Meta Zócalo', 'lat', 19.4326, 'lng', -99.1332, 'km', 42.195, 'description', 'Medalla finisher y zona de recuperación')
  ),
  42.195,
  180
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
ON DUPLICATE KEY UPDATE
  `route_geojson` = VALUES(`route_geojson`),
  `points_json` = VALUES(`points_json`);

-- Trail Nevado — shorter mountain loop
INSERT INTO `event_courses` (`event_id`, `route_geojson`, `points_json`, `distance_km`, `elevation_gain_m`)
SELECT e.id,
  JSON_OBJECT(
    'type', 'LineString',
    'coordinates', JSON_ARRAY(
      JSON_ARRAY(-99.7570, 19.1220),
      JSON_ARRAY(-99.7620, 19.1280),
      JSON_ARRAY(-99.7680, 19.1350),
      JSON_ARRAY(-99.7720, 19.1420),
      JSON_ARRAY(-99.7650, 19.1480),
      JSON_ARRAY(-99.7570, 19.1220)
    )
  ),
  JSON_ARRAY(
    JSON_OBJECT('type', 'start', 'name', 'Base Nevado', 'lat', 19.1220, 'lng', -99.7570, 'km', 0, 'description', 'Briefing y salida'),
    JSON_OBJECT('type', 'hydration', 'name', 'Km 7', 'lat', 19.1280, 'lng', -99.7620, 'km', 7, 'description', 'Agua y electrolitos'),
    JSON_OBJECT('type', 'aid', 'name', 'Km 14', 'lat', 19.1350, 'lng', -99.7680, 'km', 14, 'description', 'Apoyo médico montaña'),
    JSON_OBJECT('type', 'hydration', 'name', 'Km 18', 'lat', 19.1420, 'lng', -99.7720, 'km', 18, 'description', 'Última hidratación'),
    JSON_OBJECT('type', 'finish', 'name', 'Meta', 'lat', 19.1220, 'lng', -99.7570, 'km', 21, 'description', 'Premiación por categoría')
  ),
  21.000,
  1200
FROM events e WHERE e.slug = 'trail-nevado-toluca-2026'
ON DUPLICATE KEY UPDATE
  `route_geojson` = VALUES(`route_geojson`),
  `points_json` = VALUES(`points_json`);
