-- Fix INEGI municipios linked to wrong geo_states (cve_ent 05–08 were swapped in import).
-- Example: Tapilula (cve_ent 07) was under Coahuila instead of Chiapas.

UPDATE `geo_cities` gc
INNER JOIN `geo_states` gs
  ON gs.country = 'MX'
 AND gs.code = CASE gc.cve_ent
   WHEN '05' THEN 'COA'
   WHEN '06' THEN 'COL'
   WHEN '07' THEN 'CHP'
   WHEN '08' THEN 'CHH'
 END
SET gc.state_id = gs.id
WHERE gc.cve_ent IN ('05', '06', '07', '08')
  AND gc.cvegeo IS NOT NULL
  AND gc.state_id <> gs.id;
