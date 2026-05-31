INSERT INTO `event_registration_fields` (`event_id`, `field_key`, `label`, `field_type`, `is_required`, `sort_order`)
SELECT e.id, 'emergency_contact', 'Contacto de emergencia', 'text', 1, 2
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

INSERT INTO `event_registration_fields` (`event_id`, `field_key`, `label`, `field_type`, `options_json`, `is_required`, `sort_order`)
SELECT e.id, 'wetsuit', '¿Usarás wetsuit?', 'select', JSON_ARRAY('Sí','No','Tal vez'), 0, 3
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);
