-- Seed active waivers for events that require them but have none configured.
INSERT INTO `event_waivers` (`event_id`, `title`, `content_html`, `version`, `is_active`, `sort_order`)
SELECT
  e.id,
  CONCAT('Exoneración de Responsabilidad — ', e.title),
  '<p>Al inscribirme declaro estar en condiciones físicas aptas para participar. Exonero al organizador y a sus colaboradores de cualquier responsabilidad por lesiones o incidentes durante el evento.</p>',
  1,
  1,
  0
FROM `events` e
WHERE e.requires_waiver = 1
  AND e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `event_waivers` ew
    WHERE ew.event_id = e.id AND ew.is_active = 1
  );
