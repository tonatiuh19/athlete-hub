import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import mysql, {
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import twilio from "twilio";
import Stripe from "stripe";
import { createClerkClient, verifyToken } from "@clerk/backend";

// ============================================================================
// LOCALE UTILITIES (inlined for Vercel serverless bundle)
// ============================================================================

type AppLocale = "es" | "en";

const DEFAULT_LOCALE: AppLocale = "es";
const SUPPORTED_LOCALES: AppLocale[] = ["es", "en"];

function normalizeLocale(input?: string | null): AppLocale {
  if (!input) return DEFAULT_LOCALE;
  const tag = input.trim().toLowerCase();
  if (tag.startsWith("en")) return "en";
  if (tag.startsWith("es")) return "es";
  return DEFAULT_LOCALE;
}

function localeFromAcceptLanguage(header?: string | null): AppLocale | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.split(";")[0]?.trim());
  for (const part of parts) {
    const normalized = normalizeLocale(part);
    if (SUPPORTED_LOCALES.includes(normalized)) return normalized;
  }
  return null;
}

function resolveLocale(...candidates: (string | null | undefined)[]): AppLocale {
  for (const c of candidates) {
    if (c) return normalizeLocale(c);
  }
  return DEFAULT_LOCALE;
}

// ============================================================================
// EMAIL TEMPLATES (inlined for Vercel serverless bundle)
// ============================================================================

const EMAIL_BRAND = {
  navyDeep: "#050816",
  bgDark: "#0A0F1F",
  surfaceDark: "#111827",
  cyan: "#00E5FF",
  blueElectric: "#00BFFF",
  purpleAccent: "#7C4DFF",
  success: "#00E676",
  textPrimary: "#F2F2F2",
  textMuted: "#94A3B8",
  textDim: "#64748B",
  border: "#1E293B",
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

type EmailTemplateKind =
  | "otp"
  | "welcomeAthlete"
  | "welcomeStaff"
  | "registrationConfirmed";

type EmailAudience = "athlete" | "admin" | "organizer";

function emailLogoIcon(size = 22, stroke = EMAIL_BRAND.navyDeep): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>`;
}

function emailCheckIcon(size = 16, stroke = EMAIL_BRAND.success): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;display:inline-block;"><path d="M20 6 9 17l-5-5"/></svg>`;
}

type EmailStrings = {
  subjects: Record<EmailTemplateKind, string>;
  otp: {
    preheader: string;
    title: string;
    greeting: string;
    intro: string;
    expiry: string;
    security: string;
    ignore: string;
  };
  welcomeAthlete: {
    preheader: string;
    title: string;
    greeting: string;
    intro: string;
    cta: string;
    features: [string, string, string];
  };
  welcomeStaff: {
    preheader: string;
    title: string;
    greeting: string;
    introAdmin: string;
    introOrganizer: string;
    cta: string;
  };
  registrationConfirmed: {
    preheader: string;
    title: string;
    greeting: string;
    intro: string;
    eventLabel: string;
    categoryLabel: string;
    folioLabel: string;
    cta: string;
  };
  footer: {
    tagline: string;
    help: string;
    copyright: string;
  };
  sms: {
    otp: string;
  };
};

const EMAIL_STRINGS_ES: EmailStrings = {
  subjects: {
    otp: "Tu código de verificación — Athlete Hub",
    welcomeAthlete: "¡Bienvenido a Athlete Hub!",
    welcomeStaff: "Bienvenido al Staff Console — Athlete Hub",
    registrationConfirmed: "¡Inscripción confirmada! — Athlete Hub",
  },
  otp: {
    preheader: "Tu código de acceso expira en 10 minutos",
    title: "Código de verificación",
    greeting: "Hola {{name}},",
    intro: "Usa este código para acceder a tu cuenta de Athlete Hub:",
    expiry: "Expira en {{minutes}} minutos. No lo compartas con nadie.",
    security:
      "Si no solicitaste este código, puedes ignorar este correo de forma segura.",
    ignore: "¿No fuiste tú? Ignora este mensaje.",
  },
  welcomeAthlete: {
    preheader: "Tu portal de atleta está listo",
    title: "¡Bienvenido al equipo!",
    greeting: "Hola {{name}},",
    intro:
      "Tu cuenta está activa. Desde tu portal puedes inscribirte a eventos, ver tus QR y consultar resultados.",
    cta: "Ir a mi portal",
    features: [
      "Inscripciones en segundos",
      "QR y folio al instante",
      "Resultados y rankings",
    ],
  },
  welcomeStaff: {
    preheader: "Acceso al panel de operaciones",
    title: "Bienvenido al Staff Console",
    greeting: "Hola {{name}},",
    introAdmin:
      "Tienes acceso al panel de administración de Athlete Hub. Gestiona la plataforma, métricas y operaciones globales.",
    introOrganizer:
      "Tu hub de organizador está listo. Administra eventos, inscripciones y pagos desde un solo lugar.",
    cta: "Abrir consola",
  },
  registrationConfirmed: {
    preheader: "Tu lugar en la competencia está asegurado",
    title: "¡Inscripción confirmada!",
    greeting: "Hola {{name}},",
    intro: "Tu registro fue procesado correctamente. Guarda este correo como comprobante.",
    eventLabel: "Evento",
    categoryLabel: "Categoría",
    folioLabel: "Folio",
    cta: "Ver mi inscripción",
  },
  footer: {
    tagline: "La plataforma de eventos deportivos de México",
    help: "¿Necesitas ayuda? Responde a este correo o visita nuestro centro de soporte.",
    copyright: "© {{year}} Athlete Hub. Todos los derechos reservados.",
  },
  sms: {
    otp: "Athlete Hub: tu código es {{code}}. Expira en {{minutes}} min.",
  },
};

const EMAIL_STRINGS_EN: EmailStrings = {
  subjects: {
    otp: "Your verification code — Athlete Hub",
    welcomeAthlete: "Welcome to Athlete Hub!",
    welcomeStaff: "Welcome to Staff Console — Athlete Hub",
    registrationConfirmed: "Registration confirmed! — Athlete Hub",
  },
  otp: {
    preheader: "Your access code expires in 10 minutes",
    title: "Verification code",
    greeting: "Hi {{name}},",
    intro: "Use this code to sign in to your Athlete Hub account:",
    expiry: "Expires in {{minutes}} minutes. Never share this code.",
    security:
      "If you didn't request this code, you can safely ignore this email.",
    ignore: "Wasn't you? Ignore this message.",
  },
  welcomeAthlete: {
    preheader: "Your athlete portal is ready",
    title: "Welcome to the team!",
    greeting: "Hi {{name}},",
    intro:
      "Your account is active. From your portal you can register for events, view QR codes, and check results.",
    cta: "Go to my portal",
    features: [
      "Register in seconds",
      "Instant QR & bib number",
      "Results & rankings",
    ],
  },
  welcomeStaff: {
    preheader: "Operations panel access",
    title: "Welcome to Staff Console",
    greeting: "Hi {{name}},",
    introAdmin:
      "You have access to the Athlete Hub admin panel. Manage the platform, metrics, and global operations.",
    introOrganizer:
      "Your organizer hub is ready. Manage events, registrations, and payments in one place.",
    cta: "Open console",
  },
  registrationConfirmed: {
    preheader: "Your spot in the race is secured",
    title: "Registration confirmed!",
    greeting: "Hi {{name}},",
    intro: "Your registration was processed successfully. Keep this email as proof.",
    eventLabel: "Event",
    categoryLabel: "Category",
    folioLabel: "Registration #",
    cta: "View my registration",
  },
  footer: {
    tagline: "Mexico's sports events platform",
    help: "Need help? Reply to this email or visit our support center.",
    copyright: "© {{year}} Athlete Hub. All rights reserved.",
  },
  sms: {
    otp: "Athlete Hub: your code is {{code}}. Expires in {{minutes}} min.",
  },
};

const EMAIL_STRINGS: Record<AppLocale, EmailStrings> = {
  es: EMAIL_STRINGS_ES,
  en: EMAIL_STRINGS_EN,
};

function emailStrings(locale: AppLocale): EmailStrings {
  return EMAIL_STRINGS[locale] ?? EMAIL_STRINGS.es;
}

function interpolateEmail(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));
}

function smsOtpMessage(
  locale: AppLocale,
  code: string,
  minutes: number,
): string {
  return interpolateEmail(emailStrings(locale).sms.otp, { code, minutes });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface BaseEmailOptions {
  locale: AppLocale;
  preheader: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  appUrl: string;
}

function emailShell(opts: BaseEmailOptions): string {
  const { locale, preheader, title, bodyHtml, cta, appUrl } = opts;
  const s = emailStrings(locale);
  const year = new Date().getFullYear();
  const ctaBlock = cta
    ? `<tr><td style="padding:28px 0 8px;text-align:center;">
        <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,${EMAIL_BRAND.cyan} 0%,${EMAIL_BRAND.blueElectric} 100%);color:${EMAIL_BRAND.navyDeep};font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,229,255,0.35);">${escapeHtml(cta.label)}</a>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale === "es" ? "es-MX" : "en"}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="supported-color-schemes" content="dark"/>
  <title>${escapeHtml(title)}</title>
  <!--[if mso]><style>table{border-collapse:collapse;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.bgDark};font-family:${EMAIL_BRAND.fontFamily};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${EMAIL_BRAND.bgDark};min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:${EMAIL_BRAND.surfaceDark};border-radius:16px;border:1px solid ${EMAIL_BRAND.border};overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.45);">
        <tr><td style="background:linear-gradient(135deg,${EMAIL_BRAND.navyDeep} 0%,${EMAIL_BRAND.bgDark} 50%,${EMAIL_BRAND.surfaceDark} 100%);padding:32px 40px 24px;border-bottom:2px solid ${EMAIL_BRAND.cyan};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;background:linear-gradient(135deg,${EMAIL_BRAND.cyan},${EMAIL_BRAND.blueElectric});border-radius:10px;vertical-align:middle;">${emailLogoIcon()}</div>
                <span style="display:inline-block;margin-left:12px;font-size:22px;font-weight:800;color:${EMAIL_BRAND.textPrimary};vertical-align:middle;letter-spacing:-0.5px;">Athlete Hub</span>
              </td>
            </tr>
            <tr><td style="padding-top:20px;">
              <h1 style="margin:0;font-size:26px;font-weight:800;color:${EMAIL_BRAND.textPrimary};line-height:1.25;">${escapeHtml(title)}</h1>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px 40px;color:${EMAIL_BRAND.textPrimary};font-size:16px;line-height:1.65;">
          ${bodyHtml}
        </td></tr>
        ${ctaBlock}
        <tr><td style="padding:24px 40px 32px;border-top:1px solid ${EMAIL_BRAND.border};background-color:${EMAIL_BRAND.navyDeep};">
          <p style="margin:0 0 8px;font-size:13px;color:${EMAIL_BRAND.cyan};font-weight:600;">${escapeHtml(s.footer.tagline)}</p>
          <p style="margin:0 0 16px;font-size:12px;color:${EMAIL_BRAND.textDim};line-height:1.5;">${escapeHtml(s.footer.help)}</p>
          <p style="margin:0;font-size:11px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(interpolateEmail(s.footer.copyright, { year }))}</p>
          <p style="margin:12px 0 0;font-size:11px;"><a href="${escapeHtml(appUrl)}" style="color:${EMAIL_BRAND.blueElectric};text-decoration:none;">${escapeHtml(appUrl.replace(/^https?:\/\//, ""))}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function otpCodeBlock(code: string): string {
  const digits = code.split("");
  const cells = digits
    .map(
      (d) =>
        `<td style="width:48px;height:56px;background:${EMAIL_BRAND.navyDeep};border:1px solid ${EMAIL_BRAND.cyan};border-radius:10px;text-align:center;font-size:28px;font-weight:800;color:${EMAIL_BRAND.cyan};letter-spacing:0;font-family:monospace;">${escapeHtml(d)}</td>`,
    )
    .join('<td style="width:8px;"></td>');

  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;"><tr>${cells}</tr></table>`;
}

function buildOtpEmail(params: {
  locale: AppLocale;
  firstName: string;
  code: string;
  minutes?: number;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { locale, firstName, code, minutes = 10, appUrl } = params;
  const s = emailStrings(locale);
  const bodyHtml = `
    <p style="margin:0 0 12px;color:${EMAIL_BRAND.textPrimary};font-size:17px;">${escapeHtml(interpolateEmail(s.otp.greeting, { name: firstName }))}</p>
    <p style="margin:0 0 8px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.otp.intro)}</p>
    ${otpCodeBlock(code)}
    <p style="margin:16px 0 0;text-align:center;font-size:13px;color:${EMAIL_BRAND.textDim};">${interpolateEmail(escapeHtml(s.otp.expiry), { minutes })}</p>
    <p style="margin:20px 0 0;padding:16px;background:${EMAIL_BRAND.navyDeep};border-radius:10px;border-left:3px solid ${EMAIL_BRAND.purpleAccent};font-size:13px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.otp.security)}</p>`;

  const subject = s.subjects.otp;
  const html = emailShell({
    locale,
    preheader: s.otp.preheader,
    title: s.otp.title,
    bodyHtml,
    appUrl,
  });
  const text = `${interpolateEmail(s.otp.greeting, { name: firstName })}\n\n${s.otp.intro}\n\n${code}\n\n${interpolateEmail(s.otp.expiry, { minutes })}`;

  return { subject, html, text };
}

function buildWelcomeAthleteEmail(params: {
  locale: AppLocale;
  firstName: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { locale, firstName, appUrl } = params;
  const s = emailStrings(locale);
  const features = s.welcomeAthlete.features
    .map(
      (f) =>
        `<tr><td style="padding:8px 0;"><span style="margin-right:8px;">${emailCheckIcon()}</span><span style="color:${EMAIL_BRAND.textMuted};">${escapeHtml(f)}</span></td></tr>`,
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${interpolateEmail(escapeHtml(s.welcomeAthlete.greeting), { name: escapeHtml(firstName) })}</p>
    <p style="margin:0 0 20px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.welcomeAthlete.intro)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_BRAND.navyDeep};border-radius:12px;padding:4px 16px;border:1px solid ${EMAIL_BRAND.border};">${features}</table>`;

  const portalUrl = `${appUrl.replace(/\/$/, "")}/portal`;
  return {
    subject: s.subjects.welcomeAthlete,
    html: emailShell({
      locale,
      preheader: s.welcomeAthlete.preheader,
      title: s.welcomeAthlete.title,
      bodyHtml,
      cta: { label: s.welcomeAthlete.cta, url: portalUrl },
      appUrl,
    }),
    text: `${interpolateEmail(s.welcomeAthlete.greeting, { name: firstName })}\n\n${s.welcomeAthlete.intro}\n\n${portalUrl}`,
  };
}

function buildWelcomeStaffEmail(params: {
  locale: AppLocale;
  firstName: string;
  audience: EmailAudience;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { locale, firstName, audience, appUrl } = params;
  const s = emailStrings(locale);
  const intro =
    audience === "admin"
      ? s.welcomeStaff.introAdmin
      : s.welcomeStaff.introOrganizer;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${interpolateEmail(escapeHtml(s.welcomeStaff.greeting), { name: escapeHtml(firstName) })}</p>
    <p style="margin:0;color:${EMAIL_BRAND.textMuted};">${escapeHtml(intro)}</p>`;

  const staffUrl = `${appUrl.replace(/\/$/, "")}/staff`;
  return {
    subject: s.subjects.welcomeStaff,
    html: emailShell({
      locale,
      preheader: s.welcomeStaff.preheader,
      title: s.welcomeStaff.title,
      bodyHtml,
      cta: { label: s.welcomeStaff.cta, url: staffUrl },
      appUrl,
    }),
    text: `${interpolateEmail(s.welcomeStaff.greeting, { name: firstName })}\n\n${intro}\n\n${staffUrl}`,
  };
}

function buildRegistrationConfirmedEmail(params: {
  locale: AppLocale;
  firstName: string;
  eventTitle: string;
  categoryName: string;
  registrationNumber: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const {
    locale,
    firstName,
    eventTitle,
    categoryName,
    registrationNumber,
    appUrl,
  } = params;
  const s = emailStrings(locale);

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid ${EMAIL_BRAND.border};"><span style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:${EMAIL_BRAND.textDim};">${escapeHtml(label)}</span><br/><span style="font-size:16px;font-weight:600;color:${EMAIL_BRAND.textPrimary};">${escapeHtml(value)}</span></td></tr>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${interpolateEmail(escapeHtml(s.registrationConfirmed.greeting), { name: escapeHtml(firstName) })}</p>
    <p style="margin:0 0 20px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.registrationConfirmed.intro)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_BRAND.navyDeep};border-radius:12px;padding:8px 20px;border:1px solid ${EMAIL_BRAND.cyan};">
      ${detailRow(s.registrationConfirmed.eventLabel, eventTitle)}
      ${detailRow(s.registrationConfirmed.categoryLabel, categoryName)}
      ${detailRow(s.registrationConfirmed.folioLabel, registrationNumber)}
    </table>`;

  const regUrl = `${appUrl.replace(/\/$/, "")}/portal/registrations`;
  return {
    subject: s.subjects.registrationConfirmed,
    html: emailShell({
      locale,
      preheader: s.registrationConfirmed.preheader,
      title: s.registrationConfirmed.title,
      bodyHtml,
      cta: { label: s.registrationConfirmed.cta, url: regUrl },
      appUrl,
    }),
    text: `${interpolateEmail(s.registrationConfirmed.greeting, { name: firstName })}\n\n${eventTitle} — ${categoryName}\n${registrationNumber}`,
  };
}

// ============================================================================
// ENV VALIDATION
// ============================================================================

const MISSING_DB_VARS = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"].filter(
  (k) => !process.env[k],
);
if (MISSING_DB_VARS.length > 0) {
  console.error(
    `Missing required env vars: ${MISSING_DB_VARS.join(", ")}. All API routes will return 503.`,
  );
}

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    console.warn(
      "WARNING: Using default JWT_SECRET. Set JWT_SECRET in .env for production!",
    );
    return "default-jwt-secret-CHANGE-THIS-IN-PRODUCTION";
  })();

const APP_URL = process.env.PUBLIC_APP_URL || "http://localhost:8080";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
if (CLERK_SECRET_KEY) {
  console.log("[ok] Clerk configured");
} else {
  console.warn("[warn] CLERK_SECRET_KEY not set — Google/Apple SSO disabled");
}
const SESSION_TTL_DAYS = 30;
const OTP_TTL_MIN = 10;

async function resolveClerkEmail(sessionToken: string): Promise<string | null> {
  if (!CLERK_SECRET_KEY || !sessionToken) return null;
  try {
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    const { sub: userId } = await verifyToken(sessionToken, {
      secretKey: CLERK_SECRET_KEY,
    });
    const user = await clerk.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress;
    return email ? email.trim().toLowerCase() : null;
  } catch (err) {
    console.error("[clerk] token verification failed:", err);
    return null;
  }
}

// ============================================================================
// DATABASE POOL
// ============================================================================

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 60000,
});

const TRANSIENT_DB_CODES = [
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "ETIMEDOUT",
  "ECONNREFUSED",
];

pool.on("connection", (conn) => {
  conn.on("error", (err: NodeJS.ErrnoException) => {
    if (!TRANSIENT_DB_CODES.includes(err.code ?? "")) throw err;
  });
});

(pool as any).on("error", (err: NodeJS.ErrnoException) => {
  if (!TRANSIENT_DB_CODES.includes(err.code ?? "")) throw err;
});

// ============================================================================
// EXTERNAL CLIENTS (Resend / Twilio) — graceful fallback
// ============================================================================

const FROM_EMAIL =
  process.env.SMTP_FROM || "Athlete Hub <no-reply@disruptinglabs.com>";
let resendClient: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
  console.log("[ok] Resend initialized");
} else {
  console.warn("[warn] RESEND_API_KEY not set — emails will be logged, not sent");
}

let twilioClient: ReturnType<typeof twilio> | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    console.log("[ok] Twilio initialized");
  } catch (err) {
    console.warn("[warn] Twilio init failed:", err);
  }
} else {
  console.warn("[warn] Twilio not configured — SMS will be logged only");
}
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

const stripeConfigured = !!(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY
);
let stripeClient: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
}
if (stripeConfigured) {
  console.log("[ok] Stripe configured");
} else {
  console.warn(
    "[warn] STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY not set — payments will use mock mode",
  );
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

type ActorType = "athlete" | "organizer" | "admin";
interface JwtPayload {
  actor: ActorType;
  id: number;
  email: string;
  organizerId?: number;
  jti: string;
}
interface AuthedRequest extends Request {
  auth?: JwtPayload;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signSessionToken(payload: Omit<JwtPayload, "jti">) {
  const jti = crypto.randomBytes(16).toString("hex");
  const token = jwt.sign({ ...payload, jti }, JWT_SECRET, {
    expiresIn: `${SESSION_TTL_DAYS}d`,
  });
  return { token, jti };
}

function verifySessionToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function actorSessionTable(actor: ActorType): {
  table: string;
  idCol: string;
} {
  switch (actor) {
    case "admin":
      return { table: "admin_sessions", idCol: "admin_id" };
    case "organizer":
      return { table: "organizer_sessions", idCol: "organizer_member_id" };
    default:
      return { table: "athlete_sessions", idCol: "athlete_id" };
  }
}

function actorOtpTable(actor: ActorType): { table: string; idCol: string } {
  switch (actor) {
    case "admin":
      return { table: "admin_otp_codes", idCol: "admin_id" };
    case "organizer":
      return { table: "organizer_otp_codes", idCol: "organizer_member_id" };
    default:
      return { table: "athlete_otp_codes", idCol: "athlete_id" };
  }
}

async function createOtp(
  actor: ActorType,
  actorId: number,
  purpose: string,
  ip?: string,
  channel: "email" | "sms" = "email",
): Promise<string> {
  const code = generateOtpCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);
  const { table, idCol } = actorOtpTable(actor);

  if (actor === "athlete") {
    await pool.query<ResultSetHeader>(
      `INSERT INTO ${table} (${idCol}, code_hash, channel, purpose, expires_at, ip_address) VALUES (?,?,?,?,?,?)`,
      [actorId, codeHash, channel, purpose, expiresAt, ip || null],
    );
  } else {
    await pool.query<ResultSetHeader>(
      `INSERT INTO ${table} (${idCol}, code_hash, purpose, expires_at, ip_address) VALUES (?,?,?,?,?)`,
      [actorId, codeHash, purpose, expiresAt, ip || null],
    );
  }
  return code;
}

async function consumeOtp(
  actor: ActorType,
  actorId: number,
  code: string,
  purpose: string,
): Promise<boolean> {
  const codeHash = sha256(code);
  const { table, idCol } = actorOtpTable(actor);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM ${table}
     WHERE ${idCol} = ? AND code_hash = ? AND purpose = ?
       AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [actorId, codeHash, purpose],
  );
  if (rows.length === 0) return false;
  await pool.query<ResultSetHeader>(
    `UPDATE ${table} SET consumed_at = NOW() WHERE id = ?`,
    [rows[0].id],
  );
  return true;
}

async function createSession(
  actor: ActorType,
  actorId: number,
  email: string,
  ip?: string,
  userAgent?: string,
  organizerId?: number,
): Promise<string> {
  const { token, jti } = signSessionToken({
    actor,
    id: actorId,
    email,
    organizerId,
  });
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const { table, idCol } = actorSessionTable(actor);
  await pool.query<ResultSetHeader>(
    `INSERT INTO ${table} (${idCol}, token_hash, ip_address, user_agent, expires_at) VALUES (?,?,?,?,?)`,
    [actorId, sha256(jti), ip || null, userAgent || null, expiresAt],
  );
  return token;
}

async function revokeSession(token: string): Promise<void> {
  const payload = verifySessionToken(token);
  if (!payload) return;
  const { table } = actorSessionTable(payload.actor);
  await pool.query<ResultSetHeader>(
    `UPDATE ${table} SET is_active = 0 WHERE token_hash = ?`,
    [sha256(payload.jti)],
  );
}

async function isSessionActive(payload: JwtPayload): Promise<boolean> {
  const { table } = actorSessionTable(payload.actor);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM ${table}
     WHERE token_hash = ? AND is_active = 1 AND expires_at > NOW() LIMIT 1`,
    [sha256(payload.jti)],
  );
  return rows.length > 0;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

function requireAuth(actor: ActorType) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = verifySessionToken(token);
    if (!payload || payload.actor !== actor) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const ok = await isSessionActive(payload);
    if (!ok) return res.status(401).json({ error: "Session expired" });
    req.auth = payload;
    next();
  };
}

const requireAthlete = requireAuth("athlete");
const requireOrganizer = requireAuth("organizer");
const requireAdmin = requireAuth("admin");

function dbUnavailable(_req: Request, res: Response, next: NextFunction) {
  if (MISSING_DB_VARS.length > 0) {
    return res.status(503).json({
      error: "Database not configured",
      missing: MISSING_DB_VARS,
    });
  }
  next();
}

// ============================================================================
// EMAIL / SMS HELPERS
// ============================================================================

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!resendClient) {
    console.log("[email:dry-run]", opts.to, opts.subject);
    return { id: "dry-run" };
  }
  const { data, error } = await resendClient.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id };
}

async function sendSms(opts: { to: string; body: string }) {
  if (!twilioClient || !TWILIO_FROM) {
    console.log("[sms:dry-run]", opts.to, opts.body);
    return { sid: "dry-run", status: "dry-run" };
  }
  const msg = await twilioClient.messages.create({
    from: TWILIO_FROM,
    to: opts.to,
    body: opts.body,
  });
  return { sid: msg.sid, status: msg.status };
}

function resolveRequestLocale(
  req: Request,
  dbLang?: string | null,
  bodyLang?: string | null,
): AppLocale {
  return resolveLocale(
    bodyLang,
    dbLang,
    localeFromAcceptLanguage(req.headers["accept-language"]),
  );
}

type StaffAccount =
  | {
      role: "admin";
      actorId: number;
      firstName: string;
      preferredLanguage: string;
    }
  | {
      role: "organizer";
      actorId: number;
      firstName: string;
      preferredLanguage: string;
      organizerId: number;
    };

async function resolveStaffByEmail(
  email: string,
): Promise<StaffAccount | null> {
  const [admins] = await pool.query<RowDataPacket[]>(
    `SELECT id, first_name, preferred_language FROM admins
     WHERE email = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [email],
  );
  if (admins.length > 0) {
    return {
      role: "admin",
      actorId: admins[0].id as number,
      firstName: admins[0].first_name as string,
      preferredLanguage: admins[0].preferred_language as string,
    };
  }
  const [members] = await pool.query<RowDataPacket[]>(
    `SELECT om.id, om.first_name, om.preferred_language, om.organizer_id
     FROM organizer_members om
     WHERE om.email = ? AND om.status = 'active' LIMIT 1`,
    [email],
  );
  if (members.length > 0) {
    return {
      role: "organizer",
      actorId: members[0].id as number,
      firstName: members[0].first_name as string,
      preferredLanguage: members[0].preferred_language as string,
      organizerId: members[0].organizer_id as number,
    };
  }
  return null;
}

// ============================================================================
// PAYMENT HELPERS (Stripe Connect — mock until keys configured)
// ============================================================================

function calcServiceFeeCents(
  priceCents: number,
  feePercent: number,
): number {
  return Math.round(priceCents * (feePercent / 100));
}

function formatMxn(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`;
}

function newPublicUuid(): string {
  return crypto.randomUUID();
}

function newQrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function nextRegistrationNumber(eventId: number): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM registrations WHERE event_id = ?`,
    [eventId],
  );
  const n = Number(rows[0]?.c ?? 0) + 1;
  return `REG-${String(eventId).padStart(4, "0")}-${String(n).padStart(5, "0")}`;
}

function parseFieldOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function confirmRegistrationPayment(
  registrationPublicUuid: string,
  athleteId: number,
  paymentIntentId?: string,
): Promise<{ success: boolean; registration?: RowDataPacket; error?: string }> {
  const [regRows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, ec.name AS category_name, e.title AS event_title, e.slug AS event_slug,
            p.id AS payment_row_id, p.public_uuid AS payment_public_uuid, p.status AS payment_status,
            p.stripe_payment_intent_id, p.provider AS payment_provider, p.amount_cents
     FROM registrations r
     JOIN event_categories ec ON ec.id = r.event_category_id
     JOIN events e ON e.id = r.event_id
     LEFT JOIN payments p ON p.id = r.payment_id
     WHERE r.public_uuid = ? AND r.athlete_id = ? AND r.deleted_at IS NULL
     LIMIT 1`,
    [registrationPublicUuid, athleteId],
  );
  if (regRows.length === 0) {
    return { success: false, error: "Registration not found" };
  }
  const reg = regRows[0];
  if (reg.status === "confirmed") {
    return { success: true, registration: reg };
  }

  const provider = reg.payment_provider as string | null;
  if (provider === "mock" || !stripeClient) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query<ResultSetHeader>(
        `UPDATE payments SET status = 'succeeded', paid_at = NOW() WHERE id = ?`,
        [reg.payment_row_id],
      );
      await conn.query<ResultSetHeader>(
        `UPDATE registrations SET status = 'confirmed' WHERE id = ?`,
        [reg.id],
      );
      await conn.query<ResultSetHeader>(
        `UPDATE event_categories SET sold_count = sold_count + 1 WHERE id = ?`,
        [reg.event_category_id],
      );
      await conn.query<ResultSetHeader>(
        `UPDATE events SET registration_count = registration_count + 1 WHERE id = ?`,
        [reg.event_id],
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const [updated] = await pool.query<RowDataPacket[]>(
      `SELECT r.public_uuid, r.registration_number, r.qr_code_token, r.status, r.total_cents,
              ec.name AS category_name, e.title AS event_title, e.slug AS event_slug
       FROM registrations r
       JOIN event_categories ec ON ec.id = r.event_category_id
       JOIN events e ON e.id = r.event_id
       WHERE r.id = ?`,
      [reg.id],
    );
    return { success: true, registration: updated[0] };
  }

  const piId = paymentIntentId || (reg.stripe_payment_intent_id as string);
  if (!piId || !stripeClient) {
    return { success: false, error: "Payment not initialized" };
  }

  const pi = await stripeClient.paymentIntents.retrieve(piId);
  if (pi.status !== "succeeded") {
    return {
      success: false,
      error:
        pi.last_payment_error?.message ||
        `Payment status: ${pi.status}`,
    };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query<ResultSetHeader>(
      `UPDATE payments SET status = 'succeeded', paid_at = NOW(),
       stripe_charge_id = ? WHERE id = ?`,
      [typeof pi.latest_charge === "string" ? pi.latest_charge : null, reg.payment_row_id],
    );
    await conn.query<ResultSetHeader>(
      `UPDATE registrations SET status = 'confirmed' WHERE id = ?`,
      [reg.id],
    );
    await conn.query<ResultSetHeader>(
      `UPDATE event_categories SET sold_count = sold_count + 1 WHERE id = ?`,
      [reg.event_category_id],
    );
    await conn.query<ResultSetHeader>(
      `UPDATE events SET registration_count = registration_count + 1 WHERE id = ?`,
      [reg.event_id],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [updated] = await pool.query<RowDataPacket[]>(
    `SELECT r.public_uuid, r.registration_number, r.qr_code_token, r.status, r.total_cents,
            ec.name AS category_name, e.title AS event_title, e.slug AS event_slug
     FROM registrations r
     JOIN event_categories ec ON ec.id = r.event_category_id
     JOIN events e ON e.id = r.event_id
     WHERE r.id = ?`,
    [reg.id],
  );
  return { success: true, registration: updated[0] };
}

// ============================================================================
// EXPRESS APP
// ============================================================================

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(dbUnavailable);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const color =
        status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
      console.log(
        `${color}${req.method}\x1b[0m ${req.path} → ${color}${status}\x1b[0m (${ms}ms)`,
      );
    });
    next();
  });

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerMarketplaceRoutes(app);
  registerAthleteRoutes(app);
  registerOrganizerRoutes(app);
  registerAdminRoutes(app);
  registerWebhookRoutes(app);

  // ── Global JSON error handler (must be last use()) ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message =
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : (err?.message ?? String(err));
    console.error(`[Express error handler] ${status}:`, err?.message ?? err);
    res.status(status).json({ error: message });
  });

  return app;
}

// ============================================================================
// ROUTES — HEALTH
// ============================================================================

function registerHealthRoutes(app: express.Express) {
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: "degraded",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/api/ping", (_req, res) => {
    res.json({ message: "pong" });
  });

  app.get("/api/config/payments", (_req, res) => {
    res.json({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      mockMode: !stripeConfigured,
      currency: "MXN",
    });
  });

  app.get("/api/config/app-version", async (_req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value
           FROM system_settings
          WHERE setting_key = 'app_version'
          LIMIT 1`,
      );
      const dbVersion = (rows[0]?.setting_value as string | undefined)?.trim() || null;
      res.json({
        version:
          dbVersion ||
          process.env.APP_VERSION?.trim() ||
          process.env.VITE_APP_VERSION?.trim() ||
          null,
      });
    } catch {
      res.json({
        version:
          process.env.APP_VERSION?.trim() ||
          process.env.VITE_APP_VERSION?.trim() ||
          null,
      });
    }
  });
}

// ============================================================================
// ROUTES — AUTH (athlete, organizer, admin)
// ============================================================================

function registerAuthRoutes(app: express.Express) {
  app.post("/api/auth/athlete/request-otp", async (req, res) => {
    const channel = String(req.body?.channel || "email") as "email" | "sms";
    const purpose = String(req.body?.purpose || "login");

    if (channel === "email") {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      if (!email || !/.+@.+\..+/.test(email)) {
        return res.status(400).json({ error: "Valid email required" });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, first_name, preferred_language FROM athletes WHERE email = ? AND status = 'active' LIMIT 1",
        [email],
      );
      if (rows.length === 0 && purpose === "login") {
        return res
          .status(404)
          .json({ error: "No account found for that email." });
      }

      let athleteId = rows[0]?.id as number | undefined;
      let firstName = rows[0]?.first_name as string | undefined;
      const locale = resolveRequestLocale(
        req,
        rows[0]?.preferred_language as string | undefined,
        req.body?.locale,
      );

      if (purpose === "register" && !athleteId) {
        firstName = String(req.body?.first_name || "Atleta").trim();
        const lastName = String(req.body?.last_name || "").trim();
        if (!lastName) {
          return res.status(400).json({ error: "last_name required for registration" });
        }
        const [ins] = await pool.query<ResultSetHeader>(
          `INSERT INTO athletes (email, first_name, last_name, preferred_language) VALUES (?,?,?,?)`,
          [email, firstName, lastName, locale],
        );
        athleteId = ins.insertId;
      }

      if (!athleteId) {
        return res.status(400).json({ error: "Unable to resolve athlete account" });
      }

      const code = await createOtp(
        "athlete",
        athleteId,
        purpose,
        req.ip,
        "email",
      );
      const otpMail = buildOtpEmail({
        locale,
        firstName: firstName || "Atleta",
        code,
        appUrl: APP_URL,
      });
      await sendEmail({
        to: email,
        subject: otpMail.subject,
        html: otpMail.html,
        text: otpMail.text,
      });
      res.json({ ok: true, message: "Verification code sent." });
      return;
    }

    const phone = String(req.body?.phone || "").trim();
    if (!phone) return res.status(400).json({ error: "Phone required" });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, first_name, preferred_language FROM athletes WHERE phone = ? AND status = 'active' LIMIT 1",
      [phone],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "No account found for that phone." });
    }

    const locale = resolveRequestLocale(
      req,
      rows[0].preferred_language as string,
      req.body?.locale,
    );
    const code = await createOtp(
      "athlete",
      rows[0].id as number,
      purpose,
      req.ip,
      "sms",
    );
    await sendSms({
      to: phone,
      body: smsOtpMessage(locale, code, OTP_TTL_MIN),
    });
    res.json({ ok: true, message: "Verification code sent via SMS." });
  });

  app.post("/api/auth/athlete/verify-otp", async (req, res) => {
    const channel = String(req.body?.channel || "email") as "email" | "sms";
    const code = String(req.body?.code || "").trim();
    const purpose = String(req.body?.purpose || "login");
    if (!code) return res.status(400).json({ error: "Code required" });

    let athlete: RowDataPacket | undefined;

    if (channel === "email") {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      if (!email) return res.status(400).json({ error: "Email required" });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, email, first_name, last_name, preferred_language, last_login_at FROM athletes WHERE email = ? LIMIT 1",
        [email],
      );
      athlete = rows[0];
    } else {
      const phone = String(req.body?.phone || "").trim();
      if (!phone) return res.status(400).json({ error: "Phone required" });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, email, first_name, last_name, preferred_language, last_login_at FROM athletes WHERE phone = ? LIMIT 1",
        [phone],
      );
      athlete = rows[0];
    }

    if (!athlete) return res.status(404).json({ error: "Account not found" });

    const isFirstLogin = !athlete.last_login_at;
    const athleteLocale = normalizeLocale(athlete.preferred_language as string);

    const ok = await consumeOtp(
      "athlete",
      athlete.id as number,
      code,
      purpose,
    );
    if (!ok) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }

    await pool.query<ResultSetHeader>(
      "UPDATE athletes SET last_login_at = NOW() WHERE id = ?",
      [athlete.id],
    );

    if (isFirstLogin && athlete.email) {
      const welcome = buildWelcomeAthleteEmail({
        locale: athleteLocale,
        firstName: athlete.first_name as string,
        appUrl: APP_URL,
      });
      sendEmail({
        to: athlete.email as string,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
      }).catch((err) => console.error("[email:welcome-athlete]", err));
    }

    const token = await createSession(
      "athlete",
      athlete.id as number,
      (athlete.email as string) || String(req.body?.phone || ""),
      req.ip,
      req.headers["user-agent"],
    );

    res.json({
      token,
      athlete: {
        id: athlete.id,
        email: athlete.email,
        firstName: athlete.first_name,
        lastName: athlete.last_name,
      },
    });
  });

  // ============================================================
  // AUTH — ORGANIZER
  // ============================================================
  app.post("/api/auth/organizer/request-otp", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT om.id, om.first_name, om.preferred_language, om.organizer_id, o.name AS organizer_name
       FROM organizer_members om
       JOIN organizers o ON o.id = om.organizer_id
       WHERE om.email = ? AND om.status = 'active' LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No organizer account found for that email." });
    }
    const locale = resolveRequestLocale(
      req,
      rows[0].preferred_language as string,
      req.body?.locale,
    );
    const code = await createOtp(
      "organizer",
      rows[0].id as number,
      "login",
      req.ip,
    );
    const otpMail = buildOtpEmail({
      locale,
      firstName: rows[0].first_name as string,
      code,
      appUrl: APP_URL,
    });
    await sendEmail({
      to: email,
      subject: otpMail.subject,
      html: otpMail.html,
      text: otpMail.text,
    });
    res.json({ ok: true, message: "Verification code sent." });
  });

  app.post("/api/auth/organizer/verify-otp", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.code || "").trim();
    if (!email || !code) {
      return res.status(400).json({ error: "Email and code required" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT om.id, om.email, om.first_name, om.last_name, om.organizer_id, om.role,
              om.preferred_language, om.last_login_at
       FROM organizer_members om WHERE om.email = ? LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    const member = rows[0];
    const isFirstLogin = !member.last_login_at;
    const memberLocale = normalizeLocale(member.preferred_language as string);
    const ok = await consumeOtp(
      "organizer",
      member.id as number,
      code,
      "login",
    );
    if (!ok) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }
    await pool.query<ResultSetHeader>(
      "UPDATE organizer_members SET last_login_at = NOW() WHERE id = ?",
      [member.id],
    );

    if (isFirstLogin) {
      const welcome = buildWelcomeStaffEmail({
        locale: memberLocale,
        firstName: member.first_name as string,
        audience: "organizer",
        appUrl: APP_URL,
      });
      sendEmail({
        to: member.email as string,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
      }).catch((err) => console.error("[email:welcome-organizer]", err));
    }

    const token = await createSession(
      "organizer",
      member.id as number,
      member.email as string,
      req.ip,
      req.headers["user-agent"],
      member.organizer_id as number,
    );
    res.json({
      token,
      member: {
        id: member.id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        role: member.role,
        organizerId: member.organizer_id,
      },
    });
  });

  // ============================================================
  // AUTH — STAFF (unified admin + organizer)
  // ============================================================
  app.post("/api/auth/staff/request-otp", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const account = await resolveStaffByEmail(email);
    if (!account) {
      return res.status(404).json({ error: "No staff account found for that email." });
    }
    const locale = resolveRequestLocale(
      req,
      account.preferredLanguage,
      req.body?.locale,
    );
    const code = await createOtp(
      account.role === "admin" ? "admin" : "organizer",
      account.actorId,
      "login",
      req.ip,
    );
    const otpMail = buildOtpEmail({
      locale,
      firstName: account.firstName,
      code,
      appUrl: APP_URL,
    });
    await sendEmail({
      to: email,
      subject: otpMail.subject,
      html: otpMail.html,
      text: otpMail.text,
    });
    res.json({ ok: true, role: account.role, message: "Verification code sent." });
  });

  app.post("/api/auth/staff/verify-otp", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.code || "").trim();
    if (!email || !code) {
      return res.status(400).json({ error: "Email and code required" });
    }
    const account = await resolveStaffByEmail(email);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (account.role === "admin") {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, role, preferred_language, last_login_at
         FROM admins WHERE email = ? LIMIT 1`,
        [email],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Account not found" });
      }
      const admin = rows[0];
      const ok = await consumeOtp("admin", admin.id as number, code, "login");
      if (!ok) {
        return res.status(401).json({ error: "Invalid or expired code" });
      }
      const isFirstLogin = !admin.last_login_at;
      const adminLocale = normalizeLocale(admin.preferred_language as string);
      await pool.query<ResultSetHeader>(
        "UPDATE admins SET last_login_at = NOW() WHERE id = ?",
        [admin.id],
      );
      if (isFirstLogin) {
        const welcome = buildWelcomeStaffEmail({
          locale: adminLocale,
          firstName: admin.first_name as string,
          audience: "admin",
          appUrl: APP_URL,
        });
        sendEmail({
          to: admin.email as string,
          subject: welcome.subject,
          html: welcome.html,
          text: welcome.text,
        }).catch((err) => console.error("[email:welcome-admin]", err));
      }
      const token = await createSession(
        "admin",
        admin.id as number,
        admin.email as string,
        req.ip,
        req.headers["user-agent"],
      );
      return res.json({
        token,
        role: "admin" as const,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.first_name,
          lastName: admin.last_name,
          role: admin.role,
        },
      });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT om.id, om.email, om.first_name, om.last_name, om.role, om.organizer_id,
              om.preferred_language, om.last_login_at
       FROM organizer_members om WHERE om.email = ? LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    const member = rows[0];
    const ok = await consumeOtp("organizer", member.id as number, code, "login");
    if (!ok) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }
    const isFirstLogin = !member.last_login_at;
    const memberLocale = normalizeLocale(member.preferred_language as string);
    await pool.query<ResultSetHeader>(
      "UPDATE organizer_members SET last_login_at = NOW() WHERE id = ?",
      [member.id],
    );
    if (isFirstLogin) {
      const welcome = buildWelcomeStaffEmail({
        locale: memberLocale,
        firstName: member.first_name as string,
        audience: "organizer",
        appUrl: APP_URL,
      });
      sendEmail({
        to: member.email as string,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
      }).catch((err) => console.error("[email:welcome-organizer]", err));
    }
    const token = await createSession(
      "organizer",
      member.id as number,
      member.email as string,
      req.ip,
      req.headers["user-agent"],
      member.organizer_id as number,
    );
    res.json({
      token,
      role: "organizer" as const,
      member: {
        id: member.id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        role: member.role,
        organizerId: member.organizer_id,
      },
    });
  });

  // ============================================================
  // AUTH — ADMIN
  // ============================================================
  app.post("/api/auth/admin/request-otp", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, first_name, preferred_language FROM admins WHERE email = ? AND status = 'active' LIMIT 1",
      [email],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "No admin account found." });
    }
    const locale = resolveRequestLocale(
      req,
      rows[0].preferred_language as string,
      req.body?.locale,
    );
    const code = await createOtp("admin", rows[0].id as number, "login", req.ip);
    const otpMail = buildOtpEmail({
      locale,
      firstName: rows[0].first_name as string,
      code,
      appUrl: APP_URL,
    });
    await sendEmail({
      to: email,
      subject: otpMail.subject,
      html: otpMail.html,
      text: otpMail.text,
    });
    res.json({ ok: true, message: "Verification code sent." });
  });

  app.post("/api/auth/admin/verify-otp", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.code || "").trim();
    if (!email || !code) {
      return res.status(400).json({ error: "Email and code required" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, first_name, last_name, role, preferred_language, last_login_at FROM admins WHERE email = ? LIMIT 1",
      [email],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    const admin = rows[0];
    const isFirstLogin = !admin.last_login_at;
    const adminLocale = normalizeLocale(admin.preferred_language as string);
    const ok = await consumeOtp("admin", admin.id as number, code, "login");
    if (!ok) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }
    await pool.query<ResultSetHeader>(
      "UPDATE admins SET last_login_at = NOW() WHERE id = ?",
      [admin.id],
    );

    if (isFirstLogin) {
      const welcome = buildWelcomeStaffEmail({
        locale: adminLocale,
        firstName: admin.first_name as string,
        audience: "admin",
        appUrl: APP_URL,
      });
      sendEmail({
        to: admin.email as string,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
      }).catch((err) => console.error("[email:welcome-admin]", err));
    }

    const token = await createSession(
      "admin",
      admin.id as number,
      admin.email as string,
      req.ip,
      req.headers["user-agent"],
    );
    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role,
      },
    });
  });

  app.get("/api/auth/admin/me", requireAdmin, async (req: AuthedRequest, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, role, avatar_url
       FROM admins WHERE id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [req.auth!.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }
    const admin = rows[0];
    res.json({
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role,
        avatarUrl: admin.avatar_url,
      },
    });
  });

  app.get(
    "/api/auth/organizer/me",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT om.id, om.email, om.first_name, om.last_name, om.role, om.organizer_id
         FROM organizer_members om
         WHERE om.id = ? AND om.status = 'active' LIMIT 1`,
        [req.auth!.id],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Organizer member not found" });
      }
      const member = rows[0];
      res.json({
        member: {
          id: member.id,
          email: member.email,
          firstName: member.first_name,
          lastName: member.last_name,
          role: member.role,
          organizerId: member.organizer_id,
        },
      });
    },
  );

  app.post("/api/auth/clerk/athlete", async (req, res) => {
    if (!CLERK_SECRET_KEY) {
      return res.status(503).json({ error: "Clerk is not configured" });
    }
    const sessionToken = String(req.body?.sessionToken || "").trim();
    if (!sessionToken) {
      return res.status(400).json({ error: "sessionToken required" });
    }
    const email = await resolveClerkEmail(sessionToken);
    if (!email) {
      return res.status(401).json({ error: "Invalid Clerk session" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, avatar_url
       FROM athletes WHERE email = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return res.status(404).json({
        error: "No athlete account found for this email. Register or use OTP first.",
      });
    }
    const athlete = rows[0];
    await pool.query<ResultSetHeader>(
      "UPDATE athletes SET last_login_at = NOW() WHERE id = ?",
      [athlete.id],
    );
    const token = await createSession(
      "athlete",
      athlete.id as number,
      athlete.email as string,
      req.ip,
      req.headers["user-agent"],
    );
    res.json({
      token,
      athlete: {
        id: athlete.id,
        email: athlete.email,
        firstName: athlete.first_name,
        lastName: athlete.last_name,
        avatarUrl: athlete.avatar_url,
      },
    });
  });

  app.post("/api/auth/clerk/staff", async (req, res) => {
    if (!CLERK_SECRET_KEY) {
      return res.status(503).json({ error: "Clerk is not configured" });
    }
    const sessionToken = String(req.body?.sessionToken || "").trim();
    if (!sessionToken) {
      return res.status(400).json({ error: "sessionToken required" });
    }
    const email = await resolveClerkEmail(sessionToken);
    if (!email) {
      return res.status(401).json({ error: "Invalid Clerk session" });
    }

    const [adminRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, role
       FROM admins WHERE email = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (adminRows.length > 0) {
      const admin = adminRows[0];
      await pool.query<ResultSetHeader>(
        "UPDATE admins SET last_login_at = NOW() WHERE id = ?",
        [admin.id],
      );
      const token = await createSession(
        "admin",
        admin.id as number,
        admin.email as string,
        req.ip,
        req.headers["user-agent"],
      );
      return res.json({
        token,
        role: "admin" as const,
        user: {
          type: "admin" as const,
          id: admin.id,
          email: admin.email,
          firstName: admin.first_name,
          lastName: admin.last_name,
          role: admin.role,
        },
      });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT om.id, om.email, om.first_name, om.last_name, om.role, om.organizer_id
       FROM organizer_members om
       WHERE om.email = ? AND om.status = 'active' LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No staff account for this email." });
    }
    const member = rows[0];
    await pool.query<ResultSetHeader>(
      "UPDATE organizer_members SET last_login_at = NOW() WHERE id = ?",
      [member.id],
    );
    const token = await createSession(
      "organizer",
      member.id as number,
      member.email as string,
      req.ip,
      req.headers["user-agent"],
      member.organizer_id as number,
    );
    res.json({
      token,
      role: "organizer" as const,
      user: {
        type: "organizer" as const,
        id: member.id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        role: member.role,
        organizerId: member.organizer_id,
      },
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = extractToken(req);
    if (token) await revokeSession(token);
    res.json({ ok: true });
  });
}

// ============================================================================
// ROUTES — MARKETPLACE (public event discovery)
// ============================================================================

function registerMarketplaceRoutes(app: express.Express) {
  app.get("/api/sport-types", async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, slug, name, icon FROM sport_types WHERE is_active = 1 ORDER BY sort_order ASC`,
    );
    res.json({ sportTypes: rows });
  });

  app.get("/api/events", async (req, res) => {
    const sport = req.query.sport ? String(req.query.sport) : null;
    const city = req.query.city ? String(req.query.city) : null;
    const q = req.query.q ? String(req.query.q).trim() : null;
    const featured =
      req.query.featured === "1" || req.query.featured === "true" ? true : null;
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? String(req.query.dateTo) : null;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const sort = req.query.sort ? String(req.query.sort) : "date_asc";
    const limit = Math.min(Number(req.query.limit) || 24, 100);
    const offset = Number(req.query.offset) || 0;

    let sql = `
      SELECT e.id, e.public_uuid, e.slug, e.title, e.short_description, e.start_date, e.end_date,
             e.location_city, e.location_state, e.location_country, e.location_lat, e.location_lng,
             e.featured, e.hero_image_url, e.registration_count, e.registration_closes_at,
             st.slug AS sport_slug, st.name AS sport_name,
             o.name AS organizer_name, o.slug AS organizer_slug,
             ec_min.from_price_cents
      FROM events e
      JOIN sport_types st ON st.id = e.sport_type_id
      JOIN organizers o ON o.id = e.organizer_id AND o.deleted_at IS NULL
      LEFT JOIN (
        SELECT event_id, MIN(price_cents) AS from_price_cents
        FROM event_categories WHERE is_active = 1 GROUP BY event_id
      ) ec_min ON ec_min.event_id = e.id
      WHERE e.status = 'published' AND e.visibility = 'public' AND e.deleted_at IS NULL
    `;
    const params: unknown[] = [];

    if (sport) {
      sql += " AND st.slug = ?";
      params.push(sport);
    }
    if (city) {
      sql += " AND (e.location_city LIKE ? OR e.location_state LIKE ?)";
      params.push(`%${city}%`, `%${city}%`);
    }
    if (q) {
      sql += ` AND (
        e.title LIKE ? OR e.short_description LIKE ? OR e.search_keywords LIKE ?
        OR e.location_city LIKE ? OR e.location_name LIKE ?
      )`;
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    if (featured) {
      sql += " AND e.featured = 1";
    }
    if (dateFrom) {
      sql += " AND e.start_date >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += " AND e.start_date <= ?";
      params.push(dateTo);
    }
    if (minPrice != null && !Number.isNaN(minPrice)) {
      sql += " AND ec_min.from_price_cents >= ?";
      params.push(minPrice);
    }
    if (maxPrice != null && !Number.isNaN(maxPrice)) {
      sql += " AND ec_min.from_price_cents <= ?";
      params.push(maxPrice);
    }

    const orderMap: Record<string, string> = {
      date_asc: "e.featured DESC, e.start_date ASC",
      date_desc: "e.start_date DESC",
      price_asc: "ec_min.from_price_cents IS NULL, ec_min.from_price_cents ASC",
      price_desc: "ec_min.from_price_cents DESC",
      popular: "e.registration_count DESC, e.start_date ASC",
    };
    const orderBy = orderMap[sort] ?? orderMap.date_asc;

    sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);

    let countSql = `
      SELECT COUNT(*) AS total
      FROM events e
      JOIN sport_types st ON st.id = e.sport_type_id
      JOIN organizers o ON o.id = e.organizer_id AND o.deleted_at IS NULL
      LEFT JOIN (
        SELECT event_id, MIN(price_cents) AS from_price_cents
        FROM event_categories WHERE is_active = 1 GROUP BY event_id
      ) ec_min ON ec_min.event_id = e.id
      WHERE e.status = 'published' AND e.visibility = 'public' AND e.deleted_at IS NULL
    `;
    const countParams: unknown[] = [];
    if (sport) {
      countSql += " AND st.slug = ?";
      countParams.push(sport);
    }
    if (city) {
      countSql += " AND (e.location_city LIKE ? OR e.location_state LIKE ?)";
      countParams.push(`%${city}%`, `%${city}%`);
    }
    if (q) {
      countSql += ` AND (
        e.title LIKE ? OR e.short_description LIKE ? OR e.search_keywords LIKE ?
        OR e.location_city LIKE ? OR e.location_name LIKE ?
      )`;
      const like = `%${q}%`;
      countParams.push(like, like, like, like, like);
    }
    if (featured) {
      countSql += " AND e.featured = 1";
    }
    if (dateFrom) {
      countSql += " AND e.start_date >= ?";
      countParams.push(dateFrom);
    }
    if (dateTo) {
      countSql += " AND e.start_date <= ?";
      countParams.push(dateTo);
    }
    if (minPrice != null && !Number.isNaN(minPrice)) {
      countSql += " AND ec_min.from_price_cents >= ?";
      countParams.push(minPrice);
    }
    if (maxPrice != null && !Number.isNaN(maxPrice)) {
      countSql += " AND ec_min.from_price_cents <= ?";
      countParams.push(maxPrice);
    }

    const [countRows] = await pool.query<RowDataPacket[]>(countSql, countParams);

    res.json({
      events: rows,
      total: Number(countRows[0]?.total ?? rows.length),
      limit,
      offset,
    });
  });

  app.get("/api/events/filters/cities", async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT e.location_city AS city, e.location_state AS state, COUNT(*) AS event_count
       FROM events e
       WHERE e.status = 'published' AND e.visibility = 'public' AND e.deleted_at IS NULL
         AND e.location_city IS NOT NULL AND e.location_city != ''
       GROUP BY e.location_city, e.location_state
       ORDER BY event_count DESC, e.location_city ASC
       LIMIT 50`,
    );
    res.json({ cities: rows });
  });

  app.get("/api/events/:slug", async (req, res) => {
    const slug = String(req.params.slug);
    const [events] = await pool.query<RowDataPacket[]>(
      `SELECT e.*, st.slug AS sport_slug, st.name AS sport_name,
              o.name AS organizer_name, o.slug AS organizer_slug, o.logo_url AS organizer_logo,
              v.name AS venue_name, v.address_line1 AS venue_address, v.lat AS venue_lat, v.lng AS venue_lng
       FROM events e
       JOIN sport_types st ON st.id = e.sport_type_id
       JOIN organizers o ON o.id = e.organizer_id AND o.deleted_at IS NULL
       LEFT JOIN venues v ON v.id = e.venue_id AND v.deleted_at IS NULL
       WHERE e.slug = ? AND e.status IN ('published','completed') AND e.deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    if (events.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    const event = events[0];

    const [categories] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_uuid, name, description, distance_km, difficulty, capacity, sold_count,
              price_cents, currency, gender_restriction, min_age, max_age, waitlist_enabled, sort_order
       FROM event_categories
       WHERE event_id = ? AND is_active = 1
       ORDER BY sort_order ASC`,
      [event.id],
    );

    const [fields] = await pool.query<RowDataPacket[]>(
      `SELECT id, field_key, label, field_type, options_json, is_required, sort_order
       FROM event_registration_fields
       WHERE event_id = ? AND is_active = 1
       ORDER BY sort_order ASC`,
      [event.id],
    );

    const [sponsors] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, logo_url, website_url, tier, sort_order
       FROM event_sponsors WHERE event_id = ? AND is_active = 1 ORDER BY sort_order ASC`,
      [event.id],
    );

    const [tags] = await pool.query<RowDataPacket[]>(
      `SELECT t.slug, t.name, t.category
       FROM event_tags et JOIN tags t ON t.id = et.tag_id
       WHERE et.event_id = ? AND t.is_active = 1 ORDER BY t.sort_order ASC`,
      [event.id],
    );

    const [waves] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, starts_at, capacity, registered_count, sort_order
       FROM event_schedule_waves WHERE event_id = ? ORDER BY sort_order ASC`,
      [event.id],
    );

    const feePercent =
      (event.service_fee_percent as number) ??
      (await pool
        .query<RowDataPacket[]>(
          "SELECT service_fee_percent FROM organizers WHERE id = ? LIMIT 1",
          [event.organizer_id],
        )
        .then(([orgRows]) => Number(orgRows[0]?.service_fee_percent ?? 11)));

    const categoriesWithFees = (categories as RowDataPacket[]).map((cat) => {
      const priceCents = cat.price_cents as number;
      const serviceFeeCents = calcServiceFeeCents(priceCents, feePercent);
      return {
        ...cat,
        service_fee_cents: serviceFeeCents,
        total_cents: priceCents + serviceFeeCents,
        price_formatted: formatMxn(priceCents),
        service_fee_formatted: formatMxn(serviceFeeCents),
        total_formatted: formatMxn(priceCents + serviceFeeCents),
      };
    });

    const [courseRows] = await pool.query<RowDataPacket[]>(
      `SELECT route_geojson, points_json, distance_km, elevation_gain_m
       FROM event_courses WHERE event_id = ? LIMIT 1`,
      [event.id],
    );
    const courseRow = courseRows[0];
    let course = null;
    if (courseRow) {
      course = {
        routeGeojson:
          typeof courseRow.route_geojson === "string"
            ? JSON.parse(courseRow.route_geojson as string)
            : courseRow.route_geojson,
        points:
          typeof courseRow.points_json === "string"
            ? JSON.parse(courseRow.points_json as string)
            : courseRow.points_json,
        distanceKm: courseRow.distance_km,
        elevationGainM: courseRow.elevation_gain_m,
      };
    }

    const [media] = await pool.query<RowDataPacket[]>(
      `SELECT asset_type, url, alt_text, mime_type, sort_order, is_primary
       FROM media_assets
       WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC`,
      [event.id],
    );

    res.json({
      event,
      categories: categoriesWithFees,
      registrationFields: (fields as RowDataPacket[]).map((f) => ({
        id: f.id,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        options_json: parseFieldOptions(f.options_json),
        is_required: Boolean(f.is_required),
        sort_order: f.sort_order,
      })),
      sponsors,
      tags,
      scheduleWaves: waves,
      serviceFeePercent: feePercent,
      course,
      media,
    });
  });

  app.post(
    "/api/events/:slug/register/checkout",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const slug = String(req.params.slug);
      const athleteId = req.auth!.id;
      const categoryId = Number(req.body?.categoryId);
      const fieldValues = (req.body?.fieldValues ?? {}) as Record<
        string,
        string | boolean
      >;
      const idempotencyKey = String(req.body?.idempotencyKey ?? "").trim();

      if (!Number.isFinite(categoryId)) {
        return res.status(400).json({ error: "categoryId required" });
      }
      if (!idempotencyKey || idempotencyKey.length > 64) {
        return res.status(400).json({ error: "idempotencyKey required (max 64 chars)" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        `SELECT e.id, e.title, e.slug, e.status, e.organizer_id, e.service_fee_percent,
                o.stripe_account_id, o.stripe_onboarding_complete, o.service_fee_percent AS org_fee_percent
         FROM events e
         JOIN organizers o ON o.id = e.organizer_id
         WHERE e.slug = ? AND e.status = 'published' LIMIT 1`,
        [slug],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
      const event = eventRows[0];

      const [existingPay] = await pool.query<RowDataPacket[]>(
        `SELECT p.public_uuid, r.public_uuid AS registration_public_uuid
         FROM payments p
         JOIN registrations r ON r.id = p.registration_id
         WHERE p.idempotency_key = ? AND p.athlete_id = ? LIMIT 1`,
        [idempotencyKey, athleteId],
      );
      if (existingPay.length > 0) {
        const row = existingPay[0];
        const [regDetail] = await pool.query<RowDataPacket[]>(
          `SELECT r.public_uuid, p.public_uuid AS payment_public_uuid, p.amount_cents,
                  r.price_cents, r.service_fee_cents, ec.name AS category_name, e.title AS event_title,
                  p.stripe_payment_intent_id, p.provider
           FROM registrations r
           JOIN payments p ON p.id = r.payment_id
           JOIN event_categories ec ON ec.id = r.event_category_id
           JOIN events e ON e.id = r.event_id
           WHERE r.public_uuid = ? LIMIT 1`,
          [row.registration_public_uuid],
        );
        if (regDetail.length > 0) {
          const d = regDetail[0];
          const mockMode = d.provider === "mock" || !stripeClient;
          let clientSecret: string | null = null;
          if (!mockMode && d.stripe_payment_intent_id && stripeClient) {
            const pi = await stripeClient.paymentIntents.retrieve(
              d.stripe_payment_intent_id as string,
            );
            clientSecret = pi.client_secret;
          } else if (mockMode) {
            clientSecret = `mock_${d.public_uuid}`;
          }
          return res.json({
            registrationPublicUuid: d.public_uuid,
            paymentPublicUuid: d.payment_public_uuid,
            clientSecret,
            mockMode,
            amountCents: d.amount_cents,
            registrationAmountCents: d.price_cents,
            serviceFeeCents: d.service_fee_cents,
            currency: "MXN",
            categoryName: d.category_name,
            eventTitle: d.event_title,
          });
        }
      }

      const [dupReg] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE event_id = ? AND athlete_id = ? AND status IN ('pending_payment','confirmed')
           AND deleted_at IS NULL LIMIT 1`,
        [event.id, athleteId],
      );
      if (dupReg.length > 0) {
        return res.status(409).json({ error: "Already registered for this event" });
      }

      const [catRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, price_cents, capacity, sold_count, currency
         FROM event_categories
         WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1`,
        [categoryId, event.id],
      );
      if (catRows.length === 0) {
        return res.status(404).json({ error: "Category not found" });
      }
      const category = catRows[0];
      if (
        category.capacity != null &&
        Number(category.sold_count) >= Number(category.capacity)
      ) {
        return res.status(409).json({ error: "Category is sold out" });
      }

      const [fieldRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, field_key, label, field_type, options_json, is_required
         FROM event_registration_fields
         WHERE event_id = ? AND is_active = 1`,
        [event.id],
      );

      for (const field of fieldRows) {
        const key = field.field_key as string;
        const raw = fieldValues[key];
        const required = Boolean(field.is_required);
        if (field.field_type === "checkbox") {
          if (required && raw !== true && raw !== "true") {
            return res.status(400).json({ error: `${field.label} is required` });
          }
          continue;
        }
        const strVal = raw == null ? "" : String(raw).trim();
        if (required && !strVal) {
          return res.status(400).json({ error: `${field.label} is required` });
        }
        if (field.field_type === "select" && strVal) {
          const opts = parseFieldOptions(field.options_json);
          if (opts.length > 0 && !opts.includes(strVal)) {
            return res.status(400).json({ error: `Invalid option for ${field.label}` });
          }
        }
      }

      const feePercent =
        Number(event.service_fee_percent ?? event.org_fee_percent ?? 11);
      const priceCents = Number(category.price_cents);
      const serviceFeeCents = calcServiceFeeCents(priceCents, feePercent);
      const totalCents = priceCents + serviceFeeCents;
      const mockMode = !stripeConfigured || !stripeClient;
      const regUuid = newPublicUuid();
      const payUuid = newPublicUuid();
      const regNumber = await nextRegistrationNumber(event.id as number);
      const qrToken = newQrToken();

      const conn = await pool.getConnection();
      let paymentId: number;
      let registrationId: number;
      let stripePaymentIntentId: string | null = null;
      let clientSecret: string | null = null;

      try {
        await conn.beginTransaction();

        const [regResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO registrations (
            public_uuid, event_id, event_category_id, athlete_id, registration_number,
            qr_code_token, status, price_cents, service_fee_cents, total_cents, currency, source
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            regUuid,
            event.id,
            category.id,
            athleteId,
            regNumber,
            qrToken,
            "pending_payment",
            priceCents,
            serviceFeeCents,
            totalCents,
            category.currency || "MXN",
            "web",
          ],
        );
        registrationId = regResult.insertId;

        const [payResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (
            public_uuid, idempotency_key, registration_id, athlete_id, organizer_id, event_id,
            amount_cents, registration_amount_cents, service_fee_cents, currency, status, provider
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            payUuid,
            idempotencyKey,
            registrationId,
            athleteId,
            event.organizer_id,
            event.id,
            totalCents,
            priceCents,
            serviceFeeCents,
            category.currency || "MXN",
            "pending",
            mockMode ? "mock" : "stripe",
          ],
        );
        paymentId = payResult.insertId;

        await conn.query<ResultSetHeader>(
          `UPDATE registrations SET payment_id = ? WHERE id = ?`,
          [paymentId, registrationId],
        );

        for (const field of fieldRows) {
          const key = field.field_key as string;
          const raw = fieldValues[key];
          let valueText: string | null = null;
          if (field.field_type === "checkbox") {
            valueText = raw === true || raw === "true" ? "true" : "false";
          } else if (raw != null && String(raw).trim()) {
            valueText = String(raw).trim();
          }
          if (valueText != null) {
            await conn.query<ResultSetHeader>(
              `INSERT INTO registration_field_values (registration_id, field_id, value_text)
               VALUES (?,?,?)`,
              [registrationId, field.id, valueText],
            );
          }
        }

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      if (mockMode) {
        clientSecret = `mock_${payUuid}`;
      } else if (stripeClient) {
        const piParams: Stripe.PaymentIntentCreateParams = {
          amount: totalCents,
          currency: (category.currency as string)?.toLowerCase() || "mxn",
          metadata: {
            registration_uuid: regUuid,
            event_slug: slug,
            athlete_id: String(athleteId),
          },
          automatic_payment_methods: { enabled: true },
        };
        if (serviceFeeCents > 0) {
          piParams.application_fee_amount = serviceFeeCents;
        }
        if (
          event.stripe_account_id &&
          event.stripe_onboarding_complete
        ) {
          piParams.transfer_data = {
            destination: event.stripe_account_id as string,
          };
        }
        const pi = await stripeClient.paymentIntents.create(piParams);
        stripePaymentIntentId = pi.id;
        clientSecret = pi.client_secret;
        await pool.query<ResultSetHeader>(
          `UPDATE payments SET stripe_payment_intent_id = ?, status = 'processing' WHERE id = ?`,
          [pi.id, paymentId],
        );
      }

      res.json({
        registrationPublicUuid: regUuid,
        paymentPublicUuid: payUuid,
        clientSecret,
        mockMode,
        amountCents: totalCents,
        registrationAmountCents: priceCents,
        serviceFeeCents,
        currency: category.currency || "MXN",
        categoryName: category.name,
        eventTitle: event.title,
      });
    },
  );

  app.post(
    "/api/events/:slug/register/confirm",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const registrationPublicUuid = String(
        req.body?.registrationPublicUuid ?? "",
      ).trim();
      const paymentIntentId = req.body?.paymentIntentId
        ? String(req.body.paymentIntentId)
        : undefined;

      if (!registrationPublicUuid) {
        return res.status(400).json({ error: "registrationPublicUuid required" });
      }

      const result = await confirmRegistrationPayment(
        registrationPublicUuid,
        req.auth!.id,
        paymentIntentId,
      );

      if (!result.success || !result.registration) {
        return res.status(402).json({
          success: false,
          error: result.error || "Payment failed",
        });
      }

      const r = result.registration;
      res.json({
        success: true,
        registration: {
          public_uuid: r.public_uuid,
          registration_number: r.registration_number,
          qr_code_token: r.qr_code_token,
          status: r.status,
          total_cents: r.total_cents,
          category_name: r.category_name,
          event_title: r.event_title,
          event_slug: r.event_slug,
        },
      });
    },
  );
}

// ============================================================================
// ROUTES — ATHLETE PORTAL
// ============================================================================

function registerAthleteRoutes(app: express.Express) {
  app.get("/api/athlete/me", requireAthlete, async (req: AuthedRequest, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_uuid, email, phone, first_name, last_name, date_of_birth, gender,
              shirt_size, country, city, avatar_url, preferred_language, created_at
       FROM athletes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [req.auth!.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Athlete not found" });
    }
    res.json({ athlete: rows[0] });
  });

  app.patch(
    "/api/athlete/preferences",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const locale = req.body?.preferred_language
        ? normalizeLocale(String(req.body.preferred_language))
        : null;
      if (!locale) {
        return res.status(400).json({ error: "preferred_language required (es|en)" });
      }
      await pool.query<ResultSetHeader>(
        "UPDATE athletes SET preferred_language = ? WHERE id = ?",
        [locale, req.auth!.id],
      );
      res.json({ ok: true, preferred_language: locale });
    },
  );

  app.get(
    "/api/athlete/registrations",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.public_uuid, r.registration_number, r.qr_code_token, r.bib_number, r.status,
                r.total_cents, r.created_at,
                e.title AS event_title, e.slug AS event_slug, e.start_date,
                ec.name AS category_name
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
         JOIN event_categories ec ON ec.id = r.event_category_id
         WHERE r.athlete_id = ? AND r.deleted_at IS NULL
         ORDER BY r.created_at DESC`,
        [req.auth!.id],
      );
      res.json({ registrations: rows });
    },
  );
}

// ============================================================================
// ROUTES — ORGANIZER PORTAL
// ============================================================================

function registerOrganizerRoutes(app: express.Express) {
  app.get(
    "/api/organizer/events",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT e.id, e.slug, e.title, e.status, e.start_date, e.registration_count,
                st.name AS sport_name
         FROM events e
         JOIN sport_types st ON st.id = e.sport_type_id
         WHERE e.organizer_id = ?
         ORDER BY e.start_date DESC`,
        [organizerId],
      );
      res.json({ events: rows });
    },
  );

  app.get(
    "/api/organizer/events/:eventId/sponsors",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM events WHERE id = ? AND organizer_id = ? LIMIT 1",
        [eventId, organizerId],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [sponsors] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, logo_url, website_url, tier, sort_order
         FROM event_sponsors
         WHERE event_id = ? AND is_active = 1
         ORDER BY sort_order ASC`,
        [eventId],
      );
      res.json({ sponsors });
    },
  );

  app.put(
    "/api/organizer/events/:eventId/sponsors",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM events WHERE id = ? AND organizer_id = ? LIMIT 1",
        [eventId, organizerId],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      const raw = req.body?.sponsors;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "sponsors array required" });
      }

      const validTiers = new Set(["title", "gold", "silver", "bronze", "partner"]);
      const sponsors = raw
        .map((s: Record<string, unknown>, index: number) => {
          const name = String(s.name ?? "").trim();
          if (!name) return null;
          const tier = String(s.tier ?? "partner");
          return {
            name: name.slice(0, 200),
            logo_url: s.logo_url ? String(s.logo_url).slice(0, 500) : null,
            website_url: s.website_url ? String(s.website_url).slice(0, 500) : null,
            tier: validTiers.has(tier) ? tier : "partner",
            sort_order: Number.isFinite(Number(s.sort_order)) ? Number(s.sort_order) : index + 1,
          };
        })
        .filter(Boolean) as Array<{
        name: string;
        logo_url: string | null;
        website_url: string | null;
        tier: string;
        sort_order: number;
      }>;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM event_sponsors WHERE event_id = ?", [eventId]);
        for (const s of sponsors) {
          await conn.query<ResultSetHeader>(
            `INSERT INTO event_sponsors (event_id, name, logo_url, website_url, tier, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [eventId, s.name, s.logo_url, s.website_url, s.tier, s.sort_order],
          );
        }
        await conn.commit();

        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, name, logo_url, website_url, tier, sort_order
           FROM event_sponsors WHERE event_id = ? AND is_active = 1 ORDER BY sort_order ASC`,
          [eventId],
        );
        res.json({ sponsors: rows });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },
  );
}

// ============================================================================
// ROUTES — ADMIN
// ============================================================================

function registerAdminRoutes(app: express.Express) {
  app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    const [[stats]] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM athletes WHERE status = 'active') AS athletes,
         (SELECT COUNT(*) FROM organizers WHERE status = 'active') AS organizers,
         (SELECT COUNT(*) FROM events WHERE status = 'published') AS published_events,
         (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed') AS confirmed_registrations,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'succeeded') AS total_revenue_cents`,
    );
    res.json({ stats: stats ?? {} });
  });
}

// ============================================================================
// ROUTES — WEBHOOKS (Stripe Connect)
// ============================================================================

function registerWebhookRoutes(app: express.Express) {
  app.post("/api/webhooks/stripe", async (req, res) => {
    // TODO: verify Stripe signature and handle payment_intent.succeeded
    console.log("[stripe:webhook]", req.body?.type);
    res.json({ received: true });
  });
}

// ============================================================================
// EXPORTS — Vercel serverless + dev server
// ============================================================================

let app: ReturnType<typeof buildApp>;
try {
  app = buildApp();
} catch (initErr: any) {
  console.error(
    "[API init] Fatal error during startup:",
    initErr?.message ?? initErr,
  );
  app = express() as any;
  (app as any).use((_req: Request, res: Response) => {
    res.status(503).json({
      error:
        "Service unavailable — server failed to initialise. Check environment variables.",
    });
  });
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}

export function createServer() {
  return buildApp();
}
