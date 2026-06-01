-- Reconcile wave and discount counters from actual registrations.

UPDATE `event_schedule_waves` w
SET w.registered_count = (
  SELECT COUNT(*)
  FROM registrations r
  WHERE r.schedule_wave_id = w.id
    AND r.status = 'confirmed'
    AND r.deleted_at IS NULL
);

UPDATE `discount_codes` dc
SET dc.used_count = (
  SELECT COUNT(*)
  FROM registrations r
  WHERE r.discount_code_id = dc.id
    AND r.status = 'confirmed'
    AND r.deleted_at IS NULL
);

UPDATE `athlete_teams` t
SET t.member_count = (
  SELECT COUNT(*)
  FROM athlete_team_members m
  WHERE m.team_id = t.id
);
