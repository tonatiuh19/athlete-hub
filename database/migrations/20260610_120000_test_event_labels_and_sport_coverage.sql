-- Mark demo events as test events and add mock events for missing sport types
-- (cycling, ocr, fitness, virtual). Safe to re-run.

-- ============================================================================
-- TEST EVENT LABEL on existing mock events
-- ============================================================================
UPDATE `events` SET `title` = CONCAT(`title`, ' (Test Event)')
WHERE `slug` IN (
  'maraton-cdmx-2026',
  'trail-nevado-toluca-2026',
  'triatlon-acapulco-2026',
  'carrera-10k-polanco-2026',
  'hyrox-mexico-city-2025'
)
AND `title` NOT LIKE '%(Test Event)%';

-- ============================================================================
-- VENUE (Guadalajara — cycling)
-- ============================================================================
INSERT INTO `venues` (`public_uuid`, `name`, `address_line1`, `city`, `state`, `country`, `lat`, `lng`, `timezone`) VALUES
  ('v0000006-0000-4000-8000-000000000006', 'Circuito Metropolitano Guadalajara', 'Av. Vallarta 4050', 'Guadalajara', 'Jalisco', 'MX', 20.6736000, -103.4370000, 'America/Mexico_City')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================================================
-- NEW TEST EVENTS — one per missing sport type
-- ============================================================================
INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`, `featured`,
  `start_date`, `end_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_address`, `location_city`, `location_state`,
  `location_country`, `location_lat`, `location_lng`,
  `hero_image_url`, `banner_image_url`, `requires_waiver`, `max_registrations`,
  `registration_count`, `search_keywords`
)
SELECT
  'ev000006-0000-4000-8000-000000000006', o.id, st.id, v.id,
  'gran-fondo-guadalajara-2026',
  'Gran Fondo Guadalajara 2026 (Test Event)',
  'Rodada de resistencia con opciones 80K y 40K en circuito cerrado.',
  '<p>Evento de demostración para ciclismo de ruta. Incluye chip timing, puntos de hidratación y categorías por edad.</p>',
  'published', 'public', 0,
  '2026-09-20 07:00:00', '2026-09-20 16:00:00',
  '2026-01-01 00:00:00', '2026-09-15 23:59:59',
  'America/Mexico_City',
  v.name, v.address_line1, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80&auto=format&fit=crop',
  1, 2500, 0,
  'ciclismo gran fondo 80k 40k ruta guadalajara test'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'pacific-endurance' AND st.slug = 'cycling' AND v.public_uuid = 'v0000006-0000-4000-8000-000000000006'
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `short_description` = VALUES(`short_description`),
  `description` = VALUES(`description`),
  `status` = 'published';

INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`, `featured`,
  `start_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_address`, `location_city`, `location_state`,
  `location_country`, `location_lat`, `location_lng`,
  `hero_image_url`, `requires_waiver`, `max_registrations`, `registration_count`, `search_keywords`
)
SELECT
  'ev000007-0000-4000-8000-000000000007', o.id, st.id, v.id,
  'ocr-bosque-chapultepec-2026',
  'Carrera de Obstáculos Bosque 2026 (Test Event)',
  'OCR urbano con distancias Sprint y Beast en parque.',
  '<p>Evento de demostración para OCR / Spartan. Obstáculos técnicos, categorías por género y relevos en pareja.</p>',
  'published', 'public', 0,
  '2026-07-05 08:00:00', '2026-02-01 00:00:00', '2026-07-01 23:59:59',
  'America/Mexico_City',
  v.name, v.address_line1, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80&auto=format&fit=crop',
  1, 3000, 0,
  'ocr obstaculos spartan sprint beast test'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'run-mexico' AND st.slug = 'ocr' AND v.public_uuid = 'v0000004-0000-4000-8000-000000000004'
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `short_description` = VALUES(`short_description`),
  `description` = VALUES(`description`),
  `status` = 'published';

INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`, `featured`,
  `start_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_city`, `location_state`, `location_country`,
  `location_lat`, `location_lng`,
  `hero_image_url`, `requires_waiver`, `max_registrations`, `registration_count`, `search_keywords`
)
SELECT
  'ev000008-0000-4000-8000-000000000008', o.id, st.id, v.id,
  'crossfit-challenge-cdmx-2026',
  'CrossFit Challenge CDMX 2026 (Test Event)',
  'Competencia funcional con categorías Individual y Parejas.',
  '<p>Evento de demostración para fitness funcional. WODs escalados, zona de calentamiento y premiación por categoría.</p>',
  'published', 'public', 0,
  '2026-05-30 09:00:00', '2026-01-01 00:00:00', '2026-05-25 23:59:59',
  'America/Mexico_City', v.name, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1486218119243-13883505764c?w=1200&q=80&auto=format&fit=crop',
  1, 1500, 0,
  'fitness crossfit funcional wod test'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'run-mexico' AND st.slug = 'fitness' AND v.public_uuid = 'v0000005-0000-4000-8000-000000000005'
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `short_description` = VALUES(`short_description`),
  `description` = VALUES(`description`),
  `status` = 'published';

-- ============================================================================
-- EVENT CATEGORIES
-- ============================================================================
INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000010-0000-4000-8000-000000000010', e.id, 'Gran Fondo 80K', 'Recorrido largo certificado', 80.00, 'advanced', 1200, 0, 120000, 1
FROM events e WHERE e.slug = 'gran-fondo-guadalajara-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000011-0000-4000-8000-000000000011', e.id, 'Ride 40K', 'Distancia recreativa', 40.00, 'intermediate', 1300, 0, 85000, 2
FROM events e WHERE e.slug = 'gran-fondo-guadalajara-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000012-0000-4000-8000-000000000012', e.id, 'Sprint 5K', '5 km con 15 obstáculos', 5.00, 'intermediate', 2000, 0, 75000, 1
FROM events e WHERE e.slug = 'ocr-bosque-chapultepec-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000013-0000-4000-8000-000000000013', e.id, 'Beast 10K', '10 km con 25 obstáculos', 10.00, 'advanced', 1000, 0, 95000, 2
FROM events e WHERE e.slug = 'ocr-bosque-chapultepec-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000014-0000-4000-8000-000000000014', e.id, 'Individual', 'Categoría abierta', 0.00, 800, 0, 110000, 1
FROM events e WHERE e.slug = 'crossfit-challenge-cdmx-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000015-0000-4000-8000-000000000015', e.id, 'Parejas', 'Equipos de 2 atletas', 0.00, 700, 0, 180000, 2
FROM events e WHERE e.slug = 'crossfit-challenge-cdmx-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================================================
-- EVENT TAGS
-- ============================================================================
INSERT IGNORE INTO `event_tags` (`event_id`, `tag_id`)
SELECT e.id, t.id FROM events e, tags t
WHERE e.slug = 'gran-fondo-guadalajara-2026' AND t.slug IN ('road', 'chip-timing');

INSERT IGNORE INTO `event_tags` (`event_id`, `tag_id`)
SELECT e.id, t.id FROM events e, tags t
WHERE e.slug = 'ocr-bosque-chapultepec-2026' AND t.slug IN ('elite', 'chip-timing');

INSERT IGNORE INTO `event_tags` (`event_id`, `tag_id`)
SELECT e.id, t.id FROM events e, tags t
WHERE e.slug = 'crossfit-challenge-cdmx-2026' AND t.slug IN ('elite');

-- ============================================================================
-- WAIVERS (required for checkout)
-- ============================================================================
INSERT INTO `event_waivers` (`event_id`, `title`, `content_html`, `version`, `is_active`, `sort_order`)
SELECT e.id,
  CONCAT('Exoneración de Responsabilidad — ', e.title),
  '<p>Al inscribirme declaro estar en condiciones físicas aptas para participar. Exonero al organizador y a sus colaboradores de cualquier responsabilidad por lesiones o incidentes durante el evento.</p>',
  1, 1, 0
FROM events e
WHERE e.slug IN (
  'gran-fondo-guadalajara-2026',
  'ocr-bosque-chapultepec-2026',
  'crossfit-challenge-cdmx-2026'
)
  AND e.requires_waiver = 1
  AND NOT EXISTS (SELECT 1 FROM event_waivers ew WHERE ew.event_id = e.id AND ew.is_active = 1);
