-- Replace removed/broken Unsplash photo IDs with verified URLs

UPDATE `events` SET
  `hero_image_url` = 'https://images.unsplash.com/photo-1452626212852-811d58933cae?w=1200&q=80&auto=format&fit=crop',
  `banner_image_url` = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&q=80&auto=format&fit=crop'
WHERE `slug` = 'maraton-cdmx-2026';

UPDATE `events` SET
  `banner_image_url` = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80&auto=format&fit=crop'
WHERE `slug` = 'triatlon-acapulco-2026';

UPDATE `events` SET
  `hero_image_url` = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80&auto=format&fit=crop',
  `banner_image_url` = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&q=80&auto=format&fit=crop'
WHERE `slug` = 'carrera-10k-polanco-2026';

UPDATE `events` SET
  `banner_image_url` = 'https://images.unsplash.com/photo-1486218119243-13883505764c?w=1600&q=80&auto=format&fit=crop'
WHERE `slug` = 'hyrox-mexico-city-2025';
