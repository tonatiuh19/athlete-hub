-- Generic display names (option B) for demo/mock events — slugs unchanged.

UPDATE `events` SET
  `title` = 'Gran Carrera Urbana 42K 2026',
  `short_description` = 'Carrera urbana de larga distancia con opciones 42K, 21K y 10K.',
  `description` = 'La gran carrera urbana reúne a miles de corredores en un circuito certificado. Chip timing, hidratación en ruta, medalla finisher y zona de recuperación post-meta. Incluye playera técnica y número con nombre.',
  `search_keywords` = 'maraton 42k running urbana carrera larga ciudad'
WHERE `slug` = 'maraton-cdmx-2026';

UPDATE `events` SET
  `title` = 'Desafío Trail Alto 2026',
  `short_description` = 'Carrera de montaña con 21K y 10K en terreno técnico y gran desnivel.',
  `description` = 'Desafío en montaña con dos distancias y fuerte desnivel. Seguridad en ruta, puntos de hidratación y premios por categoría.',
  `search_keywords` = 'trail montaña alto running 21k 10k desafío'
WHERE `slug` = 'trail-nevado-toluca-2026';

UPDATE `events` SET
  `title` = 'Triatlón Sprint & Olímpico 2026',
  `short_description` = 'Sprint y distancia olímpica en formato natación, ciclismo y carrera.',
  `description` = 'Triatlón con natación en aguas abiertas, ciclismo y carrera. Categorías por edad, relevos y opción para principiantes.',
  `search_keywords` = 'triatlon sprint olimpico natacion ciclismo running'
WHERE `slug` = 'triatlon-acapulco-2026';

UPDATE `events` SET
  `title` = '10K Nocturna 2026',
  `short_description` = 'Diez kilómetros en formato nocturno por circuito urbano.',
  `description` = '10K nocturno con salida al anochecer, ambiente festivo, zona de comida y premiación. Ideal para PRs y corredores de todos los niveles.',
  `search_keywords` = '10k nocturna carrera urbana running'
WHERE `slug` = 'carrera-10k-polanco-2026';

UPDATE `events` SET
  `title` = 'Desafío Híbrido 2025',
  `short_description` = 'Competencia de fitness que combina carrera y estaciones funcionales.',
  `description` = 'Combina running con estaciones funcionales. Categorías individual, parejas y relevos. Evento completado — resultados oficiales publicados.',
  `search_keywords` = 'fitness funcional hibrido estaciones running'
WHERE `slug` = 'hyrox-mexico-city-2025';

UPDATE `blog_posts` SET
  `title` = 'Run Mexico: preparación para la Gran Carrera Urbana 2026',
  `excerpt` = 'Desde Run Mexico compartimos tips de hidratación, ritmos por zona y cómo aprovechar el circuito urbano.',
  `seo_title` = 'Preparación Gran Carrera Urbana 2026 | Run Mexico',
  `seo_description` = 'Consejos oficiales de Run Mexico para la Gran Carrera Urbana 42K 2026.'
WHERE `slug` = 'run-mexico-preparacion-maraton-cdmx-2026';
