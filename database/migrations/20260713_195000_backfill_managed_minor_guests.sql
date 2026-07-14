-- Backfill: guest registrations for under-18 athletes become managed (no claim token).
-- Uses purchaser_athlete_id when present; leave claim token only for adults.
-- TiDB Cloud Serverless / MySQL 8 compatible.

UPDATE registrations r
JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
SET r.guest_claim_token = NULL
WHERE r.deleted_at IS NULL
  AND r.guest_claim_token IS NOT NULL
  AND r.purchaser_athlete_id IS NOT NULL
  AND r.purchaser_athlete_id <> r.athlete_id
  AND a.date_of_birth IS NOT NULL
  AND TIMESTAMPDIFF(YEAR, a.date_of_birth, DATE(e.start_date))
      - IF(DATE_FORMAT(e.start_date, '%m%d') < DATE_FORMAT(a.date_of_birth, '%m%d'), 1, 0) < 18;
