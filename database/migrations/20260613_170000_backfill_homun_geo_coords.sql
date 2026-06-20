-- Backfill centroid coordinates for Homún, Yucatán (catalog had NULL lat/lng).
-- Source: INEGI municipio reference / verified map pin for Homún centro.

UPDATE `geo_cities` gc
JOIN `geo_states` gs ON gs.id = gc.state_id
SET
  gc.lat = 20.7391800,
  gc.lng = -89.2849000,
  gc.source = 'manual'
WHERE gs.country = 'MX'
  AND gs.code = 'YUC'
  AND gc.name = 'Homún'
  AND gc.lat IS NULL;
