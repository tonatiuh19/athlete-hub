-- Mexico geo catalog for consistent city/state selection and marketplace filters

CREATE TABLE IF NOT EXISTS `geo_states` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `country` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MX',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_geo_states_country_code` (`country`, `code`),
  KEY `idx_geo_states_country_active` (`country`, `is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `geo_cities` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `state_id` int unsigned NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lat` decimal(10,7) DEFAULT NULL,
  `lng` decimal(10,7) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_geo_cities_state_name` (`state_id`, `name`),
  KEY `idx_geo_cities_state_active` (`state_id`, `is_active`),
  CONSTRAINT `fk_geo_cities_state` FOREIGN KEY (`state_id`) REFERENCES `geo_states` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `geo_states` (`country`, `name`, `code`, `sort_order`) VALUES
  ('MX', 'Aguascalientes', 'AGU', 1),
  ('MX', 'Baja California', 'BCN', 2),
  ('MX', 'Baja California Sur', 'BCS', 3),
  ('MX', 'Campeche', 'CAM', 4),
  ('MX', 'Chiapas', 'CHP', 5),
  ('MX', 'Chihuahua', 'CHH', 6),
  ('MX', 'CDMX', 'CMX', 7),
  ('MX', 'Coahuila', 'COA', 8),
  ('MX', 'Colima', 'COL', 9),
  ('MX', 'Durango', 'DUR', 10),
  ('MX', 'Estado de México', 'MEX', 11),
  ('MX', 'Guanajuato', 'GUA', 12),
  ('MX', 'Guerrero', 'GRO', 13),
  ('MX', 'Hidalgo', 'HID', 14),
  ('MX', 'Jalisco', 'JAL', 15),
  ('MX', 'Michoacán', 'MIC', 16),
  ('MX', 'Morelos', 'MOR', 17),
  ('MX', 'Nayarit', 'NAY', 18),
  ('MX', 'Nuevo León', 'NLE', 19),
  ('MX', 'Oaxaca', 'OAX', 20),
  ('MX', 'Puebla', 'PUE', 21),
  ('MX', 'Querétaro', 'QUE', 22),
  ('MX', 'Quintana Roo', 'ROO', 23),
  ('MX', 'San Luis Potosí', 'SLP', 24),
  ('MX', 'Sinaloa', 'SIN', 25),
  ('MX', 'Sonora', 'SON', 26),
  ('MX', 'Tabasco', 'TAB', 27),
  ('MX', 'Tamaulipas', 'TAM', 28),
  ('MX', 'Tlaxcala', 'TLA', 29),
  ('MX', 'Veracruz', 'VER', 30),
  ('MX', 'Yucatán', 'YUC', 31),
  ('MX', 'Zacatecas', 'ZAC', 32)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `sort_order` = VALUES(`sort_order`);

INSERT INTO `geo_cities` (`state_id`, `name`, `lat`, `lng`)
SELECT s.id, c.city, c.lat, c.lng
FROM (
  SELECT 'CMX' AS state_code, 'Ciudad de México' AS city, 19.4326000 AS lat, -99.1332000 AS lng UNION ALL
  SELECT 'MEX', 'Toluca', 19.2826000, -99.6557000 UNION ALL
  SELECT 'MEX', 'Naucalpan de Juárez', 19.4785000, -99.2396000 UNION ALL
  SELECT 'MEX', 'Ecatepec', 19.6018000, -99.0507000 UNION ALL
  SELECT 'JAL', 'Guadalajara', 20.6597000, -103.3496000 UNION ALL
  SELECT 'JAL', 'Zapopan', 20.7214000, -103.3918000 UNION ALL
  SELECT 'JAL', 'Lagos de Moreno', 21.3569000, -101.9294000 UNION ALL
  SELECT 'JAL', 'Puerto Vallarta', 20.6534000, -105.2253000 UNION ALL
  SELECT 'NLE', 'Monterrey', 25.6866000, -100.3161000 UNION ALL
  SELECT 'NLE', 'San Pedro Garza García', 25.6573000, -100.4027000 UNION ALL
  SELECT 'GRO', 'Acapulco', 16.7021000, -99.9236000 UNION ALL
  SELECT 'GRO', 'Taxco', 18.5563000, -99.6058000 UNION ALL
  SELECT 'ROO', 'Cancún', 21.1619000, -86.8515000 UNION ALL
  SELECT 'ROO', 'Playa del Carmen', 20.6296000, -87.0739000 UNION ALL
  SELECT 'ROO', 'Tulum', 20.2114000, -87.4654000 UNION ALL
  SELECT 'PUE', 'Puebla', 19.0414000, -98.2063000 UNION ALL
  SELECT 'PUE', 'Cholula', 19.0631000, -98.3035000 UNION ALL
  SELECT 'QUE', 'Querétaro', 20.5888000, -100.3899000 UNION ALL
  SELECT 'GUA', 'León', 21.1250000, -101.6860000 UNION ALL
  SELECT 'GUA', 'Guanajuato', 21.0190000, -101.2574000 UNION ALL
  SELECT 'GUA', 'San Miguel de Allende', 20.9144000, -100.7452000 UNION ALL
  SELECT 'BCN', 'Tijuana', 32.5149000, -117.0382000 UNION ALL
  SELECT 'BCN', 'Mexicali', 32.6245000, -115.4523000 UNION ALL
  SELECT 'BCN', 'Ensenada', 31.8667000, -116.5964000 UNION ALL
  SELECT 'SON', 'Hermosillo', 29.0729000, -110.9559000 UNION ALL
  SELECT 'CHH', 'Chihuahua', 28.6353000, -106.0889000 UNION ALL
  SELECT 'CHH', 'Ciudad Juárez', 31.6904000, -106.4245000 UNION ALL
  SELECT 'VER', 'Veracruz', 19.1738000, -96.1342000 UNION ALL
  SELECT 'VER', 'Xalapa', 19.5438000, -96.9102000 UNION ALL
  SELECT 'OAX', 'Oaxaca', 17.0732000, -96.7266000 UNION ALL
  SELECT 'YUC', 'Mérida', 20.9674000, -89.5926000 UNION ALL
  SELECT 'MIC', 'Morelia', 19.7008000, -101.1844000 UNION ALL
  SELECT 'COA', 'Saltillo', 25.4382000, -100.9737000 UNION ALL
  SELECT 'COA', 'Torreón', 25.5428000, -103.4068000 UNION ALL
  SELECT 'SIN', 'Culiacán', 24.8091000, -107.3940000 UNION ALL
  SELECT 'SIN', 'Mazatlán', 23.2494000, -106.4111000 UNION ALL
  SELECT 'AGU', 'Aguascalientes', 21.8853000, -102.2916000 UNION ALL
  SELECT 'SLP', 'San Luis Potosí', 22.1565000, -100.9855000 UNION ALL
  SELECT 'TAM', 'Tampico', 22.2551000, -97.8686000 UNION ALL
  SELECT 'TAB', 'Villahermosa', 17.9892000, -92.9475000 UNION ALL
  SELECT 'COL', 'Colima', 19.2452000, -103.7241000 UNION ALL
  SELECT 'MOR', 'Cuernavaca', 18.9186000, -99.2342000 UNION ALL
  SELECT 'NAY', 'Tepic', 21.5085000, -104.8956000 UNION ALL
  SELECT 'BCS', 'La Paz', 24.1426000, -110.3128000 UNION ALL
  SELECT 'BCS', 'Los Cabos', 23.0596000, -109.6977000 UNION ALL
  SELECT 'CAM', 'Campeche', 19.8301000, -90.5349000 UNION ALL
  SELECT 'CHP', 'San Cristóbal de las Casas', 16.7370000, -92.6376000 UNION ALL
  SELECT 'CHP', 'Tuxtla Gutiérrez', 16.7519000, -93.1167000 UNION ALL
  SELECT 'DUR', 'Durango', 24.0277000, -104.6532000 UNION ALL
  SELECT 'HID', 'Pachuca', 20.1011000, -98.7591000 UNION ALL
  SELECT 'TLA', 'Tlaxcala', 19.3139000, -98.2404000 UNION ALL
  SELECT 'ZAC', 'Zacatecas', 22.7709000, -102.5832000
) AS c
JOIN `geo_states` s ON s.country = 'MX' AND s.code COLLATE utf8mb4_unicode_ci = c.state_code
ON DUPLICATE KEY UPDATE `lat` = VALUES(`lat`), `lng` = VALUES(`lng`);
