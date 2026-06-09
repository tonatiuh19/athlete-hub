-- Extend demo registration windows and repair seed registration demo data.

UPDATE `events`
SET `registration_closes_at` = '2027-06-10 23:59:59'
WHERE `slug` = 'trail-nevado-toluca-2026';

UPDATE `events`
SET `status` = 'completed',
    `registration_closes_at` = '2026-04-15 23:59:59'
WHERE `slug` = 'carrera-10k-polanco-2026';

-- Backfill waiver signature rows for confirmed seed registrations.
INSERT INTO `registration_waiver_signatures` (
  `registration_id`, `waiver_id`, `waiver_version_at_sign`, `signature_data`, `signed_at`
)
SELECT r.id, ew.id, ew.version, 'SEED_DEMO_SIGNATURE', r.waiver_signed_at
FROM `registrations` r
JOIN `events` e ON e.id = r.event_id AND e.requires_waiver = 1
JOIN `event_waivers` ew ON ew.event_id = e.id AND ew.is_active = 1
WHERE r.status = 'confirmed'
  AND r.waiver_signed_at IS NOT NULL
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `registration_waiver_signatures` rws
    WHERE rws.registration_id = r.id AND rws.waiver_id = ew.id
  );

-- Felix — Maratón required fields
INSERT INTO `registration_field_values` (`registration_id`, `field_id`, `value_text`)
SELECT r.id, f.id, v.value_text
FROM `registrations` r
JOIN `events` e ON e.id = r.event_id AND e.slug = 'maraton-cdmx-2026'
JOIN `athletes` a ON a.id = r.athlete_id AND a.email = 'felix.gomez@example.com'
JOIN `event_registration_fields` f ON f.event_id = e.id AND f.field_key = 'shirt_size'
JOIN (
  SELECT 'L' AS value_text
) v
WHERE NOT EXISTS (
  SELECT 1 FROM `registration_field_values` rfv
  WHERE rfv.registration_id = r.id AND rfv.field_id = f.id
);

INSERT INTO `registration_field_values` (`registration_id`, `field_id`, `value_text`)
SELECT r.id, f.id, '+52 55 1234 5678'
FROM `registrations` r
JOIN `events` e ON e.id = r.event_id AND e.slug = 'maraton-cdmx-2026'
JOIN `athletes` a ON a.id = r.athlete_id AND a.email = 'felix.gomez@example.com'
JOIN `event_registration_fields` f ON f.event_id = e.id AND f.field_key = 'emergency_contact'
WHERE NOT EXISTS (
  SELECT 1 FROM `registration_field_values` rfv
  WHERE rfv.registration_id = r.id AND rfv.field_id = f.id
);
