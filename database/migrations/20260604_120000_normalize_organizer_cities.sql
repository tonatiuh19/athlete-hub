-- Normalize organizer city values to canonical geo_cities names (MX catalog).
-- Fixes free-text entries like "mexico" that do not match the catalog.

-- Exact case-insensitive match → canonical catalog spelling
UPDATE organizers o
INNER JOIN geo_cities gc ON gc.is_active = 1 AND LOWER(TRIM(gc.name)) = LOWER(TRIM(o.city))
SET o.city = gc.name
WHERE o.deleted_at IS NULL
  AND o.city IS NOT NULL
  AND TRIM(o.city) <> ''
  AND o.city <> gc.name;

-- Common aliases → Ciudad de México (geo_cities.id = 13)
UPDATE organizers
SET city = 'Ciudad de México'
WHERE deleted_at IS NULL
  AND country = 'MX'
  AND LOWER(TRIM(city)) IN (
    'mexico',
    'méxico',
    'cdmx',
    'ciudad de mexico',
    'mexico city',
    'df',
    'distrito federal'
  );
