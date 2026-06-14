-- Rich HTML convocatorias + sport-specific images for mock events

UPDATE `events` SET
  `hero_image_url` = 'https://images.unsplash.com/photo-1483721310028-03333fb77b88?w=1200&q=80&auto=format&fit=crop',
  `banner_image_url` = 'https://images.unsplash.com/photo-1461894177073-45e78e2e7ef2?w=1600&q=80&auto=format&fit=crop',
  `description` = '<p>La <strong>Gran Carrera Urbana 42K 2026</strong> es una carrera en ciudad con circuito certificado, cronometraje por chip y experiencia pensada para debutantes y fondistas experimentados.</p>
<h2>Distancias y categorías</h2>
<ul>
<li><strong>42K</strong> — Maratón completa · 18+ años · salida 06:00</li>
<li><strong>21K</strong> — Media maratón · 16+ años · salida 06:15</li>
<li><strong>10K</strong> — Carrera urbana · todas las edades con autorización · salida 07:30</li>
</ul>
<h2>Incluye tu inscripción</h2>
<ul>
<li>Playera técnica oficial</li>
<li>Número con nombre impreso</li>
<li>Chip de cronometraje y resultados en vivo</li>
<li>Medalla finisher</li>
<li>Hidratación cada 2.5 km y puntos de apoyo</li>
<li>Zona de recuperación post-meta</li>
</ul>
<h2>Cronograma</h2>
<table>
<thead><tr><th>Hora</th><th>Actividad</th></tr></thead>
<tbody>
<tr><td>05:00</td><td>Apertura de entrega de paquetes</td></tr>
<tr><td>05:45</td><td>Calentamiento guiado en zona de salida</td></tr>
<tr><td>06:00</td><td>Salida 42K y 21K</td></tr>
<tr><td>07:30</td><td>Salida 10K</td></tr>
<tr><td>14:00</td><td>Cierre oficial de meta</td></tr>
</tbody>
</table>
<h2>Requisitos</h2>
<ul>
<li>Identificación oficial el día del evento</li>
<li>Waiver digital firmado al inscribirte</li>
<li>Menores con carta responsiva del tutor</li>
</ul>
<blockquote><strong>Nota:</strong> Cupo limitado por distancia. Las categorías populares pueden cerrar antes de la fecha límite de inscripción.</blockquote>'
WHERE `slug` = 'maraton-cdmx-2026';

UPDATE `events` SET
  `hero_image_url` = 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80&auto=format&fit=crop',
  `banner_image_url` = 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1600&q=80&auto=format&fit=crop',
  `description` = '<p>El <strong>Desafío Trail Alto 2026</strong> es una carrera de montaña con terreno técnico, gran desnivel y dos distancias para distintos niveles de experiencia.</p>
<h2>Distancias</h2>
<ul>
<li><strong>21K Trail</strong> — ~1,200 m de desnivel positivo · categorías por edad y género</li>
<li><strong>10K Trail</strong> — Recorrido introductorio · ideal para tu primer trail</li>
</ul>
<h2>Seguridad y logística</h2>
<ul>
<li>Marcaje completo de ruta y personal en puntos críticos</li>
<li>Puestos de hidratación y electrolitos</li>
<li>Servicio médico y rescate en montaña</li>
<li>Obligatorio: hidratación mínima 500 ml y silbato</li>
</ul>
<h2>Equipo recomendado</h2>
<ul>
<li>Calzado de trail con buen agarre</li>
<li>Capa térmica ligera (clima de montaña variable)</li>
<li>Gorro o visera y bloqueador solar</li>
<li>Mochila o cinturón para agua y geles</li>
</ul>
<h2>Cronograma</h2>
<table>
<thead><tr><th>Hora</th><th>Actividad</th></tr></thead>
<tbody>
<tr><td>05:30</td><td>Registro y entrega de números</td></tr>
<tr><td>06:45</td><td>Briefing de seguridad</td></tr>
<tr><td>07:00</td><td>Salida 21K</td></tr>
<tr><td>07:30</td><td>Salida 10K</td></tr>
<tr><td>14:00</td><td>Cierre de meta y premiación</td></tr>
</tbody>
</table>
<blockquote><strong>Importante:</strong> La organización puede modificar el recorrido por condiciones climáticas. Se notificará por correo y en la app del evento.</blockquote>'
WHERE `slug` = 'trail-nevado-toluca-2026';

UPDATE `events` SET
  `hero_image_url` = 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200&q=80&auto=format&fit=crop',
  `banner_image_url` = 'https://images.unsplash.com/photo-1517649763962-0e623b1a9f84?w=1600&q=80&auto=format&fit=crop',
  `description` = '<p>El <strong>Triatlón Sprint &amp; Olímpico 2026</strong> combina natación en aguas abiertas, ciclismo y carrera en un formato clásico para atletas de todos los niveles.</p>
<h2>Formatos</h2>
<ul>
<li><strong>Sprint</strong> — 750 m natación · 20 km ciclismo · 5 km carrera</li>
<li><strong>Olímpico</strong> — 1.5 km natación · 40 km ciclismo · 10 km carrera</li>
<li><strong>Relevos</strong> — Equipos de 2 o 3 integrantes (un segmento por persona)</li>
</ul>
<h2>Incluye</h2>
<ul>
<li>Número y chip de cronometraje en los tres segmentos</li>
<li>Transiciones delimitadas y asistencia en zona de cambio</li>
<li>Seguridad acuática con kayaks y personal capacitado</li>
<li>Playera y medalla finisher</li>
</ul>
<h2>Material obligatorio</h2>
<ul>
<li>Bicicleta en buen estado con frenos funcionales</li>
<li>Casco homologado (obligatorio en bici)</li>
<li>Traje de neopreno recomendado según temperatura del agua</li>
<li>Gafas de natación</li>
</ul>
<h2>Cronograma</h2>
<table>
<thead><tr><th>Hora</th><th>Actividad</th></tr></thead>
<tbody>
<tr><td>05:00</td><td>Check-in y revisión de equipo</td></tr>
<tr><td>06:00</td><td>Briefing general</td></tr>
<tr><td>06:30</td><td>Salida Olímpico</td></tr>
<tr><td>08:00</td><td>Salida Sprint</td></tr>
<tr><td>12:00</td><td>Premiación</td></tr>
</tbody>
</table>
<blockquote><strong>Principiantes:</strong> Ofrecemos clínica de transiciones la víspera (cupo limitado, confirma al inscribirte).</blockquote>'
WHERE `slug` = 'triatlon-acapulco-2026';

UPDATE `events` SET
  `hero_image_url` = 'https://images.unsplash.com/photo-1571008887538-b36bb08f4571?w=1200&q=80&auto=format&fit=crop',
  `banner_image_url` = 'https://images.unsplash.com/photo-1513597114898-0605b8787daa?w=1600&q=80&auto=format&fit=crop',
  `description` = '<p>La <strong>10K Nocturna 2026</strong> es una carrera urbana al atardecer: diez kilómetros con ambiente festivo, música en vivo y circuito iluminado.</p>
<h2>Formato</h2>
<ul>
<li><strong>10K general</strong> — Salida única 19:00 · cronometraje chip</li>
<li><strong>Caminata 5K</strong> — Mismo ambiente, ritmo recreativo (cupos limitados)</li>
</ul>
<h2>Experiencia</h2>
<ul>
<li>Iluminación de ruta y chalecos LED para corredores</li>
<li>DJs y zona de food trucks al finalizar</li>
<li>Premiación inmediata por categorías</li>
<li>Foto oficial de meta incluida</li>
</ul>
<h2>Incluye tu kit</h2>
<ul>
<li>Playera con diseño reflectante</li>
<li>Número y chip</li>
<li>Medalla finisher</li>
<li>1 bebida de recuperación</li>
</ul>
<h2>Cronograma</h2>
<table>
<thead><tr><th>Hora</th><th>Actividad</th></tr></thead>
<tbody>
<tr><td>17:00</td><td>Entrega de paquetes y activación</td></tr>
<tr><td>18:30</td><td>Calentamiento grupal</td></tr>
<tr><td>19:00</td><td>Salida 10K</td></tr>
<tr><td>19:15</td><td>Salida caminata 5K</td></tr>
<tr><td>21:30</td><td>Premiación y cierre</td></tr>
</tbody>
</table>
<blockquote><strong>Tip:</strong> Llega 60 minutos antes para evitar filas en entrega de número.</blockquote>'
WHERE `slug` = 'carrera-10k-polanco-2026';

UPDATE `events` SET
  `hero_image_url` = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80&auto=format&fit=crop',
  `banner_image_url` = 'https://images.unsplash.com/photo-1583500178690-34465975024e?w=1600&q=80&auto=format&fit=crop',
  `description` = '<p>El <strong>Desafío Híbrido 2025</strong> combinó carreras de 1 km intercaladas con estaciones funcionales. Este evento ya concluyó; los resultados oficiales están publicados en la plataforma.</p>
<h2>Formato de competencia</h2>
<ul>
<li><strong>Open</strong> — Estándar con pesos moderados</li>
<li><strong>Pro</strong> — Cargas avanzadas y ritmo exigente</li>
<li><strong>Doubles</strong> — Parejas que alternan estaciones</li>
<li><strong>Relay</strong> — Equipos de 4 atletas</li>
</ul>
<h2>Estaciones (orden oficial)</h2>
<ol>
<li>Run 1 km</li>
<li>SkiErg · 1,000 m</li>
<li>Run 1 km</li>
<li>Sled push · 50 m</li>
<li>Run 1 km</li>
<li>Burpee broad jumps · 80 m</li>
<li>Run 1 km</li>
<li>Row · 1,000 m</li>
<li>Run 1 km</li>
<li>Farmers carry · 200 m</li>
<li>Run 1 km</li>
<li>Sandbag lunges · 100 m</li>
<li>Run 1 km</li>
<li>Wall balls · 100 reps</li>
<li>Run 1 km — meta</li>
</ol>
<h2>Resultados</h2>
<p>Consulta tiempos oficiales, splits por estación y posición por categoría en la sección <strong>Resultados</strong> de tu portal de atleta o en la ficha del evento.</p>
<blockquote>Gracias a todos los atletas que participaron. Próxima edición: anuncio en Triboo Sport y newsletter de Run Mexico.</blockquote>'
WHERE `slug` = 'hyrox-mexico-city-2025';

