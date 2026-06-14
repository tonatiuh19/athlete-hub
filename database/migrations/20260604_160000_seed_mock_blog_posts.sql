-- Mock blog posts for local dev / demo (platform + organizer scoped, es + en)
-- Safe to re-run: upserts by slug

INSERT INTO `blog_posts` (
  `public_uuid`, `slug`, `title`, `excerpt`, `body_html`, `cover_image_url`,
  `status`, `featured`, `scope`, `organizer_id`, `event_id`,
  `author_admin_id`, `author_member_id`, `author_name`,
  `seo_title`, `seo_description`, `og_image_url`,
  `read_time_minutes`, `locale`, `published_at`
)
SELECT
  'bp000001-0000-4000-8000-000000000001',
  'como-elegir-tu-primera-carrera-en-mexico',
  'Cómo elegir tu primera carrera en México',
  'Guía práctica para debutar en running o trail: distancia, inscripción, equipo y cómo encontrar tu Triboo.',
  '<h2>Empieza con una distancia realista</h2><p>Si nunca has corrido una carrera organizada, un 5K o 10K es el punto de partida ideal. Permite entrenar con calma, aprender el ritmo de un evento real y celebrar la meta sin agotarte.</p><h2>Revisa la logística antes de inscribirte</h2><p>Fecha, ciudad, horario de salida, entrega de kit y política de transferencias. Triboo Sport centraliza todo en la ficha del evento para que compares opciones en minutos.</p><h2>Corre con tu Triboo</h2><p>Inscribirse con amigos aumenta la constancia en el entrenamiento y hace la experiencia más memorable. Invítalos desde la página del evento y armen su plan juntos.</p>',
  'https://images.unsplash.com/photo-1452626212852-811d58933cae?w=1200',
  'published', 1, 'platform', NULL, NULL,
  a.id, NULL, CONCAT(a.first_name, ' ', a.last_name),
  'Cómo elegir tu primera carrera en México | Triboo Sport',
  'Consejos para debutar en carreras en México: distancia, inscripción, equipo y comunidad.',
  'https://images.unsplash.com/photo-1452626212852-811d58933cae?w=1200',
  4, 'es', NOW()
FROM admins a
WHERE a.email = 'admin@athletehub.test'
LIMIT 1
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `status` = 'published',
  `featured` = VALUES(`featured`);

INSERT INTO `blog_posts` (
  `public_uuid`, `slug`, `title`, `excerpt`, `body_html`, `cover_image_url`,
  `status`, `featured`, `scope`, `organizer_id`, `event_id`,
  `author_admin_id`, `author_member_id`, `author_name`,
  `seo_title`, `seo_description`, `og_image_url`,
  `read_time_minutes`, `locale`, `published_at`
)
SELECT
  'bp000002-0000-4000-8000-000000000002',
  'building-your-race-season-with-triboo',
  'Building Your Race Season with Triboo',
  'Plan a balanced season: base building, a target race, recovery weeks, and how your crew keeps you accountable.',
  '<h2>Pick one anchor event</h2><p>Choose the race that matters most this season — a marathon, a trail ultra, or your first triathlon — and build backward from its date.</p><h2>Layer in supporting events</h2><p>Shorter tune-up races keep motivation high without derailing your main block. Use Triboo to discover events that fit your calendar and location.</p><h2>Recover with intention</h2><p>Recovery weeks are not lost training. They are when adaptation happens. Share progress with your Triboo so the group celebrates milestones, not just start lines.</p>',
  'https://images.unsplash.com/photo-1476480862128-209bfaa8dba8?w=1200',
  'published', 0, 'platform', NULL, NULL,
  a.id, NULL, CONCAT(a.first_name, ' ', a.last_name),
  'Building Your Race Season with Triboo',
  'Plan your running or endurance season with Triboo Sport: anchor races, tune-ups, and community accountability.',
  'https://images.unsplash.com/photo-1476480862128-209bfaa8dba8?w=1200',
  3, 'en', NOW()
FROM admins a
WHERE a.email = 'admin@athletehub.test'
LIMIT 1
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `status` = 'published';

INSERT INTO `blog_posts` (
  `public_uuid`, `slug`, `title`, `excerpt`, `body_html`, `cover_image_url`,
  `status`, `featured`, `scope`, `organizer_id`, `event_id`,
  `author_admin_id`, `author_member_id`, `author_name`,
  `seo_title`, `seo_description`, `og_image_url`,
  `read_time_minutes`, `locale`, `published_at`
)
SELECT
  'bp000003-0000-4000-8000-000000000003',
  'run-mexico-preparacion-maraton-cdmx-2026',
  'Run Mexico: preparación para la Gran Carrera Urbana 2026',
  'Desde Run Mexico compartimos tips de hidratación, ritmos por zona y cómo aprovechar el circuito urbano.',
  '<h2>Conoce el circuito</h2><p>Estudia los segmentos en elevación y planifica tu estrategia de negative split en el recorrido urbano.</p><h2>Hidratación y nutrición</h2><p>Prueba geles y bebidas en tus tiradas largas. El día del evento no experimentes nada nuevo.</p><h2>Inscríbete con tiempo</h2><p>Las categorías populares se llenan. Reserva tu lugar en Triboo Sport y arma tu Triboo para entrenar en grupo.</p>',
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200',
  'published', 0, 'organizer', o.id, e.id,
  NULL, om.id, CONCAT(om.first_name, ' ', om.last_name),
  'Preparación Gran Carrera Urbana 2026 | Run Mexico',
  'Consejos oficiales de Run Mexico para la Gran Carrera Urbana 42K 2026.',
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200',
  5, 'es', NOW()
FROM organizers o
JOIN organizer_members om ON om.organizer_id = o.id AND om.email = 'owner@runmexico.test'
JOIN events e ON e.organizer_id = o.id AND e.slug = 'maraton-cdmx-2026'
WHERE o.slug = 'run-mexico'
LIMIT 1
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `status` = 'published';
