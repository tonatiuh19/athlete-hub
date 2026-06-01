-- Mock / demo seed data for local development and API testing
-- Safe to re-run: uses fixed slugs/emails with upsert patterns

-- ============================================================================
-- ADMIN
-- ============================================================================
INSERT INTO `admins` (`public_uuid`, `email`, `first_name`, `last_name`, `role`, `status`)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  'admin@athletehub.test',
  'Platform',
  'Admin',
  'super_admin',
  'active'
)
ON DUPLICATE KEY UPDATE `first_name` = VALUES(`first_name`), `status` = 'active';

-- ============================================================================
-- VENUES
-- ============================================================================
INSERT INTO `venues` (`public_uuid`, `name`, `address_line1`, `city`, `state`, `country`, `lat`, `lng`, `timezone`) VALUES
  ('v0000001-0000-4000-8000-000000000001', 'Paseo de la Reforma', 'Av. Paseo de la Reforma s/n', 'Ciudad de México', 'CDMX', 'MX', 19.4326000, -99.1332000, 'America/Mexico_City'),
  ('v0000002-0000-4000-8000-000000000002', 'Nevado de Toluca — La Joya', 'Parque Nacional Nevado de Toluca', 'Toluca', 'Estado de México', 'MX', 19.1097000, -99.7578000, 'America/Mexico_City'),
  ('v0000003-0000-4000-8000-000000000003', 'Playa Pie de la Cuesta', 'Blvd. de las Naciones', 'Acapulco', 'Guerrero', 'MX', 16.7021000, -99.9236000, 'America/Mexico_City'),
  ('v0000004-0000-4000-8000-000000000004', 'Parque Lincoln', 'Av. Emilio Castelar 204', 'Ciudad de México', 'CDMX', 'MX', 19.4289000, -99.1947000, 'America/Mexico_City'),
  ('v0000005-0000-4000-8000-000000000005', 'Centro Citibanamex', 'Av. del Conscripto 311', 'Ciudad de México', 'CDMX', 'MX', 19.4436000, -99.2014000, 'America/Mexico_City')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================================================
-- ORGANIZERS + MEMBERS
-- ============================================================================
INSERT INTO `organizers` (
  `public_uuid`, `slug`, `name`, `legal_name`, `email`, `billing_email`, `phone`,
  `website_url`, `logo_url`, `description`, `country`, `city`, `status`,
  `stripe_onboarding_complete`, `service_fee_percent`, `rfc`, `tax_regime`
) VALUES
  (
    'o0000001-0000-4000-8000-000000000001',
    'run-mexico',
    'Run Mexico',
    'Run Mexico Eventos SA de CV',
    'hola@runmexico.test',
    'facturacion@runmexico.test',
    '+525512345678',
    'https://runmexico.test',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200',
    'Organizador líder de carreras en México. Más de 50 eventos anuales en CDMX, Guadalajara y Monterrey.',
    'MX', 'Ciudad de México', 'active', 1, 11.00, 'RMX850101ABC', '601'
  ),
  (
    'o0000002-0000-4000-8000-000000000002',
    'pacific-endurance',
    'Pacific Endurance',
    'Pacific Endurance Deportes SA de CV',
    'info@pacificendurance.test',
    'contabilidad@pacificendurance.test',
    '+525598765432',
    'https://pacificendurance.test',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=200',
    'Especialistas en triatlón, ciclismo y eventos de resistencia en la costa del Pacífico.',
    'MX', 'Acapulco', 'active', 1, 11.00, 'PED920202XYZ', '601'
  )
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `status` = 'active';

INSERT INTO `organizer_members` (
  `public_uuid`, `organizer_id`, `email`, `first_name`, `last_name`, `phone`, `role`, `status`, `invited_at`
)
SELECT 'om000001-0000-4000-8000-000000000001', o.id, 'owner@runmexico.test', 'Roberto', 'Sánchez', '+525511110001', 'owner', 'active', NOW()
FROM organizers o WHERE o.slug = 'run-mexico'
ON DUPLICATE KEY UPDATE `status` = 'active';

INSERT INTO `organizer_members` (
  `public_uuid`, `organizer_id`, `email`, `first_name`, `last_name`, `phone`, `role`, `status`, `invited_at`
)
SELECT 'om000002-0000-4000-8000-000000000002', o.id, 'ops@runmexico.test', 'Patricia', 'Morales', '+525511110002', 'operations', 'active', NOW()
FROM organizers o WHERE o.slug = 'run-mexico'
ON DUPLICATE KEY UPDATE `status` = 'active';

INSERT INTO `organizer_members` (
  `public_uuid`, `organizer_id`, `email`, `first_name`, `last_name`, `phone`, `role`, `status`, `invited_at`
)
SELECT 'om000003-0000-4000-8000-000000000003', o.id, 'owner@pacificendurance.test', 'Eduardo', 'Vega', '+525522220001', 'owner', 'active', NOW()
FROM organizers o WHERE o.slug = 'pacific-endurance'
ON DUPLICATE KEY UPDATE `status` = 'active';

INSERT INTO `organizer_settings` (`organizer_id`, `setting_key`, `setting_value`)
SELECT o.id, 'branding', JSON_OBJECT('primary_color', '#2563eb', 'accent_color', '#f59e0b', 'tagline', 'Corre con nosotros')
FROM organizers o WHERE o.slug = 'run-mexico'
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

INSERT INTO `organizer_settings` (`organizer_id`, `setting_key`, `setting_value`)
SELECT o.id, 'notifications', JSON_OBJECT('registration_confirm', true, 'result_notify', true, 'sms_reminders', false)
FROM organizers o WHERE o.slug = 'run-mexico'
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- ============================================================================
-- ATHLETES
-- ============================================================================
INSERT INTO `athletes` (
  `public_uuid`, `email`, `phone`, `first_name`, `last_name`, `date_of_birth`, `gender`,
  `shirt_size`, `country`, `city`, `emergency_contact_name`, `emergency_contact_phone`,
  `avatar_url`, `preferred_language`, `email_verified_at`, `phone_verified_at`, `status`
) VALUES
  ('at000001-0000-4000-8000-000000000001', 'felix.gomez@example.com', '+525551111001', 'Felix', 'Gómez', '1992-03-15', 'male', 'M', 'MX', 'Ciudad de México', 'Laura Gómez', '+525559990001', 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=200', 'es', NOW(), NOW(), 'active'),
  ('at000002-0000-4000-8000-000000000002', 'maria.lopez@example.com', '+525551111002', 'María', 'López', '1988-07-22', 'female', 'S', 'MX', 'Guadalajara', 'Pedro López', '+525559990002', 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=200', 'es', NOW(), NULL, 'active'),
  ('at000003-0000-4000-8000-000000000003', 'carlos.ruiz@example.com', '+525551111003', 'Carlos', 'Ruiz', '1995-11-08', 'male', 'L', 'MX', 'Monterrey', 'Ana Ruiz', '+525559990003', NULL, 'es', NOW(), NOW(), 'active'),
  ('at000004-0000-4000-8000-000000000004', 'ana.torres@example.com', '+525551111004', 'Ana', 'Torres', '1990-01-30', 'female', 'M', 'MX', 'Ciudad de México', 'Miguel Torres', '+525559990004', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200', 'es', NOW(), NOW(), 'active'),
  ('at000005-0000-4000-8000-000000000005', 'diego.martinez@example.com', '+525551111005', 'Diego', 'Martínez', '1985-09-12', 'male', 'XL', 'MX', 'Puebla', 'Sofia Martínez', '+525559990005', NULL, 'es', NOW(), NULL, 'active'),
  ('at000006-0000-4000-8000-000000000006', 'lucia.herrera@example.com', '+525551111006', 'Lucía', 'Herrera', '1998-05-25', 'female', 'S', 'MX', 'Querétaro', 'Jorge Herrera', '+525559990006', NULL, 'es', NOW(), NOW(), 'active')
ON DUPLICATE KEY UPDATE
  `first_name` = VALUES(`first_name`),
  `last_name` = VALUES(`last_name`),
  `status` = 'active';

-- ============================================================================
-- EVENTS
-- ============================================================================
INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`, `featured`,
  `start_date`, `end_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_address`, `location_city`, `location_state`,
  `location_country`, `location_lat`, `location_lng`,
  `hero_image_url`, `banner_image_url`, `allows_transfers`, `transfer_fee_cents`,
  `requires_waiver`, `max_registrations`, `registration_count`, `search_keywords`
)
SELECT
  'ev000001-0000-4000-8000-000000000001', o.id, st.id, v.id,
  'maraton-cdmx-2026',
  'Maratón Ciudad de México 2026',
  'La carrera más emblemática de la capital. Recorre Reforma, Chapultepec y el Zócalo.',
  'El Maratón Ciudad de México reúne a más de 30,000 corredores de todo el mundo. Certificación AIMS, chip timing, hidratación cada 2.5 km y medalla finisher premium. Incluye playera técnica, número con nombre y acceso a zona de recuperación post-meta.',
  'published', 'public', 1,
  '2026-08-30 06:00:00', '2026-08-30 14:00:00',
  '2026-01-01 00:00:00', '2026-08-25 23:59:59',
  'America/Mexico_City',
  v.name, v.address_line1, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1452626212852-811d58933cae?w=1200',
  'https://images.unsplash.com/photo-1476480862128-209bfaa8dba8?w=1600',
  1, 15000, 1, 30000, 0,
  'maraton cdmx ciudad de mexico 42k running reforma chapultepec'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'run-mexico' AND st.slug = 'running' AND v.public_uuid = 'v0000001-0000-4000-8000-000000000001'
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = 'published';

INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`, `featured`,
  `start_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_city`, `location_state`, `location_country`,
  `location_lat`, `location_lng`, `hero_image_url`, `requires_waiver`,
  `max_registrations`, `registration_count`, `search_keywords`
)
SELECT
  'ev000002-0000-4000-8000-000000000002', o.id, st.id, v.id,
  'trail-nevado-toluca-2026',
  'Trail Nevado de Toluca 2026',
  'Carrera de montaña en uno de los volcanes más altos de México. 21K y 10K.',
  'Desafía tus límites en el Nevado de Toluca. Dos distancias: 21K con 1,200m D+ y 10K familiar. Seguridad en ruta, puntos de hidratación y premios por categoría.',
  'published', 'public', 1,
  '2026-06-14 07:00:00', '2026-01-15 00:00:00', '2026-06-10 23:59:59',
  'America/Mexico_City', v.name, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200',
  1, 800, 0, 'trail nevado toluca montaña running 21k 10k'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'run-mexico' AND st.slug = 'trail' AND v.public_uuid = 'v0000002-0000-4000-8000-000000000002'
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = 'published';

INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`,
  `start_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_city`, `location_state`, `location_country`,
  `location_lat`, `location_lng`, `hero_image_url`, `requires_waiver`,
  `max_registrations`, `registration_count`, `search_keywords`
)
SELECT
  'ev000003-0000-4000-8000-000000000003', o.id, st.id, v.id,
  'triatlon-acapulco-2026',
  'Triatlón Acapulco 2026',
  'Sprint y Olímpico en la bahía más famosa de México. Natación en mar abierto.',
  'Triatlón de clase mundial con natación en Playa Pie de la Cuesta, ciclismo costero y carrera en el malecón. Categorías por edad, relevos y experiencia para principiantes.',
  'published', 'public',
  '2026-11-08 06:30:00', '2026-02-01 00:00:00', '2026-11-01 23:59:59',
  'America/Mexico_City', v.name, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200',
  1, 1500, 0, 'triatlon acapulco natacion ciclismo running sprint olimpico'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'pacific-endurance' AND st.slug = 'triathlon' AND v.public_uuid = 'v0000003-0000-4000-8000-000000000003'
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = 'published';

INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`,
  `start_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_city`, `location_state`, `location_country`,
  `location_lat`, `location_lng`, `hero_image_url`, `requires_waiver`,
  `max_registrations`, `registration_count`, `search_keywords`
)
SELECT
  'ev000004-0000-4000-8000-000000000004', o.id, st.id, v.id,
  'carrera-10k-polanco-2026',
  'Carrera 10K Polanco 2026',
  'Carrera urbana nocturna en una de las zonas más icónicas de CDMX.',
  '10 kilómetros por las calles de Polanco. Salida nocturna, música en vivo, zona de food trucks y premiación inmediata. Ideal para PRs y corredores de todos los niveles.',
  'published', 'public',
  '2026-04-18 19:00:00', '2026-01-01 00:00:00', '2026-04-15 23:59:59',
  'America/Mexico_City', v.name, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1571008887538-b36bb08f4571?w=1200',
  1, 5000, 0, '10k polanco carrera nocturna running cdmx'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'run-mexico' AND st.slug = 'running' AND v.public_uuid = 'v0000004-0000-4000-8000-000000000004'
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = 'published';

INSERT INTO `events` (
  `public_uuid`, `organizer_id`, `sport_type_id`, `venue_id`, `slug`, `title`,
  `short_description`, `description`, `status`, `visibility`,
  `start_date`, `end_date`, `registration_opens_at`, `registration_closes_at`,
  `timezone`, `location_name`, `location_city`, `location_state`, `location_country`,
  `location_lat`, `location_lng`, `hero_image_url`, `requires_waiver`,
  `max_registrations`, `registration_count`, `search_keywords`
)
SELECT
  'ev000005-0000-4000-8000-000000000005', o.id, st.id, v.id,
  'hyrox-mexico-city-2025',
  'Hyrox Mexico City 2025',
  'El fitness race que conquistó el mundo. 8 estaciones funcionales + running.',
  'Hyrox combina running con estaciones funcionales: ski erg, sled push, burpees, row y más. Categorías individual, doubles y relay. Evento completado — resultados oficiales publicados.',
  'completed', 'public',
  '2025-11-15 08:00:00', '2025-11-15 18:00:00',
  '2025-06-01 00:00:00', '2025-11-10 23:59:59',
  'America/Mexico_City', v.name, v.city, v.state, v.country, v.lat, v.lng,
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200',
  1, 2000, 0, 'hyrox fitness funcional mexico city crossfit'
FROM organizers o, sport_types st, venues v
WHERE o.slug = 'run-mexico' AND st.slug = 'hyrox' AND v.public_uuid = 'v0000005-0000-4000-8000-000000000005'
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = 'completed';

-- ============================================================================
-- EVENT CATEGORIES
-- ============================================================================
INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `gender_restriction`, `min_age`, `sort_order`)
SELECT 'ec000001-0000-4000-8000-000000000001', e.id, 'Maratón 42K', 'Distancia completa certificada AIMS', 42.20, 'advanced', 30000, 0, 150000, 'any', 18, 1
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `gender_restriction`, `min_age`, `sort_order`)
SELECT 'ec000002-0000-4000-8000-000000000002', e.id, 'Media Maratón 21K', 'Media maratón por Reforma y Chapultepec', 21.10, 'intermediate', 15000, 0, 90000, 'any', 16, 2
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000003-0000-4000-8000-000000000003', e.id, 'Trail 21K', 'Recorrido técnico de montaña', 21.00, 'expert', 500, 0, 95000, 1
FROM events e WHERE e.slug = 'trail-nevado-toluca-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `difficulty`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000004-0000-4000-8000-000000000004', e.id, 'Trail 10K', 'Distancia accesible con vistas al cráter', 10.00, 'intermediate', 300, 0, 65000, 2
FROM events e WHERE e.slug = 'trail-nevado-toluca-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000005-0000-4000-8000-000000000005', e.id, 'Sprint', '750m natación · 20K bici · 5K carrera', 25.75, 800, 0, 180000, 1
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000006-0000-4000-8000-000000000006', e.id, 'Olímpico', '1.5K natación · 40K bici · 10K carrera', 51.50, 700, 0, 220000, 2
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000007-0000-4000-8000-000000000007', e.id, '10K General', 'Categoría abierta', 10.00, 5000, 0, 80000, 1
FROM events e WHERE e.slug = 'carrera-10k-polanco-2026'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000008-0000-4000-8000-000000000008', e.id, 'Hyrox Open', 'Individual — categoría abierta', 8.00, 1200, 0, 175000, 1
FROM events e WHERE e.slug = 'hyrox-mexico-city-2025'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `event_categories` (`public_uuid`, `event_id`, `name`, `description`, `distance_km`, `capacity`, `sold_count`, `price_cents`, `sort_order`)
SELECT 'ec000009-0000-4000-8000-000000000009', e.id, 'Hyrox Pro', 'Individual — categoría pro', 8.00, 400, 0, 195000, 2
FROM events e WHERE e.slug = 'hyrox-mexico-city-2025'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================================================
-- EVENT TAGS
-- ============================================================================
INSERT IGNORE INTO `event_tags` (`event_id`, `tag_id`)
SELECT e.id, t.id FROM events e, tags t WHERE e.slug = 'maraton-cdmx-2026' AND t.slug IN ('marathon', 'road', 'chip-timing');

INSERT IGNORE INTO `event_tags` (`event_id`, `tag_id`)
SELECT e.id, t.id FROM events e, tags t WHERE e.slug = 'trail-nevado-toluca-2026' AND t.slug IN ('trail', '21k', '10k');

INSERT IGNORE INTO `event_tags` (`event_id`, `tag_id`)
SELECT e.id, t.id FROM events e, tags t WHERE e.slug = 'carrera-10k-polanco-2026' AND t.slug IN ('10k', 'road', 'family');

INSERT IGNORE INTO `event_tags` (`event_id`, `tag_id`)
SELECT e.id, t.id FROM events e, tags t WHERE e.slug = 'hyrox-mexico-city-2025' AND t.slug IN ('elite', 'chip-timing');

-- ============================================================================
-- REGISTRATION FIELDS (dynamic forms)
-- ============================================================================
INSERT INTO `event_registration_fields` (`event_id`, `field_key`, `label`, `field_type`, `options_json`, `is_required`, `sort_order`)
SELECT e.id, 'shirt_size', 'Talla de playera', 'select', JSON_ARRAY('XS','S','M','L','XL','XXL'), 1, 1
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

INSERT INTO `event_registration_fields` (`event_id`, `field_key`, `label`, `field_type`, `is_required`, `sort_order`)
SELECT e.id, 'emergency_contact', 'Contacto de emergencia', 'text', 1, 2
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

INSERT INTO `event_registration_fields` (`event_id`, `field_key`, `label`, `field_type`, `is_required`, `sort_order`)
SELECT e.id, 'medical_certificate', '¿Cuentas con certificado médico vigente?', 'checkbox', 0, 3
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

INSERT INTO `event_registration_fields` (`event_id`, `field_key`, `label`, `field_type`, `options_json`, `is_required`, `sort_order`)
SELECT e.id, 'shirt_size', 'Talla de playera', 'select', JSON_ARRAY('XS','S','M','L','XL'), 1, 1
FROM events e WHERE e.slug = 'carrera-10k-polanco-2026'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

INSERT INTO `event_registration_fields` (`event_id`, `field_key`, `label`, `field_type`, `options_json`, `is_required`, `sort_order`)
SELECT e.id, 'bike_type', 'Tipo de bicicleta', 'select', JSON_ARRAY('Road','TT','MTB'), 1, 1
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

-- ============================================================================
-- WAIVERS
-- ============================================================================
INSERT INTO `event_waivers` (`event_id`, `title`, `content_html`, `version`, `is_active`)
SELECT e.id, 'Exoneración de Responsabilidad — Maratón CDMX 2026',
  '<p>Al inscribirme declaro estar en condiciones físicas aptas para participar. Exonero a Run Mexico y colaboradores de cualquier responsabilidad por lesiones durante el evento.</p>',
  1, 1
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM event_waivers ew WHERE ew.event_id = e.id AND ew.is_active = 1);

-- ============================================================================
-- SPONSORS
-- ============================================================================
INSERT INTO `event_sponsors` (`event_id`, `name`, `logo_url`, `website_url`, `tier`, `sort_order`)
SELECT e.id, 'Gatorade', 'https://images.unsplash.com/photo-1622547748225-3bf4c1a2a544?w=200', 'https://gatorade.com', 'title', 1
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'Gatorade');

INSERT INTO `event_sponsors` (`event_id`, `name`, `logo_url`, `tier`, `sort_order`)
SELECT e.id, 'Nike Running', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200', 'gold', 2
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'Nike Running');

INSERT INTO `event_sponsors` (`event_id`, `name`, `tier`, `sort_order`)
SELECT e.id, 'Garmin', 'gold', 1
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'Garmin');

-- ============================================================================
-- SCHEDULE WAVES
-- ============================================================================
INSERT INTO `event_schedule_waves` (`event_id`, `event_category_id`, `name`, `starts_at`, `capacity`, `registered_count`, `sort_order`)
SELECT e.id, ec.id, 'Ola A — Sub 3:30', '2026-08-30 06:00:00', 5000, 0, 1
FROM events e JOIN event_categories ec ON ec.event_id = e.id AND ec.name = 'Maratón 42K'
WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM event_schedule_waves w WHERE w.event_id = e.id AND w.name = 'Ola A — Sub 3:30');

INSERT INTO `event_schedule_waves` (`event_id`, `event_category_id`, `name`, `starts_at`, `capacity`, `registered_count`, `sort_order`)
SELECT e.id, ec.id, 'Ola B — General', '2026-08-30 06:15:00', 25000, 0, 2
FROM events e JOIN event_categories ec ON ec.event_id = e.id AND ec.name = 'Maratón 42K'
WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM event_schedule_waves w WHERE w.event_id = e.id AND w.name = 'Ola B — General');

-- ============================================================================
-- DISCOUNT CODES
-- ============================================================================
INSERT INTO `discount_codes` (`event_id`, `organizer_id`, `code`, `description`, `discount_type`, `discount_value`, `applies_to`, `max_uses`, `used_count`, `valid_until`, `is_active`)
SELECT e.id, e.organizer_id, 'EARLY2026', '15% descuento inscripción temprana', 'percent', 15, 'registration', 500, 0, '2026-03-31 23:59:59', 1
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
ON DUPLICATE KEY UPDATE `used_count` = VALUES(`used_count`);

INSERT INTO `discount_codes` (`event_id`, `code`, `description`, `discount_type`, `discount_value`, `applies_to`, `max_uses`, `valid_until`, `is_active`)
SELECT e.id, 'POLANCO10', '$100 MXN de descuento', 'fixed_cents', 10000, 'registration', 200, '2026-04-15 23:59:59', 1
FROM events e WHERE e.slug = 'carrera-10k-polanco-2026'
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- ============================================================================
-- SAMPLE REGISTRATIONS + PAYMENTS + RESULTS
-- ============================================================================

-- Felix → Maratón 42K (confirmed)
INSERT INTO `registrations` (
  `public_uuid`, `event_id`, `event_category_id`, `athlete_id`,
  `registration_number`, `qr_code_token`, `bib_number`, `status`,
  `price_cents`, `service_fee_cents`, `total_cents`, `waiver_signed_at`, `source`
)
SELECT
  'rg000001-0000-4000-8000-000000000001', e.id, ec.id, a.id,
  'CDMX26-004281', 'qr_cdmx26_felix_gomez_004281', '4281', 'confirmed',
  150000, 16500, 166500, '2026-02-10 14:30:00', 'web'
FROM events e
JOIN event_categories ec ON ec.event_id = e.id AND ec.name = 'Maratón 42K'
JOIN athletes a ON a.email = 'felix.gomez@example.com'
WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.public_uuid = 'rg000001-0000-4000-8000-000000000001');

INSERT INTO `payments` (
  `public_uuid`, `registration_id`, `athlete_id`, `organizer_id`, `event_id`,
  `amount_cents`, `registration_amount_cents`, `service_fee_cents`,
  `status`, `provider`, `stripe_payment_intent_id`, `paid_at`, `idempotency_key`
)
SELECT
  'py000001-0000-4000-8000-000000000001', r.id, r.athlete_id, e.organizer_id, e.id,
  r.total_cents, r.price_cents, r.service_fee_cents,
  'succeeded', 'mock', 'pi_mock_cdmx26_felix', '2026-02-10 14:30:00', 'idem_felix_cdmx26'
FROM registrations r
JOIN events e ON e.id = r.event_id
WHERE r.public_uuid = 'rg000001-0000-4000-8000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.public_uuid = 'py000001-0000-4000-8000-000000000001');

UPDATE registrations r
JOIN payments p ON p.public_uuid = 'py000001-0000-4000-8000-000000000001'
SET r.payment_id = p.id
WHERE r.public_uuid = 'rg000001-0000-4000-8000-000000000001';

-- María → 10K Polanco (confirmed)
INSERT INTO `registrations` (
  `public_uuid`, `event_id`, `event_category_id`, `athlete_id`,
  `registration_number`, `qr_code_token`, `bib_number`, `status`,
  `price_cents`, `service_fee_cents`, `total_cents`, `waiver_signed_at`, `source`
)
SELECT
  'rg000002-0000-4000-8000-000000000002', e.id, ec.id, a.id,
  'POL26-001892', 'qr_pol26_maria_lopez_1892', '1892', 'confirmed',
  80000, 8800, 88800, '2026-03-01 10:00:00', 'web'
FROM events e
JOIN event_categories ec ON ec.event_id = e.id AND ec.name = '10K General'
JOIN athletes a ON a.email = 'maria.lopez@example.com'
WHERE e.slug = 'carrera-10k-polanco-2026'
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.public_uuid = 'rg000002-0000-4000-8000-000000000002');

INSERT INTO `payments` (
  `public_uuid`, `registration_id`, `athlete_id`, `organizer_id`, `event_id`,
  `amount_cents`, `registration_amount_cents`, `service_fee_cents`,
  `status`, `provider`, `stripe_payment_intent_id`, `paid_at`, `idempotency_key`
)
SELECT
  'py000002-0000-4000-8000-000000000002', r.id, r.athlete_id, e.organizer_id, e.id,
  r.total_cents, r.price_cents, r.service_fee_cents,
  'succeeded', 'mock', 'pi_mock_pol26_maria', '2026-03-01 10:00:00', 'idem_maria_pol26'
FROM registrations r JOIN events e ON e.id = r.event_id
WHERE r.public_uuid = 'rg000002-0000-4000-8000-000000000002'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.public_uuid = 'py000002-0000-4000-8000-000000000002');

UPDATE registrations r JOIN payments p ON p.public_uuid = 'py000002-0000-4000-8000-000000000002'
SET r.payment_id = p.id WHERE r.public_uuid = 'rg000002-0000-4000-8000-000000000002';

-- Carlos → Trail 21K (confirmed)
INSERT INTO `registrations` (
  `public_uuid`, `event_id`, `event_category_id`, `athlete_id`,
  `registration_number`, `qr_code_token`, `status`,
  `price_cents`, `service_fee_cents`, `total_cents`, `waiver_signed_at`, `source`
)
SELECT
  'rg000003-0000-4000-8000-000000000003', e.id, ec.id, a.id,
  'TRN26-000156', 'qr_trn26_carlos_ruiz_156', 'confirmed',
  95000, 10450, 105450, '2026-02-20 16:00:00', 'mobile'
FROM events e
JOIN event_categories ec ON ec.event_id = e.id AND ec.name = 'Trail 21K'
JOIN athletes a ON a.email = 'carlos.ruiz@example.com'
WHERE e.slug = 'trail-nevado-toluca-2026'
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.public_uuid = 'rg000003-0000-4000-8000-000000000003');

INSERT INTO `payments` (
  `public_uuid`, `registration_id`, `athlete_id`, `organizer_id`, `event_id`,
  `amount_cents`, `registration_amount_cents`, `service_fee_cents`,
  `status`, `provider`, `paid_at`, `idempotency_key`
)
SELECT
  'py000003-0000-4000-8000-000000000003', r.id, r.athlete_id, e.organizer_id, e.id,
  r.total_cents, r.price_cents, r.service_fee_cents,
  'succeeded', 'mock', '2026-02-20 16:00:00', 'idem_carlos_trn26'
FROM registrations r JOIN events e ON e.id = r.event_id
WHERE r.public_uuid = 'rg000003-0000-4000-8000-000000000003'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.public_uuid = 'py000003-0000-4000-8000-000000000003');

UPDATE registrations r JOIN payments p ON p.public_uuid = 'py000003-0000-4000-8000-000000000003'
SET r.payment_id = p.id WHERE r.public_uuid = 'rg000003-0000-4000-8000-000000000003';

-- Ana + Diego → Hyrox 2025 (completed with results)
INSERT INTO `registrations` (
  `public_uuid`, `event_id`, `event_category_id`, `athlete_id`,
  `registration_number`, `qr_code_token`, `bib_number`, `status`,
  `price_cents`, `service_fee_cents`, `total_cents`, `waiver_signed_at`, `checked_in_at`, `source`
)
SELECT
  'rg000004-0000-4000-8000-000000000004', e.id, ec.id, a.id,
  'HYX25-007821', 'qr_hyx25_ana_torres_7821', '7821', 'confirmed',
  175000, 19250, 194250, '2025-08-01 12:00:00', '2025-11-15 07:45:00', 'web'
FROM events e
JOIN event_categories ec ON ec.event_id = e.id AND ec.name = 'Hyrox Open'
JOIN athletes a ON a.email = 'ana.torres@example.com'
WHERE e.slug = 'hyrox-mexico-city-2025'
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.public_uuid = 'rg000004-0000-4000-8000-000000000004');

INSERT INTO `registrations` (
  `public_uuid`, `event_id`, `event_category_id`, `athlete_id`,
  `registration_number`, `qr_code_token`, `bib_number`, `status`,
  `price_cents`, `service_fee_cents`, `total_cents`, `waiver_signed_at`, `checked_in_at`, `source`
)
SELECT
  'rg000005-0000-4000-8000-000000000005', e.id, ec.id, a.id,
  'HYX25-007822', 'qr_hyx25_diego_martinez_7822', '7822', 'confirmed',
  195000, 21450, 216450, '2025-08-01 12:00:00', '2025-11-15 07:50:00', 'web'
FROM events e
JOIN event_categories ec ON ec.event_id = e.id AND ec.name = 'Hyrox Pro'
JOIN athletes a ON a.email = 'diego.martinez@example.com'
WHERE e.slug = 'hyrox-mexico-city-2025'
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.public_uuid = 'rg000005-0000-4000-8000-000000000005');

INSERT INTO `payments` (
  `public_uuid`, `registration_id`, `athlete_id`, `organizer_id`, `event_id`,
  `amount_cents`, `registration_amount_cents`, `service_fee_cents`,
  `status`, `provider`, `paid_at`, `idempotency_key`
)
SELECT
  'py000004-0000-4000-8000-000000000004', r.id, r.athlete_id, e.organizer_id, e.id,
  r.total_cents, r.price_cents, r.service_fee_cents,
  'succeeded', 'mock', '2025-08-01 12:00:00', 'idem_ana_hyx25'
FROM registrations r JOIN events e ON e.id = r.event_id
WHERE r.public_uuid = 'rg000004-0000-4000-8000-000000000004'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.public_uuid = 'py000004-0000-4000-8000-000000000004');

INSERT INTO `payments` (
  `public_uuid`, `registration_id`, `athlete_id`, `organizer_id`, `event_id`,
  `amount_cents`, `registration_amount_cents`, `service_fee_cents`,
  `status`, `provider`, `paid_at`, `idempotency_key`
)
SELECT
  'py000005-0000-4000-8000-000000000005', r.id, r.athlete_id, e.organizer_id, e.id,
  r.total_cents, r.price_cents, r.service_fee_cents,
  'succeeded', 'mock', '2025-08-01 12:00:00', 'idem_diego_hyx25'
FROM registrations r JOIN events e ON e.id = r.event_id
WHERE r.public_uuid = 'rg000005-0000-4000-8000-000000000005'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.public_uuid = 'py000005-0000-4000-8000-000000000005');

UPDATE registrations r JOIN payments p ON p.public_uuid = 'py000004-0000-4000-8000-000000000004'
SET r.payment_id = p.id WHERE r.public_uuid = 'rg000004-0000-4000-8000-000000000004';

UPDATE registrations r JOIN payments p ON p.public_uuid = 'py000005-0000-4000-8000-000000000005'
SET r.payment_id = p.id WHERE r.public_uuid = 'rg000005-0000-4000-8000-000000000005';

-- Pending payment registration (Lucía → Triatlón)
INSERT INTO `registrations` (
  `public_uuid`, `event_id`, `event_category_id`, `athlete_id`,
  `registration_number`, `qr_code_token`, `status`,
  `price_cents`, `service_fee_cents`, `total_cents`, `source`
)
SELECT
  'rg000006-0000-4000-8000-000000000006', e.id, ec.id, a.id,
  'TRI26-000042', 'qr_tri26_lucia_herrera_042', 'pending_payment',
  180000, 19800, 199800, 'web'
FROM events e
JOIN event_categories ec ON ec.event_id = e.id AND ec.name = 'Sprint'
JOIN athletes a ON a.email = 'lucia.herrera@example.com'
WHERE e.slug = 'triatlon-acapulco-2026'
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.public_uuid = 'rg000006-0000-4000-8000-000000000006');

-- ============================================================================
-- RESULTS (Hyrox 2025)
-- ============================================================================
INSERT INTO `event_results` (
  `event_id`, `registration_id`, `event_category_id`,
  `overall_rank`, `category_rank`, `gender_rank`,
  `finish_time_ms`, `status`, `pace_per_km_ms`, `published_at`
)
SELECT e.id, r.id, r.event_category_id, 142, 98, 52, 3840000, 'finished', 480000, '2025-11-15 20:00:00'
FROM events e
JOIN registrations r ON r.event_id = e.id AND r.public_uuid = 'rg000004-0000-4000-8000-000000000004'
WHERE e.slug = 'hyrox-mexico-city-2025'
  AND NOT EXISTS (SELECT 1 FROM event_results er WHERE er.registration_id = r.id);

INSERT INTO `event_results` (
  `event_id`, `registration_id`, `event_category_id`,
  `overall_rank`, `category_rank`, `gender_rank`,
  `finish_time_ms`, `status`, `pace_per_km_ms`, `published_at`
)
SELECT e.id, r.id, r.event_category_id, 28, 12, 28, 3210000, 'finished', 401250, '2025-11-15 20:00:00'
FROM events e
JOIN registrations r ON r.event_id = e.id AND r.public_uuid = 'rg000005-0000-4000-8000-000000000005'
WHERE e.slug = 'hyrox-mexico-city-2025'
  AND NOT EXISTS (SELECT 1 FROM event_results er WHERE er.registration_id = r.id);

INSERT INTO `result_splits` (`result_id`, `split_name`, `split_order`, `distance_km`, `elapsed_ms`, `pace_per_km_ms`)
SELECT er.id, 'Run 1', 1, 1.00, 270000, 270000
FROM event_results er
JOIN registrations r ON r.id = er.registration_id AND r.public_uuid = 'rg000004-0000-4000-8000-000000000004'
WHERE NOT EXISTS (SELECT 1 FROM result_splits rs WHERE rs.result_id = er.id AND rs.split_name = 'Run 1');

INSERT INTO `result_splits` (`result_id`, `split_name`, `split_order`, `distance_km`, `elapsed_ms`)
SELECT er.id, 'Station 1 — Ski Erg', 2, NULL, 480000
FROM event_results er
JOIN registrations r ON r.id = er.registration_id AND r.public_uuid = 'rg000004-0000-4000-8000-000000000004'
WHERE NOT EXISTS (SELECT 1 FROM result_splits rs WHERE rs.result_id = er.id AND rs.split_name = 'Station 1 — Ski Erg');

-- ============================================================================
-- REGISTRATION STATUS HISTORY (sample audit trail)
-- ============================================================================
INSERT INTO `registration_status_history` (`registration_id`, `from_status`, `to_status`, `actor_type`, `reason`)
SELECT r.id, NULL, 'pending_payment', 'system', 'Registration created'
FROM registrations r WHERE r.public_uuid = 'rg000001-0000-4000-8000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM registration_status_history h WHERE h.registration_id = r.id AND h.to_status = 'pending_payment');

INSERT INTO `registration_status_history` (`registration_id`, `from_status`, `to_status`, `actor_type`, `reason`)
SELECT r.id, 'pending_payment', 'confirmed', 'system', 'Payment succeeded (mock)'
FROM registrations r WHERE r.public_uuid = 'rg000001-0000-4000-8000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM registration_status_history h WHERE h.registration_id = r.id AND h.to_status = 'confirmed');

-- ============================================================================
-- CHECK-IN LOG (Hyrox)
-- ============================================================================
INSERT INTO `check_in_logs` (`registration_id`, `event_id`, `method`, `operator_type`, `location_label`)
SELECT r.id, r.event_id, 'qr_scan', 'system', 'Acceso Principal'
FROM registrations r WHERE r.public_uuid = 'rg000004-0000-4000-8000-000000000004'
  AND NOT EXISTS (SELECT 1 FROM check_in_logs c WHERE c.registration_id = r.id);

-- ============================================================================
-- AUDIT LOG (seed marker)
-- ============================================================================
INSERT INTO `audit_logs` (`actor_type`, `action`, `entity_type`, `metadata_json`)
SELECT 'system', 'seed.mock_data', 'database', JSON_OBJECT('version', '20260531', 'events', 5, 'athletes', 6)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'seed.mock_data' AND entity_type = 'database');
