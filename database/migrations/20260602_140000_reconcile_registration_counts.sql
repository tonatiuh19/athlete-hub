-- Reconcile denormalized registration counters with actual confirmed registrations.
-- Seed data previously set fake registration_count / sold_count values.

UPDATE `event_categories` ec
SET ec.sold_count = (
  SELECT COUNT(*)
  FROM registrations r
  WHERE r.event_category_id = ec.id
    AND r.status = 'confirmed'
    AND r.deleted_at IS NULL
);

UPDATE `events` e
SET e.registration_count = (
  SELECT COUNT(*)
  FROM registrations r
  WHERE r.event_id = e.id
    AND r.status = 'confirmed'
    AND r.deleted_at IS NULL
);
