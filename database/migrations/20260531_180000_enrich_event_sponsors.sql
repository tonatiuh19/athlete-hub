-- Enrich strategic sponsors for demo events (logos + tiers for carousel)
-- TiDB Cloud / MySQL 8.0

UPDATE event_sponsors es
JOIN events e ON e.id = es.event_id
SET es.logo_url = 'https://logo.clearbit.com/garmin.com',
    es.website_url = 'https://www.garmin.com',
    es.tier = 'title'
WHERE e.slug = 'triatlon-acapulco-2026' AND es.name = 'Garmin';

INSERT INTO `event_sponsors` (`event_id`, `name`, `logo_url`, `website_url`, `tier`, `sort_order`)
SELECT e.id, 'Red Bull', 'https://logo.clearbit.com/redbull.com', 'https://www.redbull.com', 'gold', 2
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'Red Bull');

INSERT INTO `event_sponsors` (`event_id`, `name`, `logo_url`, `website_url`, `tier`, `sort_order`)
SELECT e.id, 'Specialized', 'https://logo.clearbit.com/specialized.com', 'https://www.specialized.com', 'gold', 3
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'Specialized');

INSERT INTO `event_sponsors` (`event_id`, `name`, `logo_url`, `website_url`, `tier`, `sort_order`)
SELECT e.id, 'Zoot Sports', 'https://logo.clearbit.com/zootsports.com', 'https://www.zootsports.com', 'silver', 4
FROM events e WHERE e.slug = 'triatlon-acapulco-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'Zoot Sports');

UPDATE event_sponsors es
JOIN events e ON e.id = es.event_id
SET es.website_url = COALESCE(es.website_url, 'https://www.gatorade.com')
WHERE e.slug = 'maraton-cdmx-2026' AND es.name = 'Gatorade';

UPDATE event_sponsors es
JOIN events e ON e.id = es.event_id
SET es.logo_url = COALESCE(es.logo_url, 'https://logo.clearbit.com/nike.com'),
    es.website_url = COALESCE(es.website_url, 'https://www.nike.com')
WHERE e.slug = 'maraton-cdmx-2026' AND es.name = 'Nike Running';

INSERT INTO `event_sponsors` (`event_id`, `name`, `logo_url`, `website_url`, `tier`, `sort_order`)
SELECT e.id, 'ASICS', 'https://logo.clearbit.com/asics.com', 'https://www.asics.com', 'gold', 3
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'ASICS');

INSERT INTO `event_sponsors` (`event_id`, `name`, `logo_url`, `website_url`, `tier`, `sort_order`)
SELECT e.id, 'TCS', 'https://logo.clearbit.com/tcs.com', 'https://www.tcs.com', 'title', 0
FROM events e WHERE e.slug = 'maraton-cdmx-2026'
  AND NOT EXISTS (SELECT 1 FROM event_sponsors es WHERE es.event_id = e.id AND es.name = 'TCS');
