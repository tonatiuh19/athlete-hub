/** Confirmed, non-deleted registrations for event row alias `e`. */
export const EVENT_REGISTRATION_COUNT_SQL = `(SELECT COUNT(*)
  FROM registrations r
  WHERE r.event_id = e.id AND r.status = 'confirmed' AND r.deleted_at IS NULL)`;

/** Confirmed registrations per category; use table alias `ec` for event_categories. */
export const CATEGORY_SOLD_COUNT_SQL = `(SELECT COUNT(*)
  FROM registrations r
  WHERE r.event_category_id = ec.id AND r.status = 'confirmed' AND r.deleted_at IS NULL)`;

/** Same as above when the categories table has no alias (full table name). */
export const CATEGORY_SOLD_COUNT_UNALIASED_SQL = `(SELECT COUNT(*)
  FROM registrations r
  WHERE r.event_category_id = event_categories.id AND r.status = 'confirmed' AND r.deleted_at IS NULL)`;

/** Confirmed registrations assigned to a schedule wave (table alias optional). */
export const WAVE_REGISTERED_COUNT_SQL = `(SELECT COUNT(*)
  FROM registrations r
  WHERE r.schedule_wave_id = event_schedule_waves.id AND r.status = 'confirmed' AND r.deleted_at IS NULL)`;

/** Redeemed discount codes from confirmed registrations. */
export const DISCOUNT_USED_COUNT_SQL = `(SELECT COUNT(*)
  FROM registrations r
  WHERE r.discount_code_id = discount_codes.id AND r.status = 'confirmed' AND r.deleted_at IS NULL)`;

/** Live public team member count using athlete_teams alias `t`. */
export const TEAM_MEMBER_COUNT_SQL = `(SELECT COUNT(*)
  FROM athlete_team_members m
  WHERE m.team_id = t.id)`;
