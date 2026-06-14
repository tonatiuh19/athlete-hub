/**
 * One-off / ops: resend registration confirmation email by registration id.
 * Usage: node scripts/resend-registration-confirmed.mjs <registrationId>
 */
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { Resend } from "resend";

dotenv.config();

const registrationId = Number(process.argv[2]);
if (!registrationId) {
  console.error("Usage: node scripts/resend-registration-confirmed.mjs <registrationId>");
  process.exit(1);
}

const resendKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.RESEND_FROM_EMAIL?.trim() || "Triboo Sport <onboarding@resend.dev>";
if (!resendKey) {
  console.error("RESEND_API_KEY missing");
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true },
});

const [rows] = await pool.query(
  `SELECT r.registration_number, r.status,
          a.email, a.first_name,
          e.title AS event_title,
          ec.name AS category_name
   FROM registrations r
   JOIN athletes a ON a.id = r.athlete_id
   JOIN events e ON e.id = r.event_id
   JOIN event_categories ec ON ec.id = r.event_category_id
   WHERE r.id = ? LIMIT 1`,
  [registrationId],
);

if (!rows[0]) {
  console.error("Registration not found");
  process.exit(1);
}

const r = rows[0];
const subject = "¡Inscripción confirmada! — Triboo Sport";
const text = `Hola ${r.first_name},\n\nTu inscripción fue procesada correctamente.\n\nEvento: ${r.event_title}\nCategoría: ${r.category_name}\nFolio: ${r.registration_number}\n\nConserva este correo como comprobante.`;

const resend = new Resend(resendKey);
const { data, error } = await resend.emails.send({
  from,
  to: r.email,
  subject,
  text,
  html: `<p>Hola ${r.first_name},</p><p>Tu inscripción fue procesada correctamente.</p><ul><li><strong>Evento:</strong> ${r.event_title}</li><li><strong>Categoría:</strong> ${r.category_name}</li><li><strong>Folio:</strong> ${r.registration_number}</li></ul><p>Conserva este correo como comprobante.</p>`,
});

await pool.end();

if (error) {
  console.error("Resend error:", error);
  process.exit(1);
}

console.log("Sent to", r.email, "id:", data?.id);
