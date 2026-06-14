import dotenv from "dotenv";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import twilio from "twilio";
import Stripe from "stripe";
import { createClerkClient, verifyToken } from "@clerk/backend";
import {
  registerStaffPortalRoutes,
  listAdminAthletes,
  listStaffRegistrations,
  listOrganizerMemberEvents,
  assertMemberCanAccessEvent,
  getOrganizerMemberRole,
} from "../server/staffPortal.js";
import { canOrganizerEditEvents } from "../shared/staffRoles.js";
import { calcServiceFeeCents } from "../shared/checkoutBreakdown.js";
import {
  applyConnectToPaymentIntent,
  assertOrganizerPayoutReadyForPaidEvent,
  handleStripeAccountUpdatedWebhook,
  handleStripeConnectDeauthorized,
  enrichStaffEventsWithPaymentAvailability,
  resolveCheckoutConnectMode,
} from "../server/stripeConnect.js";
import { buildStripeRefundParams } from "../server/stripeRefunds.js";
import {
  claimStripeWebhookEvent,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessed,
} from "../server/stripeWebhook.js";
import { registerPhase2Routes } from "../server/phase2.js";
import { registerPublicTeamRoutes } from "../server/publicTeams.js";
import { registerBlogRoutes } from "../server/blog.js";
import { cdnAwareJsonBodyParser } from "../server/cdnUploadJsonBody.js";
import {
  isStaffProxyableImageUrl,
  normalizeEventMediaUrl,
} from "../shared/cdnUrl.js";
import {
  CATEGORY_SOLD_COUNT_UNALIASED_SQL,
  DISCOUNT_USED_COUNT_SQL,
  EVENT_REGISTRATION_COUNT_SQL,
  TEAM_MEMBER_COUNT_SQL,
  WAVE_REGISTERED_COUNT_SQL,
} from "../server/registrationCounts.js";
import {
  likePatternsForTokens,
  rankByFuzzy,
  searchTokens,
} from "../server/searchFuzzy.js";
import {
  fetchActiveEventWaiversPublic,
  getRegistrationWaiverStatus,
  insertRegistrationWaiverSignatures,
  parseWaiverSignatures,
  resignRegistrationWaivers,
  validateWaiverSignaturesForEvent,
  type WaiverSignatureInput,
} from "../server/eventWaivers.js";
import { parseCheckoutPaymentMetadata, type CheckoutPaymentMetadata } from "../server/checkoutMetadata.js";
import {
  clerkAuthorizedParties,
  getClerkConfigDiagnostics,
  resolvePublicAppUrl,
} from "../server/clerkConfig.js";
import {
  checkoutTrace,
  checkoutTraceError,
} from "../server/checkoutTrace.js";
import { parseEventDateRange } from "../server/eventsMarketplaceFilters.js";
import {
  appendMarketplaceListFilters,
  listMarketplaceEventsWithFuzzySearch,
  type MarketplaceListFilters,
} from "../server/eventsMarketplaceSearch.js";
import {
  eventMatchesGeoCitySql,
  resolveGeoCityById,
} from "../server/geo.js";
import {
  hashAthletePassword,
  verifyAthletePassword,
} from "../server/password.js";
import { validateAthletePassword } from "../shared/passwordPolicy.js";
import { evaluateCategoryEligibility } from "../shared/categoryEligibility.js";
import { normalizeApiDateOnly } from "../shared/api.js";
// Shared modules imported transitively by server/* — referenced here for Vercel bundle.
import { validateCoursePayload } from "../shared/courseValidation.js";
import {
  buildRouteGeoJson,
  getRouteImportSource,
  parseRouteGeoJson,
} from "../shared/courseGeoJson.js";
import {
  evaluateCheckInWindow,
  eventEndWallTime,
  normalizeWallDateTimeFromDb,
  parseIncomingEventDateTime,
} from "../shared/checkInWindow.js";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "../shared/waiverConstants.js";
import { normalizeBlogSlug, resolveBlogSlug } from "../shared/slugify.js";
import {
  buildStripePayoutChecklist,
  buildTribooPayoutChecklist,
  deriveStripeConnectStatusFromCapabilities,
  isOrganizerPayoutReady,
  isTribooPayoutProfileComplete,
} from "../shared/stripeConnect.js";
import { handleStaffImageProxy } from "../server/staffImageProxy.js";
import {
  checkAthleteAuthRateLimit,
  type AthleteAuthRateLimitScope,
} from "../server/authRateLimit.js";

/** Keeps transitive server/shared modules in the Vercel lambda bundle (see vercel.json). */
const __vercelServerBundle = {
  validateCoursePayload,
  buildRouteGeoJson,
  getRouteImportSource,
  parseRouteGeoJson,
  evaluateCheckInWindow,
  eventEndWallTime,
  normalizeWallDateTimeFromDb,
  parseIncomingEventDateTime,
  WAIVER_ACCEPTANCE_SIGNATURE,
  normalizeBlogSlug,
  resolveBlogSlug,
  buildStripePayoutChecklist,
  buildTribooPayoutChecklist,
  deriveStripeConnectStatusFromCapabilities,
  isOrganizerPayoutReady,
  isTribooPayoutProfileComplete,
  isStaffProxyableImageUrl,
  handleStaffImageProxy,
};
void __vercelServerBundle;
import {
  getTestAuthBypass,
  getTestClerkProfileResolver,
  getTestPoolOverride,
  getTestResetCodeGenerator,
  getTestStripeClientOverride,
  isTestMode,
  pushCapturedTestEmail,
} from "./testHooks.js";

const IS_VERCEL = process.env.VERCEL === "1";
const IS_PROD = process.env.NODE_ENV === "production";

if (!IS_VERCEL) {
  dotenv.config();
}

function logDev(message: string, level: "log" | "warn" = "log") {
  //if (!IS_PROD) {
  console[level](message);
  //}
}

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

function resolveLocale(
  ...candidates: (string | null | undefined)[]
): AppLocale {
  for (const c of candidates) {
    if (c) return normalizeLocale(c);
  }
  return DEFAULT_LOCALE;
}

// ============================================================================
// EMAIL TEMPLATES (inlined for Vercel serverless bundle)
// ============================================================================

const EMAIL_BRAND = {
  black: "#05070D",
  bgDark: "#05070D",
  surfaceDark: "#12141A",
  orange: "#FF5A1F",
  red: "#F23C35",
  accent: "#FF5A1F",
  success: "#FF5A1F",
  textPrimary: "#FFFFFF",
  textMuted: "#A3A3A3",
  textDim: "#737373",
  border: "#262626",
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

const EMAIL_LOGO_URL =
  "https://disruptinglabs.com/data/triboo/assets/images/logos/triboo_logo_orange_horizontal_white_title.png";

type EmailTemplateKind =
  | "otp"
  | "passwordReset"
  | "welcomeAthlete"
  | "welcomeStaff"
  | "registrationConfirmed"
  | "eventSubmittedForApproval"
  | "eventApproved"
  | "eventRejected";

type EmailAudience = "athlete" | "admin" | "organizer";

function emailLogoBlock(height = 36): string {
  return `<img src="${EMAIL_LOGO_URL}" alt="Triboo Sport" width="168" height="${height}" style="display:block;height:${height}px;width:auto;max-width:200px;border:0;outline:none;" />`;
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
  passwordReset: {
    preheader: string;
    title: string;
    greeting: string;
    intro: string;
    expiry: string;
    security: string;
    cta: string;
  };
  eventSubmittedForApproval: {
    preheader: string;
    title: string;
    greeting: string;
    intro: string;
    eventLabel: string;
    cta: string;
  };
  eventApproved: {
    preheader: string;
    title: string;
    greeting: string;
    intro: string;
    eventLabel: string;
    cta: string;
  };
  eventRejected: {
    preheader: string;
    title: string;
    greeting: string;
    intro: string;
    eventLabel: string;
    reasonLabel: string;
    noReason: string;
    cta: string;
  };
};

const EMAIL_STRINGS_ES: EmailStrings = {
  subjects: {
    otp: "{{code}} es tu código de verificación — Triboo Sport",
    passwordReset: "{{code}} — restablece tu contraseña Triboo Sport",
    welcomeAthlete: "¡Bienvenido a Triboo Sport!",
    welcomeStaff: "Bienvenido al Staff Console — Triboo Sport",
    registrationConfirmed: "¡Inscripción confirmada! — Triboo Sport",
    eventSubmittedForApproval: "Evento pendiente de aprobación — Triboo Sport",
    eventApproved: "¡Evento publicado! — Triboo Sport",
    eventRejected: "Evento devuelto a borrador — Triboo Sport",
  },
  otp: {
    preheader: "Tu código de acceso expira en 10 minutos",
    title: "Código de verificación",
    greeting: "Hola {{name}},",
    intro: "Usa este código para acceder a tu cuenta de Triboo Sport:",
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
      "Tienes acceso al panel de administración de Triboo Sport. Inicia sesión en la consola de staff con tu correo; recibirás un código de verificación para entrar.",
    introOrganizer:
      "Tu hub de organizador está listo. Administra eventos, inscripciones y pagos desde un solo lugar.",
    cta: "Abrir consola",
  },
  registrationConfirmed: {
    preheader: "Tu lugar en la competencia está asegurado",
    title: "¡Inscripción confirmada!",
    greeting: "Hola {{name}},",
    intro:
      "Tu registro fue procesado correctamente. Guarda este correo como comprobante.",
    eventLabel: "Evento",
    categoryLabel: "Categoría",
    folioLabel: "Folio",
    cta: "Ver mi inscripción",
  },
  footer: {
    tagline: "La plataforma de eventos deportivos de México",
    help: "¿Necesitas ayuda? Responde a este correo o visita nuestro centro de soporte.",
    copyright: "© {{year}} Triboo Sport. Todos los derechos reservados.",
  },
  sms: {
    otp: "Triboo Sport: tu código es {{code}}. Expira en {{minutes}} min.",
  },
  passwordReset: {
    preheader: "Enlace para restablecer tu contraseña",
    title: "Restablecer contraseña",
    greeting: "Hola {{name}},",
    intro:
      "Usa este código para restablecer la contraseña de tu cuenta. También puedes usar el botón de abajo:",
    expiry: "Este enlace expira en {{minutes}} minutos.",
    security:
      "Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá funcionando.",
    cta: "Restablecer contraseña",
  },
  eventSubmittedForApproval: {
    preheader: "Un organizador envió un evento para revisión",
    title: "Evento pendiente de aprobación",
    greeting: "Hola {{name}},",
    intro:
      "Un organizador envió un evento para tu revisión. Apruébalo o devuélvelo a borrador desde la consola de staff.",
    eventLabel: "Evento",
    cta: "Revisar en consola",
  },
  eventApproved: {
    preheader: "Tu evento ya está publicado",
    title: "¡Evento aprobado!",
    greeting: "Hola {{name}},",
    intro:
      "Tu evento fue aprobado y ya está publicado. Los atletas pueden verlo e inscribirse.",
    eventLabel: "Evento",
    cta: "Ver evento en consola",
  },
  eventRejected: {
    preheader: "Tu evento necesita cambios antes de publicarse",
    title: "Evento devuelto a borrador",
    greeting: "Hola {{name}},",
    intro:
      "Un administrador devolvió tu evento a borrador. Revisa los comentarios, ajusta lo necesario y vuelve a enviarlo.",
    eventLabel: "Evento",
    reasonLabel: "Motivo",
    noReason: "No se indicó un motivo específico.",
    cta: "Editar evento",
  },
};

const EMAIL_STRINGS_EN: EmailStrings = {
  subjects: {
    otp: "{{code}} is your Triboo Sport verification code",
    passwordReset: "{{code}} — reset your Triboo Sport password",
    welcomeAthlete: "Welcome to Triboo Sport!",
    welcomeStaff: "Welcome to Staff Console — Triboo Sport",
    registrationConfirmed: "Registration confirmed! — Triboo Sport",
    eventSubmittedForApproval: "Event pending approval — Triboo Sport",
    eventApproved: "Event published! — Triboo Sport",
    eventRejected: "Event returned to draft — Triboo Sport",
  },
  otp: {
    preheader: "Your access code expires in 10 minutes",
    title: "Verification code",
    greeting: "Hi {{name}},",
    intro: "Use this code to sign in to your Triboo Sport account:",
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
      "You have access to the Triboo Sport admin panel. Sign in at the staff console with your email; we'll send you a verification code to get in.",
    introOrganizer:
      "Your organizer hub is ready. Manage events, registrations, and payments in one place.",
    cta: "Open console",
  },
  registrationConfirmed: {
    preheader: "Your spot in the race is secured",
    title: "Registration confirmed!",
    greeting: "Hi {{name}},",
    intro:
      "Your registration was processed successfully. Keep this email as proof.",
    eventLabel: "Event",
    categoryLabel: "Category",
    folioLabel: "Registration #",
    cta: "View my registration",
  },
  footer: {
    tagline: "Mexico's sports events platform",
    help: "Need help? Reply to this email or visit our support center.",
    copyright: "© {{year}} Triboo Sport. All rights reserved.",
  },
  sms: {
    otp: "Triboo Sport: your code is {{code}}. Expires in {{minutes}} min.",
  },
  passwordReset: {
    preheader: "Link to reset your password",
    title: "Reset password",
    greeting: "Hi {{name}},",
    intro:
      "Use this code to reset your account password. You can also tap the button below:",
    expiry: "This link expires in {{minutes}} minutes.",
    security:
      "If you didn't request this change, ignore this email. Your current password will still work.",
    cta: "Reset password",
  },
  eventSubmittedForApproval: {
    preheader: "An organizer submitted an event for review",
    title: "Event pending approval",
    greeting: "Hi {{name}},",
    intro:
      "An organizer submitted an event for your review. Approve it or return it to draft from the staff console.",
    eventLabel: "Event",
    cta: "Review in console",
  },
  eventApproved: {
    preheader: "Your event is now live",
    title: "Event approved!",
    greeting: "Hi {{name}},",
    intro:
      "Your event was approved and is now published. Athletes can view it and register.",
    eventLabel: "Event",
    cta: "View event in console",
  },
  eventRejected: {
    preheader: "Your event needs changes before it can go live",
    title: "Event returned to draft",
    greeting: "Hi {{name}},",
    intro:
      "An admin returned your event to draft. Review the feedback, make updates, and submit again.",
    eventLabel: "Event",
    reasonLabel: "Reason",
    noReason: "No specific reason was provided.",
    cta: "Edit event",
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
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    String(vars[key] ?? ""),
  );
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
    ? `<tr><td align="center" style="padding:0 32px 28px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr><td align="center" bgcolor="${EMAIL_BRAND.orange}" style="border-radius:12px;background:linear-gradient(135deg,${EMAIL_BRAND.orange} 0%,${EMAIL_BRAND.red} 100%);">
            <a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 32px;color:${EMAIL_BRAND.textPrimary};font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;">${escapeHtml(cta.label)}</a>
          </td></tr>
        </table>
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
  <!--[if mso]><style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style><![endif]-->
  <style type="text/css">
    body, table, td { margin: 0; padding: 0; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-content, .email-header, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.bgDark};font-family:${EMAIL_BRAND.fontFamily};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_BRAND.bgDark}">
    <tr>
      <td align="center" valign="top" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="560" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_BRAND.surfaceDark}" style="width:560px;max-width:560px;border-radius:16px;border:1px solid ${EMAIL_BRAND.border};">
          <tr>
            <td class="email-header" bgcolor="${EMAIL_BRAND.black}" style="padding:28px 32px 20px;border-bottom:2px solid ${EMAIL_BRAND.orange};">
              ${emailLogoBlock()}
              <h1 style="margin:16px 0 0;font-size:24px;font-weight:800;color:${EMAIL_BRAND.textPrimary};line-height:1.3;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:28px 32px;color:${EMAIL_BRAND.textPrimary};font-size:16px;line-height:1.65;">
              ${bodyHtml}
            </td>
          </tr>
          ${ctaBlock}
          <tr>
            <td class="email-footer" bgcolor="${EMAIL_BRAND.black}" style="padding:24px 32px 28px;border-top:1px solid ${EMAIL_BRAND.border};">
              <p style="margin:0 0 8px;font-size:13px;color:${EMAIL_BRAND.orange};font-weight:600;">${escapeHtml(s.footer.tagline)}</p>
              <p style="margin:0 0 16px;font-size:12px;color:${EMAIL_BRAND.textDim};line-height:1.5;">${escapeHtml(s.footer.help)}</p>
              <p style="margin:0;font-size:11px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(interpolateEmail(s.footer.copyright, { year }))}</p>
              <p style="margin:12px 0 0;font-size:11px;"><a href="${escapeHtml(appUrl)}" style="color:${EMAIL_BRAND.orange};text-decoration:none;">${escapeHtml(appUrl.replace(/^https?:\/\//, ""))}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function otpCodeBlock(code: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:24px 0 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_BRAND.black}" style="border:2px solid ${EMAIL_BRAND.orange};border-radius:12px;">
          <tr>
            <td align="center" style="padding:18px 28px;font-size:32px;font-weight:800;font-family:ui-monospace,'SF Mono',Consolas,monospace;color:${EMAIL_BRAND.orange};line-height:1.2;letter-spacing:0.08em;">${escapeHtml(code)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
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
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
      <tr>
        <td style="padding:16px;background-color:${EMAIL_BRAND.black};border-radius:10px;border-left:3px solid ${EMAIL_BRAND.orange};font-size:13px;color:${EMAIL_BRAND.textMuted};line-height:1.5;">${escapeHtml(s.otp.security)}</td>
      </tr>
    </table>`;

  const subject = interpolateEmail(s.subjects.otp, { code });
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
      (f, i) =>
        `<tr><td style="padding:12px 16px;${i < s.welcomeAthlete.features.length - 1 ? `border-bottom:1px solid ${EMAIL_BRAND.border};` : ""}">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="top" width="24" style="width:24px;padding-right:10px;padding-top:2px;">${emailCheckIcon()}</td>
              <td valign="top" style="color:${EMAIL_BRAND.textMuted};font-size:15px;line-height:1.5;">${escapeHtml(f)}</td>
            </tr>
          </table>
        </td></tr>`,
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${escapeHtml(interpolateEmail(s.welcomeAthlete.greeting, { name: firstName }))}</p>
    <p style="margin:0 0 20px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.welcomeAthlete.intro)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_BRAND.black}" style="border-radius:12px;border:1px solid ${EMAIL_BRAND.border};">${features}</table>`;

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

function buildPasswordResetEmail(params: {
  locale: AppLocale;
  firstName: string;
  code: string;
  resetUrl: string;
  minutes?: number;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { locale, firstName, code, resetUrl, minutes = OTP_TTL_MIN, appUrl } = params;
  const s = emailStrings(locale);
  const bodyHtml = `
    <p style="margin:0 0 12px;color:${EMAIL_BRAND.textPrimary};font-size:17px;">${escapeHtml(interpolateEmail(s.passwordReset.greeting, { name: firstName }))}</p>
    <p style="margin:0 0 8px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.passwordReset.intro)}</p>
    ${otpCodeBlock(code)}
    <p style="margin:16px 0 0;text-align:center;font-size:13px;color:${EMAIL_BRAND.textDim};">${interpolateEmail(escapeHtml(s.passwordReset.expiry), { minutes })}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
      <tr>
        <td style="padding:16px;background-color:${EMAIL_BRAND.black};border-radius:10px;border-left:3px solid ${EMAIL_BRAND.orange};font-size:13px;color:${EMAIL_BRAND.textMuted};line-height:1.5;">${escapeHtml(s.passwordReset.security)}</td>
      </tr>
    </table>`;

  return {
    subject: interpolateEmail(s.subjects.passwordReset, { code }),
    html: emailShell({
      locale,
      preheader: s.passwordReset.preheader,
      title: s.passwordReset.title,
      bodyHtml,
      cta: { label: s.passwordReset.cta, url: resetUrl },
      appUrl,
    }),
    text: `${interpolateEmail(s.passwordReset.greeting, { name: firstName })}\n\n${s.passwordReset.intro}\n\n${code}\n\n${resetUrl}\n\n${interpolateEmail(s.passwordReset.expiry, { minutes })}`,
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
    <p style="margin:0 0 12px;font-size:17px;">${escapeHtml(interpolateEmail(s.welcomeStaff.greeting, { name: firstName }))}</p>
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

function buildEventSubmittedForApprovalEmail(params: {
  locale: AppLocale;
  firstName: string;
  eventTitle: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { locale, firstName, eventTitle, appUrl } = params;
  const s = emailStrings(locale);
  const staffUrl = `${appUrl.replace(/\/$/, "")}/staff/admin/events`;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${escapeHtml(interpolateEmail(s.eventSubmittedForApproval.greeting, { name: firstName }))}</p>
    <p style="margin:0 0 16px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.eventSubmittedForApproval.intro)}</p>
    <p style="margin:0;font-size:15px;"><span style="color:${EMAIL_BRAND.textDim};">${escapeHtml(s.eventSubmittedForApproval.eventLabel)}:</span> <strong>${escapeHtml(eventTitle)}</strong></p>`;
  return {
    subject: s.subjects.eventSubmittedForApproval,
    html: emailShell({
      locale,
      preheader: s.eventSubmittedForApproval.preheader,
      title: s.eventSubmittedForApproval.title,
      bodyHtml,
      cta: { label: s.eventSubmittedForApproval.cta, url: staffUrl },
      appUrl,
    }),
    text: `${interpolateEmail(s.eventSubmittedForApproval.greeting, { name: firstName })}\n\n${s.eventSubmittedForApproval.intro}\n\n${s.eventSubmittedForApproval.eventLabel}: ${eventTitle}\n\n${staffUrl}`,
  };
}

function buildEventApprovedEmail(params: {
  locale: AppLocale;
  firstName: string;
  eventTitle: string;
  appUrl: string;
  eventId: number;
}): { subject: string; html: string; text: string } {
  const { locale, firstName, eventTitle, appUrl, eventId } = params;
  const s = emailStrings(locale);
  const eventUrl = `${appUrl.replace(/\/$/, "")}/staff/organizer/events/${eventId}`;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${escapeHtml(interpolateEmail(s.eventApproved.greeting, { name: firstName }))}</p>
    <p style="margin:0 0 16px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.eventApproved.intro)}</p>
    <p style="margin:0;font-size:15px;"><span style="color:${EMAIL_BRAND.textDim};">${escapeHtml(s.eventApproved.eventLabel)}:</span> <strong>${escapeHtml(eventTitle)}</strong></p>`;
  return {
    subject: s.subjects.eventApproved,
    html: emailShell({
      locale,
      preheader: s.eventApproved.preheader,
      title: s.eventApproved.title,
      bodyHtml,
      cta: { label: s.eventApproved.cta, url: eventUrl },
      appUrl,
    }),
    text: `${interpolateEmail(s.eventApproved.greeting, { name: firstName })}\n\n${s.eventApproved.intro}\n\n${s.eventApproved.eventLabel}: ${eventTitle}\n\n${eventUrl}`,
  };
}

function buildEventRejectedEmail(params: {
  locale: AppLocale;
  firstName: string;
  eventTitle: string;
  reason: string | null;
  appUrl: string;
  eventId: number;
}): { subject: string; html: string; text: string } {
  const { locale, firstName, eventTitle, reason, appUrl, eventId } = params;
  const s = emailStrings(locale);
  const eventUrl = `${appUrl.replace(/\/$/, "")}/staff/organizer/events/${eventId}`;
  const reasonText = reason?.trim() ? reason.trim() : s.eventRejected.noReason;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${escapeHtml(interpolateEmail(s.eventRejected.greeting, { name: firstName }))}</p>
    <p style="margin:0 0 16px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.eventRejected.intro)}</p>
    <p style="margin:0 0 8px;font-size:15px;"><span style="color:${EMAIL_BRAND.textDim};">${escapeHtml(s.eventRejected.eventLabel)}:</span> <strong>${escapeHtml(eventTitle)}</strong></p>
    <p style="margin:0;font-size:15px;"><span style="color:${EMAIL_BRAND.textDim};">${escapeHtml(s.eventRejected.reasonLabel)}:</span> ${escapeHtml(reasonText)}</p>`;
  return {
    subject: s.subjects.eventRejected,
    html: emailShell({
      locale,
      preheader: s.eventRejected.preheader,
      title: s.eventRejected.title,
      bodyHtml,
      cta: { label: s.eventRejected.cta, url: eventUrl },
      appUrl,
    }),
    text: `${interpolateEmail(s.eventRejected.greeting, { name: firstName })}\n\n${s.eventRejected.intro}\n\n${s.eventRejected.eventLabel}: ${eventTitle}\n${s.eventRejected.reasonLabel}: ${reasonText}\n\n${eventUrl}`,
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
    `<tr><td style="padding:12px 20px;border-bottom:1px solid ${EMAIL_BRAND.border};"><span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:${EMAIL_BRAND.textDim};">${escapeHtml(label)}</span><span style="display:block;margin-top:4px;font-size:16px;font-weight:600;color:${EMAIL_BRAND.textPrimary};">${escapeHtml(value)}</span></td></tr>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:17px;">${escapeHtml(interpolateEmail(s.registrationConfirmed.greeting, { name: firstName }))}</p>
    <p style="margin:0 0 20px;color:${EMAIL_BRAND.textMuted};">${escapeHtml(s.registrationConfirmed.intro)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_BRAND.black}" style="border-radius:12px;border:1px solid ${EMAIL_BRAND.orange};">
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

const APP_URL = resolvePublicAppUrl();
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
if (CLERK_SECRET_KEY) {
  logDev("[ok] Clerk configured");
} else {
  logDev("[warn] CLERK_SECRET_KEY not set — Google/Apple SSO disabled", "warn");
}
const SESSION_TTL_DAYS = 30;
const OTP_TTL_MIN = 10;

interface ClerkAthleteProfile {
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  googleId: string | null;
  appleId: string | null;
  facebookId: string | null;
  avatarUrl: string | null;
}

async function resolveClerkAthleteProfile(
  sessionToken: string,
): Promise<{ profile: ClerkAthleteProfile } | { error: string }> {
  if (!sessionToken) {
    return { error: "Clerk is not configured" };
  }
  if (isTestMode()) {
    const testResolver = getTestClerkProfileResolver();
    if (testResolver) {
      return (await testResolver(sessionToken)) as
        | { profile: ClerkAthleteProfile }
        | { error: string };
    }
  }
  if (!CLERK_SECRET_KEY) {
    return { error: "Clerk is not configured" };
  }
  try {
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    const verified = await verifyToken(sessionToken, {
      secretKey: CLERK_SECRET_KEY,
      authorizedParties: clerkAuthorizedParties({ isProd: IS_PROD }),
    });
    const userId = verified.sub;
    if (!userId) return { error: "Invalid Clerk session" };

    const user = await clerk.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses.find((a) => a.verification?.status === "verified")
        ?.emailAddress ||
      user.emailAddresses[0]?.emailAddress;
    if (!email) {
      return {
        error:
          "Your social account has no email. Add an email in your provider settings or sign in with email.",
      };
    }

    const googleAccount = user.externalAccounts?.find(
      (account) =>
        account.provider === "oauth_google" || account.provider === "google",
    );
    const appleAccount = user.externalAccounts?.find(
      (account) =>
        account.provider === "oauth_apple" || account.provider === "apple",
    );
    const facebookAccount = user.externalAccounts?.find(
      (account) =>
        account.provider === "oauth_facebook" || account.provider === "facebook",
    );

    const firstName = user.firstName?.trim() || "Atleta";
    const lastName = user.lastName?.trim() || "Athlete";

    return {
      profile: {
        clerkUserId: userId,
        email: email.trim().toLowerCase(),
        firstName,
        lastName,
        googleId: googleAccount?.externalId ?? googleAccount?.providerUserId ?? null,
        appleId: appleAccount?.externalId ?? appleAccount?.providerUserId ?? null,
        facebookId:
          facebookAccount?.externalId ?? facebookAccount?.providerUserId ?? null,
        avatarUrl: user.imageUrl || null,
      },
    };
  } catch (err) {
    console.error("[clerk] token verification failed:", err);
    return { error: "Invalid or expired social session. Please try again." };
  }
}

async function findOrCreateAthleteFromClerk(
  profile: ClerkAthleteProfile,
  locale: AppLocale,
): Promise<{ athlete: RowDataPacket; isNew: boolean }> {
  const conditions: string[] = ["clerk_user_id = ?", "email = ?"];
  const params: (string | null)[] = [profile.clerkUserId, profile.email];

  if (profile.googleId) {
    conditions.push("google_id = ?");
    params.push(profile.googleId);
  }
  if (profile.appleId) {
    conditions.push("apple_id = ?");
    params.push(profile.appleId);
  }
  if (profile.facebookId) {
    conditions.push("facebook_id = ?");
    params.push(profile.facebookId);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, first_name, last_name, date_of_birth, gender, avatar_url,
            google_id, apple_id, facebook_id, preferred_language, last_login_at, password_hash
     FROM athletes
     WHERE status = 'active' AND deleted_at IS NULL
       AND (${conditions.join(" OR ")})
     LIMIT 1`,
    params,
  );

  if (rows.length > 0) {
    const athlete = rows[0];
    await pool.query<ResultSetHeader>(
      `UPDATE athletes SET
         email = ?,
         first_name = CASE WHEN first_name = '' OR first_name IS NULL THEN ? ELSE first_name END,
         last_name = CASE WHEN last_name = '' OR last_name IS NULL THEN ? ELSE last_name END,
         avatar_url = COALESCE(?, avatar_url),
         google_id = COALESCE(?, google_id),
         apple_id = COALESCE(?, apple_id),
         facebook_id = COALESCE(?, facebook_id),
         clerk_user_id = COALESCE(clerk_user_id, ?),
         email_verified_at = COALESCE(email_verified_at, NOW()),
         last_login_at = NOW()
       WHERE id = ?`,
      [
        profile.email,
        profile.firstName,
        profile.lastName,
        profile.avatarUrl,
        profile.googleId,
        profile.appleId,
        profile.facebookId,
        profile.clerkUserId,
        athlete.id,
      ],
    );
    const [updated] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, date_of_birth, gender, avatar_url,
              preferred_language, last_login_at
       FROM athletes WHERE id = ? LIMIT 1`,
      [athlete.id],
    );
    return { athlete: updated[0] ?? athlete, isNew: false };
  }

  const [ins] = await pool.query<ResultSetHeader>(
    `INSERT INTO athletes (
       public_uuid, email, email_verified_at, first_name, last_name, avatar_url,
       google_id, apple_id, facebook_id, clerk_user_id, preferred_language
     ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newPublicUuid(),
      profile.email,
      profile.firstName,
      profile.lastName,
      profile.avatarUrl,
      profile.googleId,
      profile.appleId,
      profile.facebookId,
      profile.clerkUserId,
      locale,
    ],
  );

  const [created] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, first_name, last_name, date_of_birth, gender, avatar_url,
            preferred_language, last_login_at
     FROM athletes WHERE id = ? LIMIT 1`,
    [ins.insertId],
  );

  return { athlete: created[0], isNew: true };
}

function athleteAuthPayload(athlete: RowDataPacket) {
  return {
    id: athlete.id,
    email: athlete.email,
    firstName: athlete.first_name,
    lastName: athlete.last_name,
    dateOfBirth: normalizeApiDateOnly(athlete.date_of_birth),
    gender: (athlete.gender as string | null) ?? null,
    avatarUrl: athlete.avatar_url ?? undefined,
  };
}

/** Login email on the athlete record — registration confirmations always go here */
async function athleteLoginEmail(athleteId: number): Promise<string | undefined> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT email FROM athletes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [athleteId],
  );
  const email = rows[0]?.email;
  return email ? String(email).trim() : undefined;
}

async function loadAthleteEligibilityProfile(athleteId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT date_of_birth, gender FROM athletes
     WHERE id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [athleteId],
  );
  return rows[0] ?? null;
}

function categoryEligibilityResponse(
  category: RowDataPacket,
  athlete: RowDataPacket,
  eventStartDate: string,
) {
  const result = evaluateCategoryEligibility(
    {
      min_age: category.min_age as number | null,
      max_age: category.max_age as number | null,
      gender_restriction: category.gender_restriction as string | null,
    },
    {
      date_of_birth: athlete.date_of_birth as string | null,
      gender: athlete.gender as string | null,
    },
    String(eventStartDate).slice(0, 10),
  );
  if (result.eligible === false) {
    if (result.reason === "missing_profile") {
      return {
        status: 409 as const,
        body: {
          error:
            "Complete your profile (date of birth and gender) before registering for this category",
          code: "profile_incomplete",
        },
      };
    }
    if (result.reason === "gender") {
      return {
        status: 403 as const,
        body: {
          error: "You do not meet the gender requirements for this category",
          code: "category_gender_ineligible",
        },
      };
    }
    return {
      status: 403 as const,
      body: {
        error: "You do not meet the age requirements for this category",
        code: "category_age_ineligible",
      },
    };
  }
  return null;
}

async function issueAthleteSession(
  athlete: RowDataPacket,
  req: Request,
  opts?: { welcomeIfFirst?: boolean; locale?: AppLocale },
) {
  const isFirstLogin = !athlete.last_login_at;
  await pool.query<ResultSetHeader>(
    "UPDATE athletes SET last_login_at = NOW() WHERE id = ?",
    [athlete.id],
  );

  if (opts?.welcomeIfFirst && isFirstLogin && athlete.email) {
    const athleteLocale = normalizeLocale(
      (athlete.preferred_language as string | undefined) ?? opts.locale,
    );
    const welcome = buildWelcomeAthleteEmail({
      locale: athleteLocale,
      firstName: athlete.first_name as string,
      appUrl: APP_URL,
    });
    void sendEmail({
      to: athlete.email as string,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
    }).catch((err) => console.error("[email:welcome-athlete]", err));
  }

  const token = await createSession(
    "athlete",
    athlete.id as number,
    (athlete.email as string) || "",
    req.ip,
    req.headers["user-agent"],
  );

  return {
    token,
    athlete: athleteAuthPayload(athlete),
  };
}

async function queueAthletePasswordReset(
  athlete: RowDataPacket,
  req: Request,
  locale: AppLocale,
): Promise<void> {
  const testGen = isTestMode() ? getTestResetCodeGenerator() : null;
  const code = testGen ? testGen() : generateOtpCode();
  const tokenHash = sha256(code);
  await pool.query<ResultSetHeader>(
    `UPDATE athlete_password_resets SET consumed_at = NOW()
     WHERE athlete_id = ? AND consumed_at IS NULL`,
    [athlete.id],
  );
  await pool.query<ResultSetHeader>(
    `INSERT INTO athlete_password_resets (athlete_id, token_hash, expires_at, ip_address)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
    [athlete.id, tokenHash, OTP_TTL_MIN, req.ip?.slice(0, 45) ?? null],
  );
  const email = String(athlete.email || "").trim().toLowerCase();
  const resetUrl = `${APP_URL.replace(/\/$/, "")}/login/reset?email=${encodeURIComponent(email)}`;
  const mail = buildPasswordResetEmail({
    locale,
    firstName: String(athlete.first_name || "Atleta"),
    code,
    resetUrl,
    appUrl: APP_URL,
  });
  await sendEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

// ============================================================================
// DATABASE POOL
// ============================================================================

let prodPool: Pool | null = null;

function initProdPool(): Pool {
  if (prodPool) return prodPool;
  prodPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: IS_VERCEL ? 2 : 10,
    queueLimit: 0,
    timezone: "+00:00",
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: IS_VERCEL ? 15000 : 60000,
  });

  prodPool.on("connection", (conn) => {
    conn.on("error", (err) => logPoolError("connection", err));
  });

  return prodPool;
}

function resolvePool(): Pool {
  const override = getTestPoolOverride();
  if (override) return override;
  if (isTestMode()) {
    throw new Error(
      "Test pool not configured — call setTestPool() before hitting API routes in tests",
    );
  }
  return initProdPool();
}

const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const active = resolvePool();
    const value = (active as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(active);
    }
    return value;
  },
});

export {
  setTestPool,
  setTestAuthBypass,
  resetTestEnvironment,
  setTestClerkProfileResolver,
  setTestStripeClient,
} from "./testHooks.js";

const TRANSIENT_DB_CODES = [
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "ETIMEDOUT",
  "ECONNREFUSED",
];

function logPoolError(scope: string, err: unknown) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as NodeJS.ErrnoException).code)
      : "";
  if (TRANSIENT_DB_CODES.includes(code)) {
    console.warn(`[db pool ${scope}] transient:`, err);
    return;
  }
  console.error(`[db pool ${scope}]`, err);
}

if (!isTestMode()) {
  const dbPool = initProdPool() as Pool & Pick<NodeJS.EventEmitter, "on">;
  dbPool.on("error", (err: unknown) => logPoolError("pool", err));
}

// ============================================================================
// EXTERNAL CLIENTS (Resend / Twilio) — graceful fallback
// ============================================================================

const FROM_EMAIL =
  process.env.SMTP_FROM || "Triboo Sport <no-reply@disruptinglabs.com>";
let resendClient: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
  logDev("[ok] Resend initialized");
} else {
  logDev(
    "[warn] RESEND_API_KEY not set — emails will be logged, not sent",
    "warn",
  );
}

let twilioClient: ReturnType<typeof twilio> | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    logDev("[ok] Twilio initialized");
  } catch (err) {
    logDev(`[warn] Twilio init failed: ${err}`, "warn");
  }
} else {
  logDev("[warn] Twilio not configured — SMS will be logged only", "warn");
}
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

function getStripePublishableKey(): string {
  return (
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

function isStripeConfigured(): boolean {
  if (isTestMode()) {
    const override = getTestStripeClientOverride();
    if (override !== undefined) {
      return override !== null;
    }
  }
  return !!(
    process.env.STRIPE_SECRET_KEY?.trim() && getStripePublishableKey()
  );
}

let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe | null {
  if (isTestMode()) {
    const override = getTestStripeClientOverride();
    if (override !== undefined) {
      return override;
    }
  }
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || !getStripePublishableKey()) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(secret);
  }
  return stripeClient;
}

const STRIPE_CHECKOUT_BUSINESS_NAME =
  process.env.STRIPE_CHECKOUT_BUSINESS_NAME?.trim() || "Triboo Sport";

function serializeAthleteRow(row: RowDataPacket): RowDataPacket {
  return {
    ...row,
    date_of_birth: normalizeApiDateOnly(row.date_of_birth),
  };
}

function buildRegistrationPaymentIntentParams(opts: {
  amount: number;
  currency: string;
  metadata: Stripe.MetadataParam;
  eventTitle?: string;
  customerId?: string | null;
}): Stripe.PaymentIntentCreateParams {
  const params: Stripe.PaymentIntentCreateParams = {
    amount: opts.amount,
    currency: opts.currency.toLowerCase(),
    metadata: opts.metadata,
    automatic_payment_methods: { enabled: true },
    setup_future_usage: "off_session",
    description: opts.eventTitle
      ? `${opts.eventTitle} — ${STRIPE_CHECKOUT_BUSINESS_NAME}`
      : STRIPE_CHECKOUT_BUSINESS_NAME,
    statement_descriptor_suffix: "TRIBOO SPORT",
  };
  if (opts.customerId) {
    params.customer = opts.customerId;
  }
  return params;
}

if (isStripeConfigured()) {
  logDev("[ok] Stripe configured (direct payments)");
} else {
  logDev(
    "[warn] STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY (or VITE_STRIPE_PUBLISHABLE_KEY) not set — payments disabled",
    "warn",
  );
}

/** Stripe Connect (MX) for destination charges when organizer payout is ready. */

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
    const bypass = getTestAuthBypass();
    if (isTestMode() && bypass && bypass.actor === actor) {
      req.auth = bypass;
      return next();
    }
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

function optionalAuth(actor: ActorType) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifySessionToken(token);
    if (!payload || payload.actor !== actor) return next();
    const ok = await isSessionActive(payload);
    if (ok) req.auth = payload;
    next();
  };
}

const optionalAthleteAuth = optionalAuth("athlete");

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
  if (isTestMode()) {
    pushCapturedTestEmail(opts);
    return { id: "test-email" };
  }
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

function normalizeLookupEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function deliverOtpEmail(opts: {
  to: string;
  locale: AppLocale;
  firstName: string;
  code: string;
  logTag: string;
}): Promise<void> {
  const otpMail = buildOtpEmail({
    locale: opts.locale,
    firstName: opts.firstName || "Staff",
    code: opts.code,
    appUrl: APP_URL,
  });
  try {
    await sendEmail({
      to: opts.to,
      subject: otpMail.subject,
      html: otpMail.html,
      text: otpMail.text,
    });
  } catch (err) {
    console.error(`[email:${opts.logTag}]`, opts.to, err);
    throw err;
  }
}

type StaffAccount =
  | {
      role: "admin";
      actorId: number;
      email: string;
      firstName: string;
      preferredLanguage: string;
    }
  | {
      role: "organizer";
      actorId: number;
      email: string;
      firstName: string;
      preferredLanguage: string;
      organizerId: number;
    };

async function resolveStaffByEmail(
  email: string,
): Promise<StaffAccount | null> {
  const normalized = normalizeLookupEmail(email);
  const [admins] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, first_name, preferred_language FROM admins
     WHERE LOWER(TRIM(email)) = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [normalized],
  );
  if (admins.length > 0) {
    return {
      role: "admin",
      actorId: admins[0].id as number,
      email: admins[0].email as string,
      firstName: admins[0].first_name as string,
      preferredLanguage: admins[0].preferred_language as string,
    };
  }
  const [members] = await pool.query<RowDataPacket[]>(
    `SELECT om.id, om.email, om.first_name, om.preferred_language, om.organizer_id
     FROM organizer_members om
     WHERE LOWER(TRIM(om.email)) = ? AND om.status = 'active' LIMIT 1`,
    [normalized],
  );
  if (members.length > 0) {
    return {
      role: "organizer",
      actorId: members[0].id as number,
      email: members[0].email as string,
      firstName: members[0].first_name as string,
      preferredLanguage: members[0].preferred_language as string,
      organizerId: members[0].organizer_id as number,
    };
  }
  return null;
}

// ============================================================================
// PAYMENT HELPERS (direct Stripe payments; Connect disabled for now)
// ============================================================================

type DiscountCodeRow = {
  id: number;
  code: string;
  discount_type: "percent" | "fixed_cents";
  discount_value: number;
  applies_to: "registration" | "service_fee" | "total";
  min_purchase_cents: number | null;
  max_uses: number | null;
  used_count: number;
};

function computeDiscountAmountCents(
  baseCents: number,
  discountType: "percent" | "fixed_cents",
  discountValue: number,
): number {
  if (baseCents <= 0) return 0;
  if (discountType === "percent") {
    return Math.min(baseCents, Math.round(baseCents * (discountValue / 100)));
  }
  return Math.min(baseCents, Math.round(discountValue));
}

function applyDiscountToCheckout(
  priceCents: number,
  serviceFeeCents: number,
  discount: DiscountCodeRow,
): {
  priceCents: number;
  serviceFeeCents: number;
  totalCents: number;
  discountAmountCents: number;
} {
  let discountAmountCents = 0;
  let adjustedPrice = priceCents;
  let adjustedFee = serviceFeeCents;

  if (discount.applies_to === "registration") {
    const base = priceCents;
    if (
      discount.min_purchase_cents != null &&
      base < Number(discount.min_purchase_cents)
    ) {
      throw new Error("Minimum purchase not met for this discount");
    }
    discountAmountCents = computeDiscountAmountCents(
      base,
      discount.discount_type,
      Number(discount.discount_value),
    );
    adjustedPrice = Math.max(0, priceCents - discountAmountCents);
  } else if (discount.applies_to === "service_fee") {
    const base = serviceFeeCents;
    if (
      discount.min_purchase_cents != null &&
      base < Number(discount.min_purchase_cents)
    ) {
      throw new Error("Minimum purchase not met for this discount");
    }
    discountAmountCents = computeDiscountAmountCents(
      base,
      discount.discount_type,
      Number(discount.discount_value),
    );
    adjustedFee = Math.max(0, serviceFeeCents - discountAmountCents);
  } else {
    const base = priceCents + serviceFeeCents;
    if (
      discount.min_purchase_cents != null &&
      base < Number(discount.min_purchase_cents)
    ) {
      throw new Error("Minimum purchase not met for this discount");
    }
    discountAmountCents = computeDiscountAmountCents(
      base,
      discount.discount_type,
      Number(discount.discount_value),
    );
    const fromReg = Math.min(priceCents, discountAmountCents);
    adjustedPrice = priceCents - fromReg;
    const remainder = discountAmountCents - fromReg;
    adjustedFee = Math.max(0, serviceFeeCents - remainder);
  }

  return {
    priceCents: adjustedPrice,
    serviceFeeCents: adjustedFee,
    totalCents: adjustedPrice + adjustedFee,
    discountAmountCents,
  };
}

async function fetchValidDiscountCode(
  code: string,
  eventId: number,
  organizerId: number,
): Promise<{ discount: DiscountCodeRow } | { error: string }> {
  const normalized = String(code ?? "").trim();
  if (!normalized) {
    return { error: "Discount code required" };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, code, discount_type, discount_value, applies_to,
            min_purchase_cents, max_uses,
            ${DISCOUNT_USED_COUNT_SQL} AS used_count
     FROM discount_codes
     WHERE UPPER(code) = UPPER(?)
       AND is_active = 1
       AND (event_id = ? OR (event_id IS NULL AND organizer_id = ?))
       AND (valid_from IS NULL OR valid_from <= NOW())
       AND (valid_until IS NULL OR valid_until >= NOW())
     LIMIT 1`,
    [normalized, eventId, organizerId],
  );

  if (rows.length === 0) {
    return { error: "Invalid or expired discount code" };
  }

  const discount = rows[0] as DiscountCodeRow;
  if (
    discount.max_uses != null &&
    Number(discount.used_count) >= Number(discount.max_uses)
  ) {
    return { error: "Discount code has reached its usage limit" };
  }

  return { discount };
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

async function processPaymentRefund(opts: {
  paymentId: number;
  requestedByType: "admin" | "organizer_member";
  requestedById: number;
  organizerId?: number;
  reason?: string;
}): Promise<void> {
  const [[pay]] = await pool.query<RowDataPacket[]>(
    `SELECT id, registration_id, organizer_id, amount_cents, currency, status, provider,
            stripe_payment_intent_id, stripe_transfer_id, metadata_json
     FROM payments WHERE id = ? LIMIT 1`,
    [opts.paymentId],
  );
  if (!pay) {
    throw new Error("Payment not found");
  }
  if (
    opts.requestedByType === "organizer_member" &&
    Number(pay.organizer_id) !== Number(opts.organizerId)
  ) {
    throw new Error("Payment not found");
  }
  if (pay.status === "refunded") {
    throw new Error("Payment already refunded");
  }
  if (pay.status !== "succeeded") {
    throw new Error("Only succeeded payments can be refunded");
  }

  const amountCents = Number(pay.amount_cents);
  let stripeRefundId: string | null = null;

  if (pay.stripe_payment_intent_id && getStripeClient()) {
    const refundParams = buildStripeRefundParams(String(pay.stripe_payment_intent_id), {
      stripe_payment_intent_id: pay.stripe_payment_intent_id as string,
      stripe_transfer_id: pay.stripe_transfer_id as string | null,
      metadata_json: pay.metadata_json,
    });
    const refund = await getStripeClient()!.refunds.create(refundParams);
    stripeRefundId = refund.id;
  } else if (pay.provider !== "mock") {
    throw new Error("Stripe refund unavailable for this payment");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query<ResultSetHeader>(
      `INSERT INTO payment_refunds (
         payment_id, amount_cents, currency, reason, status, provider, stripe_refund_id,
         requested_by_type, requested_by_id, processed_at
       ) VALUES (?,?,?,?,'succeeded',?,?, ?, ?, NOW())`,
      [
        opts.paymentId,
        amountCents,
        pay.currency || "MXN",
        opts.reason ?? null,
        pay.stripe_payment_intent_id ? "stripe" : "mock",
        stripeRefundId,
        opts.requestedByType === "admin" ? "admin" : "organizer_member",
        opts.requestedById,
      ],
    );

    await conn.query<ResultSetHeader>(
      "UPDATE payments SET status = 'refunded' WHERE id = ?",
      [opts.paymentId],
    );

    if (pay.registration_id) {
      const [[reg]] = await conn.query<RowDataPacket[]>(
        `SELECT id, status, event_category_id, schedule_wave_id
         FROM registrations WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [pay.registration_id],
      );
      if (reg) {
        if (reg.status === "confirmed") {
          await conn.query<ResultSetHeader>(
            "UPDATE event_categories SET sold_count = GREATEST(0, sold_count - 1) WHERE id = ?",
            [reg.event_category_id],
          );
          if (reg.schedule_wave_id) {
            await conn.query<ResultSetHeader>(
              `UPDATE event_schedule_waves
               SET registered_count = GREATEST(0, registered_count - 1)
               WHERE id = ?`,
              [reg.schedule_wave_id],
            );
          }
        }
        await conn.query<ResultSetHeader>(
          "UPDATE registrations SET status = 'refunded' WHERE id = ?",
          [reg.id],
        );
        await conn.query<ResultSetHeader>(
          `INSERT INTO registration_status_history (
             registration_id, from_status, to_status, actor_type, actor_id, reason
           ) VALUES (?,?,?,?,?,?)`,
          [
            reg.id,
            reg.status,
            "refunded",
            opts.requestedByType === "admin" ? "admin" : "organizer_member",
            opts.requestedById,
            opts.reason ??
              (opts.requestedByType === "admin"
                ? "Payment refunded by admin"
                : "Payment refunded by organizer"),
          ],
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

async function ensureStripeCustomer(athleteId: number): Promise<string | null> {
  if (!getStripeClient()) return null;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, public_uuid, email, first_name, last_name, stripe_customer_id
     FROM athletes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [athleteId],
  );
  if (rows.length === 0) return null;
  const athlete = rows[0];

  const existing = athlete.stripe_customer_id as string | null;
  if (existing) return existing;

  const email =
    (athlete.email as string | null) ||
    `athlete+${athlete.public_uuid}@payments.athlete-hub.app`;
  const name = `${athlete.first_name} ${athlete.last_name}`.trim();

  const customer = await getStripeClient()!.customers.create({
    email,
    name: name || undefined,
    metadata: {
      athlete_id: String(athleteId),
      public_uuid: String(athlete.public_uuid),
    },
  });

  await pool.query<ResultSetHeader>(
    `UPDATE athletes SET stripe_customer_id = ? WHERE id = ?`,
    [customer.id, athleteId],
  );

  return customer.id;
}

async function getStripeDefaultPaymentMethodId(
  customerId: string,
): Promise<string | null> {
  if (!getStripeClient()) return null;
  const customer = await getStripeClient()!.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) return null;
  const activeCustomer = customer as Stripe.Customer;
  const defaultPm = activeCustomer.invoice_settings?.default_payment_method;
  return typeof defaultPm === "string" ? defaultPm : defaultPm?.id ?? null;
}

async function listAthleteStripePaymentMethods(customerId: string) {
  if (!getStripeClient()) {
    return { paymentMethods: [], defaultPaymentMethodId: null };
  }

  const defaultPaymentMethodId =
    await getStripeDefaultPaymentMethodId(customerId);
  const listed = await getStripeClient()!.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  const paymentMethods = listed.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "????",
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
    isDefault: pm.id === defaultPaymentMethodId,
  }));

  return { paymentMethods, defaultPaymentMethodId };
}

async function setAthleteDefaultPaymentMethod(
  athleteId: number,
  customerId: string,
  paymentMethodId: string,
): Promise<void> {
  if (!getStripeClient()) {
    throw new Error("Stripe not configured");
  }

  const pm = await getStripeClient()!.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== customerId) {
    throw new Error("Payment method does not belong to this athlete");
  }

  await getStripeClient()!.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}

async function detachAthletePaymentMethod(
  customerId: string,
  paymentMethodId: string,
): Promise<void> {
  if (!getStripeClient()) {
    throw new Error("Stripe not configured");
  }

  const pm = await getStripeClient()!.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== customerId) {
    throw new Error("Payment method does not belong to this athlete");
  }

  await getStripeClient()!.paymentMethods.detach(paymentMethodId);

  const defaultId = await getStripeDefaultPaymentMethodId(customerId);
  if (defaultId === paymentMethodId || !defaultId) {
    const listed = await getStripeClient()!.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
    const next = listed.data[0]?.id;
    await getStripeClient()!.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: next ?? "",
      },
    });
  }
}

async function ensureDefaultPaymentMethodAfterPay(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  if (!getStripeClient() || !pi.customer) return;

  const customerId =
    typeof pi.customer === "string" ? pi.customer : pi.customer.id;
  const existingDefault = await getStripeDefaultPaymentMethodId(customerId);
  if (existingDefault) return;

  const pmId =
    typeof pi.payment_method === "string"
      ? pi.payment_method
      : pi.payment_method?.id;
  if (!pmId) return;

  await getStripeClient()!.customers.update(customerId, {
    invoice_settings: { default_payment_method: pmId },
  });
}

type CheckoutResumePayload = {
  paymentPublicUuid: string;
  clientSecret: string | null;
  amountCents: number;
  registrationAmountCents: number;
  serviceFeeCents: number;
  currency: string;
  categoryName: string;
  eventTitle: string;
  fieldValues?: Record<string, string | boolean>;
  discountCode?: string;
  discountAmountCents?: number;
};

type DbExecutor = Pool | PoolConnection;

type RegistrationWindowRow = {
  registration_opens_at?: Date | string | null;
  registration_closes_at?: Date | string | null;
};

function getRegistrationWindowError(
  event: RegistrationWindowRow,
  category: RegistrationWindowRow,
): { error: string; code: string } | null {
  const now = Date.now();
  const openTimes: number[] = [];
  const closeTimes: number[] = [];

  for (const row of [event, category]) {
    if (row.registration_opens_at) {
      openTimes.push(new Date(row.registration_opens_at as string).getTime());
    }
    if (row.registration_closes_at) {
      closeTimes.push(new Date(row.registration_closes_at as string).getTime());
    }
  }

  const effectiveOpen = openTimes.length ? Math.max(...openTimes) : null;
  const effectiveClose = closeTimes.length ? Math.min(...closeTimes) : null;

  if (effectiveOpen != null && now < effectiveOpen) {
    return { error: "Registration has not opened yet", code: "registration_not_open" };
  }
  if (effectiveClose != null && now > effectiveClose) {
    return { error: "Registration has closed", code: "registration_closed" };
  }
  return null;
}

async function expireStaleWaitlistOffers(db: DbExecutor) {
  await db.query<ResultSetHeader>(
    `UPDATE waitlist_entries SET status = 'expired'
     WHERE status = 'offered' AND offer_expires_at IS NOT NULL AND offer_expires_at < NOW()`,
  );
}

async function getValidWaitlistOffer(
  db: DbExecutor,
  athleteId: number,
  eventId: number,
  categoryId: number,
  waitlistEntryId: number,
): Promise<RowDataPacket | null> {
  await expireStaleWaitlistOffers(db);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM waitlist_entries
     WHERE id = ? AND athlete_id = ? AND event_id = ? AND event_category_id = ?
       AND status = 'offered'
       AND (offer_expires_at IS NULL OR offer_expires_at > NOW())
     LIMIT 1`,
    [waitlistEntryId, athleteId, eventId, categoryId],
  );
  return rows[0] ?? null;
}

function parseElevationProfile(raw: unknown): Array<{ km: number; elevation_m: number }> {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        km: Number((p as { km?: number }).km),
        elevation_m: Number((p as { elevation_m?: number }).elevation_m),
      }))
      .filter((p) => Number.isFinite(p.km) && Number.isFinite(p.elevation_m));
  } catch {
    return [];
  }
}

async function cancelStalePendingEventPayments(
  athleteId: number,
  eventId: number,
  keepIdempotencyKey: string,
): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, stripe_payment_intent_id, provider, status
     FROM payments
     WHERE athlete_id = ? AND event_id = ? AND registration_id IS NULL
       AND status IN ('pending', 'processing')
       AND idempotency_key <> ?`,
    [athleteId, eventId, keepIdempotencyKey],
  );

  for (const row of rows) {
    const piId = row.stripe_payment_intent_id as string | null;
    if (piId && getStripeClient() && row.provider === "stripe") {
      try {
        const pi = await getStripeClient()!.paymentIntents.retrieve(piId);
        if (pi.status !== "succeeded" && pi.status !== "canceled") {
          await getStripeClient()!.paymentIntents.cancel(piId);
        }
      } catch {
        /* ignore cancel failures */
      }
    }
    await pool.query<ResultSetHeader>(
      `UPDATE payments SET status = 'failed', failure_code = 'superseded',
       failure_message = 'Replaced by a newer checkout attempt'
       WHERE id = ?`,
      [row.id],
    );
  }
}

async function buildCheckoutResponseForPayment(
  paymentPublicUuid: string,
  athleteId: number,
): Promise<CheckoutResumePayload | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.public_uuid, p.amount_cents, p.registration_amount_cents,
            p.service_fee_cents, p.currency, p.metadata_json, p.stripe_payment_intent_id,
            p.provider, p.status, p.registration_id, p.event_id, p.organizer_id,
            e.title AS event_title, e.slug AS event_slug
     FROM payments p
     JOIN events e ON e.id = p.event_id
     WHERE p.public_uuid = ? AND p.athlete_id = ? LIMIT 1`,
    [paymentPublicUuid, athleteId],
  );
  if (rows.length === 0) return null;
  const pay = rows[0];
  if (pay.provider === "mock") return null;
  if (pay.registration_id) return null;
  if (!["pending", "processing"].includes(pay.status as string)) return null;
  if (!getStripeClient()) return null;

  const meta = parseCheckoutPaymentMetadata(
    typeof pay.metadata_json === "string"
      ? JSON.parse(pay.metadata_json as string)
      : pay.metadata_json,
  );
  if (!meta) return null;

  let clientSecret: string | null = null;
  let piId = pay.stripe_payment_intent_id as string | null;

  if (piId) {
    const pi = await getStripeClient()!.paymentIntents.retrieve(piId);
    if (
      pi.status !== "canceled" &&
      pi.client_secret &&
      ["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(
        pi.status,
      )
    ) {
      clientSecret = pi.client_secret;
    } else {
      piId = null;
    }
  }

  if (!clientSecret) {
    const stripeCustomerId = await ensureStripeCustomer(athleteId);
    let piParams = buildRegistrationPaymentIntentParams({
      amount: Number(pay.amount_cents),
      currency: (pay.currency as string) || "mxn",
      metadata: {
        payment_public_uuid: paymentPublicUuid,
        event_slug: pay.event_slug as string,
        athlete_id: String(athleteId),
        category_id: String(meta.categoryId),
        event_id: String(pay.event_id),
        organizer_id: String(pay.organizer_id ?? ""),
      },
      eventTitle: pay.event_title as string | undefined,
      customerId: stripeCustomerId,
    });
    const connectMode = await resolveCheckoutConnectMode(
      pool,
      Number(pay.organizer_id),
      getStripeClient(),
    );
    if (connectMode.mode === "blocked") {
      return null;
    }
    if (connectMode.mode === "destination") {
      piParams = applyConnectToPaymentIntent(piParams, {
        destinationAccountId: connectMode.stripeAccountId,
        applicationFeeCents: Number(pay.service_fee_cents ?? 0),
      });
    }
    const pi = await getStripeClient()!.paymentIntents.create(piParams, {
      idempotencyKey: `pi_${paymentPublicUuid}`,
    });
    clientSecret = pi.client_secret;
    await pool.query<ResultSetHeader>(
      `UPDATE payments SET stripe_payment_intent_id = ?, status = 'processing' WHERE id = ?`,
      [pi.id, pay.id],
    );
  }

  return {
    paymentPublicUuid,
    clientSecret,
    amountCents: Number(pay.amount_cents),
    registrationAmountCents: Number(pay.registration_amount_cents),
    serviceFeeCents: Number(pay.service_fee_cents),
    currency: (pay.currency as string) || "MXN",
    categoryName: meta.categoryName,
    eventTitle: pay.event_title as string,
    fieldValues: meta.fieldValues,
    ...(meta.discountCode
      ? { discountCode: meta.discountCode, discountAmountCents: meta.discountAmountCents }
      : {}),
  };
}

function buildServerPaceSegments(
  splits: RowDataPacket[],
  totalDistanceKm: number,
): Array<{ kmStart: number; kmEnd: number; pacePerKmMs: number; intensity: number }> {
  if (splits.length === 0 || totalDistanceKm <= 0) return [];
  const sorted = [...splits].sort(
    (a, b) => Number(a.split_order) - Number(b.split_order),
  );
  const segments: Array<{
    kmStart: number;
    kmEnd: number;
    pacePerKmMs: number;
    intensity: number;
  }> = [];
  let prevKm = 0;
  let prevMs = 0;
  for (const split of sorted) {
    const km = Number(split.distance_km ?? totalDistanceKm);
    const segmentKm = Math.max(0.01, km - prevKm);
    const segmentMs = Math.max(1, Number(split.elapsed_ms) - prevMs);
    segments.push({
      kmStart: prevKm,
      kmEnd: km,
      pacePerKmMs: Math.round(segmentMs / segmentKm),
      intensity: 0,
    });
    prevKm = km;
    prevMs = Number(split.elapsed_ms);
  }
  const paces = segments.map((s) => s.pacePerKmMs);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const span = Math.max(1, maxPace - minPace);
  return segments.map((s) => ({
    ...s,
    intensity: Math.round(((maxPace - s.pacePerKmMs) / span) * 100),
  }));
}

async function refundOrphanSucceededPayment(
  pay: RowDataPacket,
  pi: Stripe.PaymentIntent,
  reason: string,
): Promise<void> {
  if (pi.status !== "succeeded") return;
  const paymentId = pay.id as number;
  const amountCents = Number(pay.amount_cents);
  if (amountCents <= 0 || pay.provider === "mock") {
    await pool.query<ResultSetHeader>(
      `UPDATE payments SET status = 'failed', failure_code = 'orphan_void',
       failure_message = ?
       WHERE id = ? AND registration_id IS NULL`,
      [reason, paymentId],
    );
    return;
  }
  const piId = (pay.stripe_payment_intent_id as string | null) || pi.id;
  try {
    if (piId && getStripeClient()) {
      await getStripeClient()!.refunds.create({ payment_intent: piId });
      await pool.query<ResultSetHeader>(
        "UPDATE payments SET status = 'refunded' WHERE id = ? AND registration_id IS NULL",
        [paymentId],
      );
      console.error("[registration] auto-refunded orphan payment", {
        paymentId,
        reason,
      });
    }
  } catch (err) {
    console.error("[registration] orphan payment refund failed:", err, { paymentId, reason });
  }
}

async function deliverRegistrationConfirmedEmail(
  registrationId: number,
  opts?: { force?: boolean },
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.registration_number, r.status,
            a.id AS athlete_id, a.email AS athlete_email, a.first_name AS athlete_first_name,
            a.preferred_language,
            e.title AS event_title,
            ec.name AS category_name
     FROM registrations r
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     JOIN events e ON e.id = r.event_id
     JOIN event_categories ec ON ec.id = r.event_category_id
     WHERE r.id = ? AND r.deleted_at IS NULL
     LIMIT 1`,
    [registrationId],
  );

  if (rows.length === 0 || rows[0].status !== "confirmed") {
    return { sent: false, error: "Registration not found or not confirmed" };
  }

  const reg = rows[0];
  const athleteEmail = String(reg.athlete_email ?? "").trim();
  if (!athleteEmail) {
    console.error("[email:registration-confirmed] missing athlete email", {
      registrationId,
    });
    return { sent: false, error: "Athlete email missing" };
  }

  if (!opts?.force) {
    const [alreadySent] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM notification_queue
       WHERE channel = 'email' AND status IN ('sent', 'pending')
         AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.type')) = 'registration_confirmed'
         AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.registration_id')) = ?
       LIMIT 1`,
      [String(registrationId)],
    );
    if (alreadySent.length > 0) {
      return { sent: false, skipped: true };
    }
  }

  const locale = resolveLocale(reg.preferred_language as string | undefined);
  const mail = buildRegistrationConfirmedEmail({
    locale,
    firstName: String(reg.athlete_first_name || "Atleta"),
    eventTitle: String(reg.event_title),
    categoryName: String(reg.category_name),
    registrationNumber: String(reg.registration_number),
    appUrl: APP_URL,
  });

  let queueId: number | null = null;
  try {
    const [ins] = await pool.query<ResultSetHeader>(
      `INSERT INTO notification_queue (
         recipient_type, recipient_id, channel, to_address, subject, body, status, payload_json
       ) VALUES ('athlete', ?, 'email', ?, ?, ?, 'pending', ?)`,
      [
        reg.athlete_id,
        athleteEmail,
        mail.subject,
        mail.text ?? mail.subject,
        JSON.stringify({
          type: "registration_confirmed",
          registration_id: registrationId,
          registration_number: reg.registration_number,
        }),
      ],
    );
    queueId = ins.insertId;

    await sendEmail({
      to: athleteEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    await pool.query<ResultSetHeader>(
      `UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE id = ?`,
      [queueId],
    );

    console.log("[email:registration-confirmed] sent", {
      registrationId,
      to: athleteEmail,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email:registration-confirmed] failed", {
      registrationId,
      to: athleteEmail,
      error: message,
    });
    if (queueId != null) {
      await pool.query<ResultSetHeader>(
        `UPDATE notification_queue SET status = 'failed', error_message = ? WHERE id = ?`,
        [message.slice(0, 2000), queueId],
      );
    }
    return { sent: false, error: message };
  }
}

async function resolveConnectPaymentIds(
  pi: Stripe.PaymentIntent,
): Promise<{ transferId: string | null; applicationFeeId: string | null }> {
  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id ?? null;
  if (!chargeId) {
    return { transferId: null, applicationFeeId: null };
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return { transferId: null, applicationFeeId: null };
  }

  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const transferId =
      typeof charge.transfer === "string" ? charge.transfer : null;
    const applicationFeeId =
      typeof charge.application_fee === "string"
        ? charge.application_fee
        : null;
    return { transferId, applicationFeeId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe:connect] charge lookup failed:", message);
    return { transferId: null, applicationFeeId: null };
  }
}

async function finalizeRegistrationAfterPayment(
  paymentPublicUuid: string,
  pi: Stripe.PaymentIntent,
): Promise<{ success: boolean; registration?: RowDataPacket; error?: string }> {
  if (pi.status !== "succeeded") {
    return {
      success: false,
      error: pi.last_payment_error?.message || `Payment status: ${pi.status}`,
    };
  }

  const metadataPaymentUuid = pi.metadata?.payment_public_uuid;
  if (metadataPaymentUuid && metadataPaymentUuid !== paymentPublicUuid) {
    return { success: false, error: "Payment does not match checkout" };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [payRows] = await conn.query<RowDataPacket[]>(
      `SELECT p.*, e.slug AS event_slug, e.title AS event_title,
              e.registration_opens_at, e.registration_closes_at,
              a.email AS athlete_email, a.first_name AS athlete_first_name,
              a.preferred_language AS athlete_preferred_language
       FROM payments p
       JOIN events e ON e.id = p.event_id
       JOIN athletes a ON a.id = p.athlete_id
       WHERE p.public_uuid = ?
       LIMIT 1
       FOR UPDATE`,
      [paymentPublicUuid],
    );

    if (payRows.length === 0) {
      await conn.rollback();
      return { success: false, error: "Checkout not found" };
    }

    const pay = payRows[0];

    const failFinalize = async (error: string) => {
      await conn.rollback();
      if (pi.status === "succeeded" && !pay.registration_id) {
        await refundOrphanSucceededPayment(pay, pi, error);
      }
      return { success: false as const, error };
    };

    if (pay.registration_id) {
      const existingRegistrationId = Number(pay.registration_id);
      const [existing] = await conn.query<RowDataPacket[]>(
        `SELECT r.public_uuid, r.registration_number, r.qr_code_token, r.status, r.total_cents,
                ec.name AS category_name, e.title AS event_title, e.slug AS event_slug
         FROM registrations r
         JOIN event_categories ec ON ec.id = r.event_category_id
         JOIN events e ON e.id = r.event_id
         WHERE r.id = ? AND r.deleted_at IS NULL`,
        [existingRegistrationId],
      );
      await conn.commit();
      if (existing.length > 0) {
        await deliverRegistrationConfirmedEmail(existingRegistrationId);
        return { success: true, registration: existing[0] };
      }
    }

    if (Number(pi.amount) !== Number(pay.amount_cents)) {
      return failFinalize("Payment amount mismatch");
    }

    const storedPiId = pay.stripe_payment_intent_id as string | null;
    if (storedPiId && storedPiId !== pi.id) {
      return failFinalize("Payment intent mismatch");
    }

    const meta = parseCheckoutPaymentMetadata(
      typeof pay.metadata_json === "string"
        ? JSON.parse(pay.metadata_json as string)
        : pay.metadata_json,
    );
    if (!meta) {
      return failFinalize("Invalid checkout data");
    }

    const athleteId = pay.athlete_id as number;
    const eventId = pay.event_id as number;

    const [[eventWaiverRow]] = await conn.query<RowDataPacket[]>(
      "SELECT requires_waiver FROM events WHERE id = ? LIMIT 1",
      [eventId],
    );

    const waiverSignatures =
      meta.waiverSignatures ??
      (meta.waiverId && meta.waiverSignature
        ? [{ waiverId: meta.waiverId, signature: meta.waiverSignature }]
        : []);

    if (Boolean(eventWaiverRow?.requires_waiver)) {
      if (waiverSignatures.length === 0) {
        return failFinalize("Waiver acceptance required");
      }
      const waiverValidation = await validateWaiverSignaturesForEvent(
        conn as unknown as Pool,
        eventId,
        waiverSignatures,
      );
      if ("error" in waiverValidation) {
        return failFinalize(waiverValidation.error);
      }
    }

    const [dupReg] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM registrations
       WHERE event_id = ? AND athlete_id = ? AND status = 'confirmed' AND deleted_at IS NULL
       LIMIT 1`,
      [eventId, athleteId],
    );
    if (dupReg.length > 0) {
      return failFinalize("Already registered for this event");
    }

    const [catRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, name, capacity, currency,
              registration_opens_at, registration_closes_at,
              ${CATEGORY_SOLD_COUNT_UNALIASED_SQL} AS sold_count
       FROM event_categories
       WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1
       FOR UPDATE`,
      [meta.categoryId, eventId],
    );
    if (catRows.length === 0) {
      return failFinalize("Category not found");
    }
    const category = catRows[0];

    const windowErr = getRegistrationWindowError(
      {
        registration_opens_at: pay.registration_opens_at as string | null,
        registration_closes_at: pay.registration_closes_at as string | null,
      },
      {
        registration_opens_at: category.registration_opens_at as string | null,
        registration_closes_at: category.registration_closes_at as string | null,
      },
    );
    if (windowErr) {
      return failFinalize(windowErr.error);
    }

    const waitlistEntryId = meta.waitlistEntryId;
    let isWaitlistClaim = false;

    if (waitlistEntryId) {
      await expireStaleWaitlistOffers(conn);
      const [wlRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM waitlist_entries
         WHERE id = ? AND athlete_id = ? AND event_id = ? AND event_category_id = ?
           AND status = 'offered'
           AND (offer_expires_at IS NULL OR offer_expires_at > NOW())
         LIMIT 1 FOR UPDATE`,
        [waitlistEntryId, athleteId, eventId, meta.categoryId],
      );
      if (wlRows.length === 0) {
        return failFinalize("Waitlist offer is no longer valid");
      }
      isWaitlistClaim = true;
    } else if (
      category.capacity != null &&
      Number(category.sold_count) >= Number(category.capacity)
    ) {
      return failFinalize("Category is sold out");
    }

    const regUuid = newPublicUuid();
    const regNumber = await nextRegistrationNumber(eventId);
    const qrToken = newQrToken();
    const priceCents = Number(pay.registration_amount_cents);
    const serviceFeeCents = Number(pay.service_fee_cents);
    const totalCents = Number(pay.amount_cents);

    const [regResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO registrations (
        public_uuid, event_id, event_category_id, athlete_id, registration_number,
        qr_code_token, status, price_cents, service_fee_cents, total_cents,
        discount_code_id, currency, source, payment_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        regUuid,
        eventId,
        category.id,
        athleteId,
        regNumber,
        qrToken,
        "confirmed",
        priceCents,
        serviceFeeCents,
        totalCents,
        meta.discountCodeId ?? null,
        pay.currency || category.currency || "MXN",
        "web",
        pay.id,
      ],
    );
    const registrationId = regResult.insertId;

    if (meta.discountCodeId) {
      const [discUp] = await conn.query<ResultSetHeader>(
        `UPDATE discount_codes SET used_count = used_count + 1
         WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)`,
        [meta.discountCodeId],
      );
      if (discUp.affectedRows === 0) {
        return failFinalize("Discount code is no longer available");
      }
    }

    const [fieldRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, field_key, field_type FROM event_registration_fields
       WHERE event_id = ? AND is_active = 1`,
      [eventId],
    );
    for (const field of fieldRows) {
      const key = field.field_key as string;
      const raw = meta.fieldValues[key];
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

    if (waiverSignatures.length > 0) {
      await insertRegistrationWaiverSignatures(
        conn,
        registrationId,
        waiverSignatures,
        {
          clientIp: meta.clientIp,
          userAgent: meta.userAgent,
          deviceInfo: meta.deviceInfo,
        },
      );
    }

    const connectIds = await resolveConnectPaymentIds(pi);

    await conn.query<ResultSetHeader>(
      `UPDATE payments SET status = 'succeeded', paid_at = NOW(), registration_id = ?,
       stripe_charge_id = ?, stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?),
       stripe_transfer_id = COALESCE(?, stripe_transfer_id),
       stripe_application_fee_id = COALESCE(?, stripe_application_fee_id)
       WHERE id = ?`,
      [
        registrationId,
        typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        pi.id,
        connectIds.transferId,
        connectIds.applicationFeeId,
        pay.id,
      ],
    );
    const [soldInc] = await conn.query<ResultSetHeader>(
      isWaitlistClaim
        ? `UPDATE event_categories SET sold_count = sold_count + 1 WHERE id = ?`
        : `UPDATE event_categories SET sold_count = sold_count + 1
           WHERE id = ? AND (capacity IS NULL OR sold_count < capacity)`,
      [category.id],
    );
    if (soldInc.affectedRows === 0) {
      return failFinalize("Category is sold out");
    }

    if (isWaitlistClaim && waitlistEntryId) {
      const [wlUp] = await conn.query<ResultSetHeader>(
        `UPDATE waitlist_entries
         SET status = 'converted', converted_registration_id = ?
         WHERE id = ? AND athlete_id = ? AND status = 'offered'`,
        [registrationId, waitlistEntryId, athleteId],
      );
      if (wlUp.affectedRows === 0) {
        return failFinalize("Waitlist offer expired");
      }
    }

    await conn.query<ResultSetHeader>(
      `UPDATE events SET registration_count = registration_count + 1 WHERE id = ?`,
      [eventId],
    );

    await conn.commit();

    await deliverRegistrationConfirmedEmail(registrationId);

    const [updated] = await pool.query<RowDataPacket[]>(
      `SELECT r.public_uuid, r.registration_number, r.qr_code_token, r.status, r.total_cents,
              ec.name AS category_name, e.title AS event_title, e.slug AS event_slug
       FROM registrations r
       JOIN event_categories ec ON ec.id = r.event_category_id
       JOIN events e ON e.id = r.event_id
       WHERE r.id = ?`,
      [registrationId],
    );
    return { success: true, registration: updated[0] };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function confirmRegistrationPayment(
  paymentPublicUuid: string,
  athleteId: number,
  paymentIntentId?: string,
  paymentMethodId?: string,
): Promise<{
  success: boolean;
  registration?: RowDataPacket;
  error?: string;
  requiresAction?: boolean;
  clientSecret?: string;
}> {
  const [payRows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.registration_id, p.stripe_payment_intent_id, p.provider, p.status, p.amount_cents
     FROM payments p
     WHERE p.public_uuid = ? AND p.athlete_id = ? LIMIT 1`,
    [paymentPublicUuid, athleteId],
  );
  if (payRows.length === 0) {
    return { success: false, error: "Checkout not found" };
  }
  const pay = payRows[0];

  if (pay.registration_id) {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT r.public_uuid, r.registration_number, r.qr_code_token, r.status, r.total_cents,
              ec.name AS category_name, e.title AS event_title, e.slug AS event_slug
       FROM registrations r
       JOIN event_categories ec ON ec.id = r.event_category_id
       JOIN events e ON e.id = r.event_id
       WHERE r.id = ? AND r.deleted_at IS NULL`,
      [pay.registration_id],
    );
    if (existing.length > 0) {
      return { success: true, registration: existing[0] };
    }
  }

  if (pay.provider === "mock") {
    if (Number(pay.amount_cents) === 0) {
      const zeroPi = {
        status: "succeeded",
        amount: 0,
        id: `zero_${paymentPublicUuid}`,
        metadata: { payment_public_uuid: paymentPublicUuid },
      } as unknown as Stripe.PaymentIntent;
      return finalizeRegistrationAfterPayment(paymentPublicUuid, zeroPi);
    }
    return {
      success: false,
      error: "This checkout session is outdated. Please start again.",
    };
  }

  if (!isStripeConfigured() || !getStripeClient()) {
    return { success: false, error: "Payment service unavailable" };
  }

  const piId = paymentIntentId || (pay.stripe_payment_intent_id as string);
  if (!piId) {
    return { success: false, error: "Payment not initialized" };
  }

  let pi = await getStripeClient()!.paymentIntents.retrieve(piId);

  if (pi.status !== "succeeded" && paymentMethodId) {
    await getStripeClient()!.paymentIntents.update(piId, {
      payment_method: paymentMethodId,
    });
    pi = await getStripeClient()!.paymentIntents.confirm(piId);
  }

  if (pi.status === "requires_action") {
    return {
      success: false,
      error: "Additional authentication required",
      requiresAction: true,
      clientSecret: pi.client_secret ?? undefined,
    };
  }

  if (pi.status !== "succeeded") {
    return {
      success: false,
      error: pi.last_payment_error?.message || `Payment status: ${pi.status}`,
    };
  }

  await ensureDefaultPaymentMethodAfterPay(pi);

  return finalizeRegistrationAfterPayment(paymentPublicUuid, pi);
}

// ============================================================================
// EXPRESS APP
// ============================================================================

function buildApp() {
  const app = express();
  app.use(cors());

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook,
  );

  app.use(cdnAwareJsonBodyParser);
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
  registerStaffPortalRoutes(app, {
    pool,
    requireAdmin,
    requireOrganizer,
    newPublicUuid,
    newQrToken,
    nextRegistrationNumber,
    normalizeLocale,
    sendEmail,
    appUrl: APP_URL,
    getStripeClient,
    processPaymentRefund,
    buildWelcomeStaffEmail: (params) =>
      buildWelcomeStaffEmail({
        locale: params.locale as AppLocale,
        firstName: params.firstName,
        audience: params.audience,
        appUrl: params.appUrl,
      }),
    buildEventSubmittedForApprovalEmail: (params) =>
      buildEventSubmittedForApprovalEmail({
        locale: params.locale as AppLocale,
        firstName: params.firstName,
        eventTitle: params.eventTitle,
        appUrl: params.appUrl,
      }),
    buildEventApprovedEmail: (params) =>
      buildEventApprovedEmail({
        locale: params.locale as AppLocale,
        firstName: params.firstName,
        eventTitle: params.eventTitle,
        appUrl: params.appUrl,
        eventId: params.eventId,
      }),
    buildEventRejectedEmail: (params) =>
      buildEventRejectedEmail({
        locale: params.locale as AppLocale,
        firstName: params.firstName,
        eventTitle: params.eventTitle,
        reason: params.reason,
        appUrl: params.appUrl,
        eventId: params.eventId,
      }),
    sendStaffLoginOtp: async ({ adminId, to, firstName, preferredLanguage }) => {
      const code = await createOtp("admin", adminId, "login");
      await deliverOtpEmail({
        to,
        locale: normalizeLocale(
          preferredLanguage != null ? String(preferredLanguage) : undefined,
        ),
        firstName,
        code,
        logTag: "admin-invite-otp",
      });
    },
  });
  registerPhase2Routes(app, {
    pool,
    requireAthlete,
    requireOrganizer,
    requireAdmin,
    newPublicUuid,
    sendEmail,
    appUrl: APP_URL,
  });
  registerPublicTeamRoutes(app, pool, TEAM_MEMBER_COUNT_SQL);
  registerBlogRoutes(app, {
    pool,
    requireAdmin,
    requireOrganizer,
    newPublicUuid,
  });

  // ── Global JSON error handler (must be last use()) ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message =
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : (err?.message ?? String(err));
    console.error(`[Express error handler] ${status}:`, err?.message ?? err);
    if (err instanceof Error && err.stack) {
      console.error("[Express error handler] stack:", err.stack);
    }
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

  app.get("/api/config/auth", (_req, res) => {
    res.json(getClerkConfigDiagnostics());
  });

  app.get("/api/config/payments", (_req, res) => {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: "Stripe is not configured" });
    }
    res.json({
      publishableKey: getStripePublishableKey(),
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
      const dbVersion =
        (rows[0]?.setting_value as string | undefined)?.trim() || null;
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

function respondAthleteAuthRateLimited(
  req: Request,
  res: Response,
  scope: AthleteAuthRateLimitScope,
): boolean {
  const check = checkAthleteAuthRateLimit(req, scope);
  if (check.ok === false) {
    res.setHeader("Retry-After", String(check.retryAfterSec));
    res.status(429).json({
      error: "Too many attempts. Please try again later.",
      code: "rate_limited",
      retryAfterSec: check.retryAfterSec,
    });
    return true;
  }
  return false;
}

function registerAuthRoutes(app: express.Express) {
  app.post("/api/auth/athlete/check-email", async (req, res) => {
    if (respondAthleteAuthRateLimited(req, res, "check-email")) return;
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, password_hash, google_id, apple_id, facebook_id, clerk_user_id
       FROM athletes WHERE email = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return res.json({ exists: false, hasPassword: false, hasSocialLogin: false });
    }
    const row = rows[0];
    res.json({
      exists: true,
      hasPassword: Boolean(row.password_hash),
      hasSocialLogin: Boolean(
        row.google_id || row.apple_id || row.facebook_id || row.clerk_user_id,
      ),
    });
  });

  app.post("/api/auth/athlete/register", async (req, res) => {
    if (respondAthleteAuthRateLimited(req, res, "register")) return;
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const firstName = String(req.body?.firstName ?? req.body?.first_name ?? "")
      .trim();
    const lastName = String(req.body?.lastName ?? req.body?.last_name ?? "")
      .trim();
    const password = String(req.body?.password || "");
    const dateOfBirth = String(
      req.body?.dateOfBirth ?? req.body?.date_of_birth ?? "",
    ).trim();
    const genderRaw = req.body?.gender;
    const gender =
      genderRaw === null || genderRaw === undefined || genderRaw === ""
        ? null
        : String(genderRaw);

    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First and last name required" });
    }
    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return res.status(400).json({ error: "date_of_birth required (YYYY-MM-DD)" });
    }
    if (
      gender &&
      !["male", "female", "other", "prefer_not_to_say"].includes(gender)
    ) {
      return res.status(400).json({ error: "invalid gender" });
    }
    const policy = validateAthletePassword(password);
    if (!policy.valid) {
      return res.status(400).json({ error: "Password does not meet security requirements" });
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, password_hash, google_id, apple_id, clerk_user_id, status, deleted_at
       FROM athletes WHERE email = ? LIMIT 1`,
      [email],
    );
    if (existing.length > 0) {
      const row = existing[0];
      const isActiveAccount =
        row.status === "active" && row.deleted_at == null;

      if (isActiveAccount) {
        if (
          !row.password_hash &&
          (row.google_id || row.apple_id || row.facebook_id || row.clerk_user_id)
        ) {
          return res.status(409).json({
            error:
              "This email is linked to social sign-in. Use Google, Facebook, or your linked provider, or reset your password to add one.",
            code: "social_account_exists",
          });
        }
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const locale = resolveRequestLocale(req, undefined, req.body?.locale);
      const passwordHash = await hashAthletePassword(password);
      await pool.query<ResultSetHeader>(
        `UPDATE athletes SET
           status = 'active',
           deleted_at = NULL,
           first_name = ?,
           last_name = ?,
           password_hash = ?,
           password_set_at = NOW(),
           date_of_birth = ?,
           gender = ?,
           preferred_language = ?,
           email_verified_at = COALESCE(email_verified_at, NOW())
         WHERE id = ?`,
        [
          firstName,
          lastName,
          passwordHash,
          dateOfBirth,
          gender,
          locale,
          row.id,
        ],
      );

      const [reactivated] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, date_of_birth, gender, avatar_url,
                preferred_language, last_login_at
         FROM athletes WHERE id = ? LIMIT 1`,
        [row.id],
      );
      const session = await issueAthleteSession(reactivated[0], req, {
        welcomeIfFirst: true,
        locale,
      });
      return res.json({ ...session, reactivated: true });
    }

    const locale = resolveRequestLocale(req, undefined, req.body?.locale);
    const passwordHash = await hashAthletePassword(password);
    const [ins] = await pool.query<ResultSetHeader>(
      `INSERT INTO athletes (
         public_uuid, email, email_verified_at, password_hash, password_set_at,
         first_name, last_name, date_of_birth, gender, preferred_language
       ) VALUES (?, ?, NOW(), ?, NOW(), ?, ?, ?, ?, ?)`,
      [
        newPublicUuid(),
        email,
        passwordHash,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        locale,
      ],
    );

    const [created] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, date_of_birth, gender, avatar_url,
              preferred_language, last_login_at
       FROM athletes WHERE id = ? LIMIT 1`,
      [ins.insertId],
    );
    const session = await issueAthleteSession(created[0], req, {
      welcomeIfFirst: true,
      locale,
    });
    res.json(session);
  });

  app.post("/api/auth/athlete/login", async (req, res) => {
    if (respondAthleteAuthRateLimited(req, res, "login")) return;
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, date_of_birth, gender, avatar_url,
              preferred_language, last_login_at, password_hash, status
       FROM athletes WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (rows.length === 0 || rows[0].status !== "active") {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const athlete = rows[0];
    if (!athlete.password_hash) {
      const locale = resolveRequestLocale(
        req,
        athlete.preferred_language as string | undefined,
        req.body?.locale,
      );
      try {
        await queueAthletePasswordReset(athlete, req, locale);
      } catch (err) {
        console.error("[auth] password reset queue failed:", err);
      }
      return res.status(403).json({
        error: "Password not set for this account. We sent you an email to create one.",
        code: "password_not_set",
      });
    }

    const valid = await verifyAthletePassword(password, athlete.password_hash as string);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const session = await issueAthleteSession(athlete, req, { welcomeIfFirst: true });
    res.json(session);
  });

  app.post("/api/auth/athlete/forgot-password", async (req, res) => {
    if (respondAthleteAuthRateLimited(req, res, "forgot-password")) return;
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }

    const locale = resolveRequestLocale(req, undefined, req.body?.locale);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, preferred_language
       FROM athletes WHERE email = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (rows.length > 0) {
      try {
        await queueAthletePasswordReset(rows[0], req, locale);
      } catch (err) {
        console.error("[auth] forgot-password email failed:", err);
      }
    }

    res.json({
      ok: true,
      message: "If an account exists for that email, we sent password reset instructions.",
    });
  });

  app.post("/api/auth/athlete/reset-password", async (req, res) => {
    if (respondAthleteAuthRateLimited(req, res, "reset-password")) return;
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.code ?? req.body?.token ?? "").trim();
    const password = String(req.body?.password || "");
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Valid 6-digit reset code required" });
    }
    const policy = validateAthletePassword(password);
    if (!policy.valid) {
      return res.status(400).json({ error: "Password does not meet security requirements" });
    }

    const tokenHash = sha256(code);
    const [resetRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.athlete_id
       FROM athlete_password_resets r
       INNER JOIN athletes a ON a.id = r.athlete_id
       WHERE a.email = ? AND r.token_hash = ? AND r.consumed_at IS NULL AND r.expires_at > NOW()
       ORDER BY r.id DESC LIMIT 1`,
      [email, tokenHash],
    );
    if (resetRows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    const reset = resetRows[0];
    const passwordHash = await hashAthletePassword(password);
    await pool.query<ResultSetHeader>(
      `UPDATE athletes SET password_hash = ?, password_set_at = NOW(), email_verified_at = COALESCE(email_verified_at, NOW())
       WHERE id = ?`,
      [passwordHash, reset.athlete_id],
    );
    await pool.query<ResultSetHeader>(
      `UPDATE athlete_password_resets SET consumed_at = NOW() WHERE id = ?`,
      [reset.id],
    );

    const [athleteRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, avatar_url, preferred_language, last_login_at
       FROM athletes WHERE id = ? LIMIT 1`,
      [reset.athlete_id],
    );
    if (athleteRows.length === 0) {
      return res.json({ ok: true });
    }

    const session = await issueAthleteSession(athleteRows[0], req);
    res.json({ ok: true, ...session });
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
    const email = normalizeLookupEmail(String(req.body?.email || ""));
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const account = await resolveStaffByEmail(email);
    if (!account) {
      return res
        .status(404)
        .json({ error: "No staff account found for that email." });
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
    try {
      await deliverOtpEmail({
        to: account.email,
        locale,
        firstName: account.firstName,
        code,
        logTag: "otp-staff",
      });
    } catch {
      return res.status(502).json({
        error: "Could not send verification email. Please try again.",
      });
    }
    res.json({
      ok: true,
      role: account.role,
      message: "Verification code sent.",
    });
  });

  app.post("/api/auth/staff/verify-otp", async (req, res) => {
    const email = normalizeLookupEmail(String(req.body?.email || ""));
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
         FROM admins
         WHERE LOWER(TRIM(email)) = ? AND status = 'active' AND deleted_at IS NULL
         LIMIT 1`,
        [normalizeLookupEmail(email)],
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
       FROM organizer_members om
       WHERE LOWER(TRIM(om.email)) = ? AND om.status = 'active'
       LIMIT 1`,
      [normalizeLookupEmail(email)],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    const member = rows[0];
    const ok = await consumeOtp(
      "organizer",
      member.id as number,
      code,
      "login",
    );
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
    const email = normalizeLookupEmail(String(req.body?.email || ""));
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, preferred_language FROM admins
       WHERE LOWER(TRIM(email)) = ? AND status = 'active' AND deleted_at IS NULL
       LIMIT 1`,
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
    const code = await createOtp(
      "admin",
      rows[0].id as number,
      "login",
      req.ip,
    );
    try {
      await deliverOtpEmail({
        to: rows[0].email as string,
        locale,
        firstName: rows[0].first_name as string,
        code,
        logTag: "otp-admin",
      });
    } catch {
      return res.status(502).json({
        error: "Could not send verification email. Please try again.",
      });
    }
    res.json({ ok: true, message: "Verification code sent." });
  });

  app.post("/api/auth/admin/verify-otp", async (req, res) => {
    const email = normalizeLookupEmail(String(req.body?.email || ""));
    const code = String(req.body?.code || "").trim();
    if (!email || !code) {
      return res.status(400).json({ error: "Email and code required" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, role, preferred_language, last_login_at
       FROM admins
       WHERE LOWER(TRIM(email)) = ? AND status = 'active' AND deleted_at IS NULL
       LIMIT 1`,
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

  app.get(
    "/api/auth/admin/me",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, role, phone, avatar_url, preferred_language,
                last_login_at, created_at
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
          phone: admin.phone ?? null,
          avatarUrl: admin.avatar_url ?? null,
          preferredLanguage: admin.preferred_language,
          lastLoginAt: admin.last_login_at ?? null,
          createdAt: admin.created_at,
        },
      });
    },
  );

  app.patch(
    "/api/auth/admin/me",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const parsed = parseStaffProfileUpdate(
        (req.body ?? {}) as Record<string, unknown>,
      );
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const params = [...parsed.params, req.auth!.id];
      await pool.query<ResultSetHeader>(
        `UPDATE admins SET ${parsed.updates.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, role, phone, avatar_url, preferred_language,
                last_login_at, created_at
         FROM admins WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
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
          phone: admin.phone ?? null,
          avatarUrl: admin.avatar_url ?? null,
          preferredLanguage: admin.preferred_language,
          lastLoginAt: admin.last_login_at ?? null,
          createdAt: admin.created_at,
        },
      });
    },
  );

  app.post(
    "/api/auth/admin/avatar",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const parsed = parseAvatarDataUrl(req.body?.image);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      await pool.query<ResultSetHeader>(
        "UPDATE admins SET avatar_url = ? WHERE id = ? AND deleted_at IS NULL",
        [parsed.dataUrl, req.auth!.id],
      );
      res.json({ ok: true, avatarUrl: parsed.dataUrl });
    },
  );

  app.delete(
    "/api/auth/admin/avatar",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      await pool.query<ResultSetHeader>(
        "UPDATE admins SET avatar_url = NULL WHERE id = ? AND deleted_at IS NULL",
        [req.auth!.id],
      );
      res.json({ ok: true, avatarUrl: null });
    },
  );

  app.get(
    "/api/auth/organizer/me",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT om.id, om.email, om.first_name, om.last_name, om.role, om.organizer_id,
                om.phone, om.avatar_url, om.preferred_language, om.last_login_at, om.created_at,
                o.name AS organizer_name
         FROM organizer_members om
         JOIN organizers o ON o.id = om.organizer_id
         WHERE om.id = ? AND om.status = 'active' AND om.deleted_at IS NULL LIMIT 1`,
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
          organizerName: member.organizer_name,
          phone: member.phone ?? null,
          avatarUrl: member.avatar_url ?? null,
          preferredLanguage: member.preferred_language,
          lastLoginAt: member.last_login_at ?? null,
          createdAt: member.created_at,
        },
      });
    },
  );

  app.patch(
    "/api/auth/organizer/me",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const parsed = parseStaffProfileUpdate(
        (req.body ?? {}) as Record<string, unknown>,
      );
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const params = [...parsed.params, req.auth!.id];
      await pool.query<ResultSetHeader>(
        `UPDATE organizer_members SET ${parsed.updates.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT om.id, om.email, om.first_name, om.last_name, om.role, om.organizer_id,
                om.phone, om.avatar_url, om.preferred_language, om.last_login_at, om.created_at,
                o.name AS organizer_name
         FROM organizer_members om
         JOIN organizers o ON o.id = om.organizer_id
         WHERE om.id = ? AND om.deleted_at IS NULL LIMIT 1`,
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
          organizerName: member.organizer_name,
          phone: member.phone ?? null,
          avatarUrl: member.avatar_url ?? null,
          preferredLanguage: member.preferred_language,
          lastLoginAt: member.last_login_at ?? null,
          createdAt: member.created_at,
        },
      });
    },
  );

  app.post(
    "/api/auth/organizer/avatar",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const parsed = parseAvatarDataUrl(req.body?.image);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      await pool.query<ResultSetHeader>(
        "UPDATE organizer_members SET avatar_url = ? WHERE id = ? AND deleted_at IS NULL",
        [parsed.dataUrl, req.auth!.id],
      );
      res.json({ ok: true, avatarUrl: parsed.dataUrl });
    },
  );

  app.delete(
    "/api/auth/organizer/avatar",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      await pool.query<ResultSetHeader>(
        "UPDATE organizer_members SET avatar_url = NULL WHERE id = ? AND deleted_at IS NULL",
        [req.auth!.id],
      );
      res.json({ ok: true, avatarUrl: null });
    },
  );

  app.post("/api/auth/clerk/athlete", async (req, res) => {
    const sessionToken = String(req.body?.sessionToken || "").trim();
    if (!sessionToken) {
      return res.status(400).json({ error: "sessionToken required" });
    }
    if (!CLERK_SECRET_KEY && !(isTestMode() && getTestClerkProfileResolver())) {
      return res.status(503).json({ error: "Clerk is not configured" });
    }

    const resolved = await resolveClerkAthleteProfile(sessionToken);
    if ("error" in resolved) {
      return res.status(401).json({ error: resolved.error });
    }

    const locale = resolveRequestLocale(req, undefined, req.body?.locale);
    try {
      const { athlete, isNew } = await findOrCreateAthleteFromClerk(
        resolved.profile,
        locale,
      );
      const session = await issueAthleteSession(athlete, req, {
        welcomeIfFirst: isNew,
        locale,
      });
      res.json({ ...session, isNew });
    } catch (err) {
      console.error("[clerk] athlete sync failed:", err);
      const message =
        err instanceof Error && err.message.includes("Duplicate")
          ? "This social account is already linked to another profile."
          : "Could not link social account. Try email sign-in or contact support.";
      res.status(409).json({ error: message });
    }
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

function asyncHandler(
  fn: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void | Response>,
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function registerMarketplaceRoutes(app: express.Express) {
  app.get("/api/sport-types", async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, slug, name, icon FROM sport_types WHERE is_active = 1 ORDER BY sort_order ASC`,
    );
    res.json({ sportTypes: rows });
  });

  const withNormalizedEventMedia = <T extends RowDataPacket>(row: T): T => ({
    ...row,
    hero_image_url: normalizeEventMediaUrl(row.hero_image_url as string | null),
    banner_image_url: normalizeEventMediaUrl(row.banner_image_url as string | null),
  });

  const publishedEventSelect = `
      SELECT e.id, e.public_uuid, e.slug, e.title, e.short_description, e.start_date, e.end_date,
             e.location_city, e.location_state, e.location_country, e.location_lat, e.location_lng,
             e.featured, e.hero_image_url, ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count,
             e.registration_closes_at,
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
      WHERE e.status = 'published' AND e.visibility = 'public' AND e.deleted_at IS NULL`;

  app.get(
    "/api/public/home",
    asyncHandler(async (_req, res) => {
      const emptyStats = {
        published_events: 0,
        active_athletes: 0,
        confirmed_registrations: 0,
        public_teams: 0,
        achievements_earned: 0,
      };

      const loadStats = async () => {
        const [[statsRow]] = await pool.query<RowDataPacket[]>(
          `SELECT
             (SELECT COUNT(*) FROM events WHERE status = 'published' AND deleted_at IS NULL) AS published_events,
             (SELECT COUNT(*) FROM athletes WHERE status = 'active' AND deleted_at IS NULL) AS active_athletes,
             (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed' AND deleted_at IS NULL) AS confirmed_registrations,
             (SELECT COUNT(*) FROM athlete_teams WHERE is_public = 1) AS public_teams,
             (SELECT COUNT(*) FROM athlete_achievements) AS achievements_earned`,
        );
        return {
          published_events: Number(statsRow?.published_events ?? 0),
          active_athletes: Number(statsRow?.active_athletes ?? 0),
          confirmed_registrations: Number(
            statsRow?.confirmed_registrations ?? 0,
          ),
          public_teams: Number(statsRow?.public_teams ?? 0),
          achievements_earned: Number(statsRow?.achievements_earned ?? 0),
        };
      };

      const [statsResult, eventsResult, athletesResult, teamsResult] =
        await Promise.allSettled([
          loadStats(),
          pool.query<RowDataPacket[]>(
            `${publishedEventSelect} ORDER BY e.start_date ASC LIMIT 50`,
          ),
          pool.query<RowDataPacket[]>(
            `SELECT a.first_name, a.last_name, g.xp_total, g.level
             FROM athlete_gamification g
             JOIN athletes a ON a.id = g.athlete_id AND a.status = 'active' AND a.deleted_at IS NULL
             ORDER BY g.xp_total DESC, g.level DESC, a.id ASC
             LIMIT 5`,
          ),
          pool.query<RowDataPacket[]>(
            `SELECT t.id, t.name, t.slug, t.avatar_url,
                    ${TEAM_MEMBER_COUNT_SQL} AS live_member_count
             FROM athlete_teams t
             WHERE t.is_public = 1
             ORDER BY live_member_count DESC, t.created_at DESC
             LIMIT 4`,
          ),
        ]);

      const logSectionFailure = (
        section: string,
        result: PromiseSettledResult<unknown>,
      ) => {
        if (result.status === "rejected") {
          console.error(`[GET /api/public/home] ${section}`, result.reason);
        }
      };

      logSectionFailure("stats", statsResult);
      logSectionFailure("events", eventsResult);
      logSectionFailure("top_athletes", athletesResult);
      logSectionFailure("top_teams", teamsResult);

      const stats =
        statsResult.status === "fulfilled" ? statsResult.value : emptyStats;
      const publishedEvents =
        eventsResult.status === "fulfilled" ? eventsResult.value[0] : [];
      const normalizedEvents = publishedEvents.map(withNormalizedEventMedia);
      const athleteRows =
        athletesResult.status === "fulfilled" ? athletesResult.value[0] : [];
      const teamRows =
        teamsResult.status === "fulfilled" ? teamsResult.value[0] : [];

      res.json({
        stats,
        featured_events: [],
        upcoming_events: normalizedEvents,
        events: normalizedEvents,
        top_athletes: athleteRows.map((row, idx) => ({
          rank: idx + 1,
          first_name: row.first_name,
          last_name: row.last_name,
          xp_total: Number(row.xp_total ?? 0),
          level: Number(row.level ?? 1),
        })),
        top_teams: teamRows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          member_count: Number(row.live_member_count ?? row.member_count ?? 0),
          avatar_url: row.avatar_url ?? null,
        })),
      });
    }),
  );

  app.get("/api/geo/states", async (req, res) => {
    const country = String(req.query.country ?? "MX").toUpperCase().slice(0, 2);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, country, name, code
       FROM geo_states
       WHERE country = ? AND is_active = 1
       ORDER BY sort_order ASC, name ASC`,
      [country],
    );
    res.json({ states: rows });
  });

  app.get("/api/geo/cities", async (req, res) => {
    const country = String(req.query.country ?? "MX").toUpperCase().slice(0, 2);
    const stateId = req.query.state_id ? Number(req.query.state_id) : null;
    const q = req.query.q ? String(req.query.q).trim() : null;

    let sql = `
      SELECT gc.id, gc.state_id, gc.name, gc.lat, gc.lng,
             gs.name AS state_name, gs.code AS state_code
      FROM geo_cities gc
      JOIN geo_states gs ON gs.id = gc.state_id
      WHERE gs.country = ? AND gc.is_active = 1 AND gs.is_active = 1
    `;
    const params: unknown[] = [country];

    if (stateId != null && Number.isFinite(stateId)) {
      sql += " AND gc.state_id = ?";
      params.push(stateId);
    }
    if (q && q.length >= 1) {
      sql += " AND gc.name LIKE ?";
      params.push(`%${q}%`);
    }

    sql += " ORDER BY gc.name ASC LIMIT 100";

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ cities: rows });
  });

  app.get("/api/events", async (req, res) => {
    const sport = req.query.sport ? String(req.query.sport) : null;
    const city = req.query.city ? String(req.query.city) : null;
    const geoCityId = req.query.geoCityId ? Number(req.query.geoCityId) : null;
    const qRaw = req.query.q ? String(req.query.q).trim() : null;
    const q = qRaw && qRaw.length >= 2 ? qRaw : null;
    const featured =
      req.query.featured === "1" || req.query.featured === "true" ? true : null;
    const { dateFrom, dateTo } = parseEventDateRange(
      req.query.dateFrom ? String(req.query.dateFrom) : null,
      req.query.dateTo ? String(req.query.dateTo) : null,
    );
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const sort = req.query.sort ? String(req.query.sort) : "date_asc";
    const limit = Math.min(Number(req.query.limit) || 24, 100);
    const offset = Number(req.query.offset) || 0;

    const geoCityIdProvided =
      geoCityId != null && Number.isFinite(geoCityId) && geoCityId > 0;
    const resolvedGeoCity = geoCityIdProvided
      ? await resolveGeoCityById(pool, geoCityId)
      : null;

    if (geoCityIdProvided && !resolvedGeoCity) {
      res.json({ events: [], total: 0, limit, offset });
      return;
    }

    const listFilters: MarketplaceListFilters = {
      sport,
      city,
      resolvedGeoCity,
      featured,
      dateFrom,
      dateTo,
      minPrice,
      maxPrice,
    };

    if (q) {
      const fuzzyResult = await listMarketplaceEventsWithFuzzySearch(pool, {
        registrationCountSql: EVENT_REGISTRATION_COUNT_SQL,
        filters: listFilters,
        q,
        sort,
        limit,
        offset,
      });
      res.json({
        events: fuzzyResult.events.map(withNormalizedEventMedia),
        total: fuzzyResult.total,
        limit,
        offset,
      });
      return;
    }

    let sql = `
      SELECT e.id, e.public_uuid, e.slug, e.title, e.short_description, e.start_date, e.end_date,
             e.location_city, e.location_state, e.location_country, e.location_lat, e.location_lng,
             e.featured, e.hero_image_url, ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count, e.registration_closes_at,
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
    sql = appendMarketplaceListFilters(sql, params, listFilters);

    const orderMap: Record<string, string> = {
      date_asc: "e.featured DESC, e.start_date ASC",
      date_desc: "e.start_date DESC",
      price_asc: "ec_min.from_price_cents IS NULL, ec_min.from_price_cents ASC",
      price_desc: "ec_min.from_price_cents DESC",
      popular: `${EVENT_REGISTRATION_COUNT_SQL} DESC, e.start_date ASC`,
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
    countSql = appendMarketplaceListFilters(countSql, countParams, listFilters);

    const [countRows] = await pool.query<RowDataPacket[]>(
      countSql,
      countParams,
    );

    res.json({
      events: rows.map(withNormalizedEventMedia),
      total: Number(countRows[0]?.total ?? rows.length),
      limit,
      offset,
    });
  });

  app.get("/api/events/filters/cities", async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT gc.id, gc.name AS city, gs.name AS state, gc.lat, gc.lng, COUNT(e.id) AS event_count
       FROM geo_cities gc
       JOIN geo_states gs ON gs.id = gc.state_id AND gs.country = 'MX' AND gs.is_active = 1
       LEFT JOIN events e ON e.location_city = gc.name
         AND (e.location_state = gs.name OR e.location_state = gs.code)
         AND e.status = 'published' AND e.visibility = 'public' AND e.deleted_at IS NULL
       WHERE gc.is_active = 1
       GROUP BY gc.id, gc.name, gs.name
       HAVING event_count > 0
       ORDER BY event_count DESC, gc.name ASC
       LIMIT 100`,
    );
    res.json({ cities: rows });
  });

  app.get(
    "/api/search/suggest",
    asyncHandler(async (req, res) => {
      const q = String(req.query.q ?? "").trim();
      if (q.length < 2) {
        res.json({
          query: q,
          events: [],
          cities: [],
          sports: [],
        });
        return;
      }

      const tokens = searchTokens(q);
      const likePatterns = likePatternsForTokens(tokens);
      const published = `e.status = 'published' AND e.visibility = 'public' AND e.deleted_at IS NULL`;

      const eventSelect = `SELECT e.slug, e.title, e.start_date, e.location_city, e.location_state,
                  e.hero_image_url, e.featured, st.name AS sport_name, st.slug AS sport_slug,
                  e.short_description, e.search_keywords, e.location_name`;

      const eventOrClauses = likePatterns.flatMap(() => [
        `e.title LIKE ?`,
        `e.short_description LIKE ?`,
        `e.search_keywords LIKE ?`,
        `e.location_city LIKE ?`,
        `e.location_name LIKE ?`,
        `st.name LIKE ?`,
        `st.slug LIKE ?`,
      ]);
      const eventParams = likePatterns.flatMap((pattern) =>
        Array(7).fill(pattern),
      );

      const cityOrClauses = likePatterns.flatMap(() => [
        `e.location_city LIKE ?`,
        `e.location_state LIKE ?`,
      ]);
      const cityParams = likePatterns.flatMap((pattern) => [pattern, pattern]);

      const sportOrClauses = likePatterns.flatMap(() => [
        `name LIKE ?`,
        `slug LIKE ?`,
      ]);
      const sportParams = likePatterns.flatMap((pattern) => [pattern, pattern]);

      const hasTokenFilter = likePatterns.length > 0;
      const emptyRows: RowDataPacket[] = [];

      const [eventsResult, eventsBroadResult, citiesResult, sportsResult, sportsBroadResult] =
        await Promise.allSettled([
        hasTokenFilter
          ? pool.query<RowDataPacket[]>(
              `${eventSelect}
           FROM events e
           JOIN sport_types st ON st.id = e.sport_type_id
           WHERE ${published}
             AND (${eventOrClauses.join(" OR ")})
           ORDER BY e.featured DESC, e.start_date ASC
           LIMIT 40`,
              eventParams,
            )
          : Promise.resolve([emptyRows, []] as [RowDataPacket[], unknown[]]),
        pool.query<RowDataPacket[]>(
          `${eventSelect}
           FROM events e
           JOIN sport_types st ON st.id = e.sport_type_id
           WHERE ${published}
           ORDER BY e.featured DESC, e.start_date ASC
           LIMIT 50`,
        ),
        hasTokenFilter
          ? pool.query<RowDataPacket[]>(
              `SELECT MIN(gc.id) AS id, e.location_city AS city, e.location_state AS state,
                  COUNT(*) AS event_count
           FROM events e
           LEFT JOIN geo_cities gc ON gc.name = e.location_city AND gc.is_active = 1
           LEFT JOIN geo_states gs ON gs.id = gc.state_id
             AND (e.location_state = gs.name OR e.location_state = gs.code)
           WHERE ${published}
             AND e.location_city IS NOT NULL AND e.location_city != ''
             AND (${cityOrClauses.join(" OR ")})
           GROUP BY e.location_city, e.location_state
           ORDER BY event_count DESC, e.location_city ASC
           LIMIT 20`,
              cityParams,
            )
          : Promise.resolve([emptyRows, []] as [RowDataPacket[], unknown[]]),
        hasTokenFilter
          ? pool.query<RowDataPacket[]>(
              `SELECT slug, name, icon
           FROM sport_types
           WHERE is_active = 1 AND (${sportOrClauses.join(" OR ")})
           ORDER BY sort_order ASC
           LIMIT 16`,
              sportParams,
            )
          : Promise.resolve([emptyRows, []] as [RowDataPacket[], unknown[]]),
        pool.query<RowDataPacket[]>(
          `SELECT slug, name, icon
           FROM sport_types
           WHERE is_active = 1
           ORDER BY sort_order ASC
           LIMIT 20`,
        ),
      ]);

      const rawEventsMatched: RowDataPacket[] =
        eventsResult.status === "fulfilled" ? eventsResult.value[0] : emptyRows;
      const rawEventsBroad: RowDataPacket[] =
        eventsBroadResult.status === "fulfilled" ? eventsBroadResult.value[0] : emptyRows;
      const rawCities: RowDataPacket[] =
        citiesResult.status === "fulfilled" ? citiesResult.value[0] : emptyRows;
      const rawSportsMatched: RowDataPacket[] =
        sportsResult.status === "fulfilled" ? sportsResult.value[0] : emptyRows;
      const rawSportsBroad: RowDataPacket[] =
        sportsBroadResult.status === "fulfilled" ? sportsBroadResult.value[0] : emptyRows;

      if (eventsResult.status === "rejected") {
        console.error("[GET /api/search/suggest] events", eventsResult.reason);
      }
      if (eventsBroadResult.status === "rejected") {
        console.error("[GET /api/search/suggest] events-broad", eventsBroadResult.reason);
      }
      if (citiesResult.status === "rejected") {
        console.error("[GET /api/search/suggest] cities", citiesResult.reason);
      }
      if (sportsResult.status === "rejected") {
        console.error("[GET /api/search/suggest] sports", sportsResult.reason);
      }

      const stripEventExtras = (row: RowDataPacket) => {
        const {
          short_description: _sd,
          search_keywords: _sk,
          location_name: _ln,
          featured: _f,
          ...rest
        } = row;
        return rest;
      };

      const seenEventSlugs = new Set<string>();
      const eventPool = [...rawEventsMatched, ...rawEventsBroad].filter((row) => {
        if (seenEventSlugs.has(row.slug as string)) return false;
        seenEventSlugs.add(row.slug as string);
        return true;
      });

      const events = rankByFuzzy(
        eventPool,
        q,
        (row) => [
          row.title as string,
          row.sport_name as string,
          row.sport_slug as string,
          row.location_city as string,
          row.location_state as string,
          row.location_name as string,
          row.short_description as string,
          row.search_keywords as string,
        ],
        6,
      ).map(stripEventExtras);

      const seenCities = new Set<string>();
      const cities = rankByFuzzy(
        rawCities.filter((row) => {
          const key = `${row.city}|${row.state ?? ""}`;
          if (seenCities.has(key)) return false;
          seenCities.add(key);
          return true;
        }),
        q,
        (row) => [row.city as string, row.state as string],
        5,
      );

      const seenSports = new Set<string>();
      const sportPool = [...rawSportsMatched, ...rawSportsBroad].filter((row) => {
        if (seenSports.has(row.slug as string)) return false;
        seenSports.add(row.slug as string);
        return true;
      });
      const sports = rankByFuzzy(
        sportPool,
        q,
        (row) => [row.name as string, row.slug as string],
        4,
      );

      const eventsOut =
        events.length > 0
          ? events
          : rankByFuzzy(eventPool, q, (row) => [row.title as string], 6).map(stripEventExtras);
      const citiesOut = cities.length > 0 ? cities : rawCities.slice(0, 5);
      const sportsOut =
        sports.length > 0
          ? sports
          : rankByFuzzy(sportPool, q, (row) => [row.name as string], 4);

      res.json({ query: q, events: eventsOut, cities: citiesOut, sports: sportsOut });
    }),
  );

  app.post(
    "/api/events/:slug/sponsors/track",
    async (req, res) => {
      const slug = String(req.params.slug);
      const sponsorId = Number(req.body?.sponsorId);
      const type = String(req.body?.type ?? "").trim();
      if (!Number.isFinite(sponsorId) || !["impression", "click"].includes(type)) {
        return res.status(400).json({ error: "sponsorId and type (impression|click) required" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM events WHERE slug = ? AND status = 'published' AND deleted_at IS NULL LIMIT 1`,
        [slug],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
      const eventId = eventRows[0].id as number;

      const [sponsorRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM event_sponsors WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1`,
        [sponsorId, eventId],
      );
      if (sponsorRows.length === 0) {
        return res.status(404).json({ error: "Sponsor not found" });
      }

      await pool.query<ResultSetHeader>(
        `INSERT INTO sponsor_analytics_events (event_sponsor_id, event_id, event_type)
         VALUES (?,?,?)`,
        [sponsorId, eventId, type],
      );
      res.json({ ok: true });
    },
  );

  app.get("/api/events/:slug", optionalAthleteAuth, async (req: AuthedRequest, res) => {
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
    event.registration_count = Number(
      (
        await pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM registrations
           WHERE event_id = ? AND status = 'confirmed' AND deleted_at IS NULL`,
          [event.id],
        )
      )[0][0]?.cnt ?? 0,
    );

    const [categories] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_uuid, name, description, distance_km, difficulty, capacity,
              ${CATEGORY_SOLD_COUNT_UNALIASED_SQL} AS sold_count,
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
      `SELECT id, name, starts_at, capacity,
              ${WAVE_REGISTERED_COUNT_SQL} AS registered_count, sort_order
       FROM event_schedule_waves WHERE event_id = ? ORDER BY sort_order ASC`,
      [event.id],
    );

    const feePercent =
      (event.service_fee_percent as number) ??
      (await pool
        .query<
          RowDataPacket[]
        >("SELECT service_fee_percent FROM organizers WHERE id = ? LIMIT 1", [event.organizer_id])
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
      `SELECT route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json
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
        elevationProfile: parseElevationProfile(courseRow.elevation_profile_json),
      };
    }

    const [media] = await pool.query<RowDataPacket[]>(
      `SELECT asset_type, url, alt_text, mime_type, sort_order, is_primary
       FROM media_assets
       WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC`,
      [event.id],
    );

    let myRegistration: Record<string, unknown> | null = null;
    if (req.auth?.id) {
      const [myRegRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.public_uuid, r.status, r.registration_number, r.event_category_id,
                ec.name AS category_name
         FROM registrations r
         JOIN event_categories ec ON ec.id = r.event_category_id
         WHERE r.event_id = ? AND r.athlete_id = ? AND r.status = 'confirmed'
           AND r.deleted_at IS NULL
         LIMIT 1`,
        [event.id, req.auth.id],
      );
      if (myRegRows.length > 0) {
        const row = myRegRows[0];
        myRegistration = {
          status: "confirmed",
          registrationPublicUuid: row.public_uuid,
          registrationNumber: row.registration_number,
          categoryId: row.event_category_id,
          categoryName: row.category_name,
        };
      }
    }

    let waivers: RowDataPacket[] = [];
    if (event.requires_waiver) {
      waivers = await fetchActiveEventWaiversPublic(pool, event.id as number);
    }
    const waiver = waivers[0] ?? null;

    res.json({
      event: withNormalizedEventMedia(event),
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
      waivers,
      waiver,
      myRegistration,
    });
  });

  app.post(
    "/api/events/:slug/discount/validate",
    optionalAthleteAuth,
    async (req: AuthedRequest, res) => {
      const slug = String(req.params.slug);
      const code = String(req.body?.code ?? "").trim();
      const categoryId = Number(req.body?.categoryId);

      if (!code) {
        return res.status(400).json({ error: "code required" });
      }
      if (!Number.isFinite(categoryId)) {
        return res.status(400).json({ error: "categoryId required" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        `SELECT e.id, e.organizer_id, e.status, o.service_fee_percent AS org_fee_percent,
                e.service_fee_percent
         FROM events e
         JOIN organizers o ON o.id = e.organizer_id
         WHERE e.slug = ? AND e.status = 'published' AND e.deleted_at IS NULL
         LIMIT 1`,
        [slug],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
      const event = eventRows[0];

      const [catRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, price_cents, currency
         FROM event_categories
         WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1`,
        [categoryId, event.id],
      );
      if (catRows.length === 0) {
        return res.status(404).json({ error: "Category not found" });
      }
      const category = catRows[0];

      const discountResult = await fetchValidDiscountCode(
        code,
        event.id as number,
        event.organizer_id as number,
      );
      if ("error" in discountResult) {
        return res.status(400).json({ error: discountResult.error });
      }

      const feePercent = Number(
        event.service_fee_percent ?? event.org_fee_percent ?? 11,
      );
      const originalPriceCents = Number(category.price_cents);
      const originalServiceFeeCents = calcServiceFeeCents(
        originalPriceCents,
        feePercent,
      );
      const originalTotalCents = originalPriceCents + originalServiceFeeCents;

      try {
        const applied = applyDiscountToCheckout(
          originalPriceCents,
          originalServiceFeeCents,
          discountResult.discount,
        );
        res.json({
          valid: true,
          code: discountResult.discount.code,
          discountCodeId: discountResult.discount.id,
          discountType: discountResult.discount.discount_type,
          discountValue: Number(discountResult.discount.discount_value),
          appliesTo: discountResult.discount.applies_to,
          discountAmountCents: applied.discountAmountCents,
          priceCents: applied.priceCents,
          serviceFeeCents: applied.serviceFeeCents,
          totalCents: applied.totalCents,
          originalPriceCents,
          originalServiceFeeCents,
          originalTotalCents,
        });
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Discount not applicable",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/waitlist",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const slug = String(req.params.slug);
      const athleteId = req.auth!.id;
      const categoryId = Number(req.body?.categoryId);

      if (!Number.isFinite(categoryId)) {
        return res.status(400).json({ error: "categoryId required" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, title, slug, start_date, registration_opens_at, registration_closes_at FROM events
         WHERE slug = ? AND status = 'published' AND deleted_at IS NULL LIMIT 1`,
        [slug],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
      const event = eventRows[0];

      const [catRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, capacity, waitlist_enabled,
                registration_opens_at, registration_closes_at,
                min_age, max_age, gender_restriction,
                ${CATEGORY_SOLD_COUNT_UNALIASED_SQL} AS sold_count
         FROM event_categories
         WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1`,
        [categoryId, event.id],
      );
      if (catRows.length === 0) {
        return res.status(404).json({ error: "Category not found" });
      }
      const category = catRows[0];

      const athleteProfile = await loadAthleteEligibilityProfile(athleteId);
      if (!athleteProfile) {
        return res.status(401).json({ error: "Athlete not found" });
      }
      const eligibilityErr = categoryEligibilityResponse(
        category,
        athleteProfile,
        event.start_date as string,
      );
      if (eligibilityErr) {
        return res.status(eligibilityErr.status).json(eligibilityErr.body);
      }

      const windowErr = getRegistrationWindowError(
        {
          registration_opens_at: event.registration_opens_at as string | null,
          registration_closes_at: event.registration_closes_at as string | null,
        },
        {
          registration_opens_at: category.registration_opens_at as string | null,
          registration_closes_at: category.registration_closes_at as string | null,
        },
      );
      if (windowErr) {
        return res.status(409).json({ error: windowErr.error, code: windowErr.code });
      }

      const soldOut =
        category.capacity != null &&
        Number(category.sold_count) >= Number(category.capacity);
      if (!soldOut) {
        return res.status(400).json({ error: "Category is not sold out" });
      }
      if (!Boolean(category.waitlist_enabled)) {
        return res.status(400).json({ error: "Waitlist is not enabled for this category" });
      }

      const [existingReg] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE event_id = ? AND athlete_id = ? AND status = 'confirmed'
           AND deleted_at IS NULL LIMIT 1`,
        [event.id, athleteId],
      );
      if (existingReg.length > 0) {
        return res.status(409).json({ error: "Already registered for this event" });
      }

      const [existingWaitlist] = await pool.query<RowDataPacket[]>(
        `SELECT id, status FROM waitlist_entries
         WHERE event_category_id = ? AND athlete_id = ?
           AND status IN ('waiting', 'offered') LIMIT 1`,
        [categoryId, athleteId],
      );
      if (existingWaitlist.length > 0) {
        return res.status(409).json({
          error: "Already on waitlist for this category",
          entry: existingWaitlist[0],
        });
      }

      const [posRows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(position), 0) AS max_pos FROM waitlist_entries
         WHERE event_category_id = ? AND status IN ('waiting', 'offered')`,
        [categoryId],
      );
      const position = Number(posRows[0]?.max_pos ?? 0) + 1;

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO waitlist_entries (event_id, event_category_id, athlete_id, status, position)
         VALUES (?,?,?,?,?)`,
        [event.id, categoryId, athleteId, "waiting", position],
      );

      const [entryRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_id, event_category_id, status, position, created_at
         FROM waitlist_entries WHERE id = ? LIMIT 1`,
        [result.insertId],
      );

      res.status(201).json({
        entry: {
          ...entryRows[0],
          event_title: event.title,
          event_slug: event.slug,
          category_name: category.name,
        },
      });
    },
  );

  app.post(
    "/api/events/:slug/register/checkout",
    requireAthlete,
    asyncHandler(async (req: AuthedRequest, res) => {
      const slug = String(req.params.slug);
      const athleteId = req.auth!.id;
      const categoryId = Number(req.body?.categoryId);
      const fieldValues = (req.body?.fieldValues ?? {}) as Record<
        string,
        string | boolean
      >;
      const idempotencyKey = String(req.body?.idempotencyKey ?? "").trim();
      const discountCodeInput = req.body?.discountCode
        ? String(req.body.discountCode).trim()
        : "";

      checkoutTrace("start", {
        slug,
        athleteId,
        categoryId,
        idempotencyKey,
        hasDiscountCode: Boolean(discountCodeInput),
        stripeConfigured: isStripeConfigured(),
      });

      if (!Number.isFinite(categoryId)) {
        return res.status(400).json({ error: "categoryId required" });
      }
      if (!idempotencyKey || idempotencyKey.length > 64) {
        return res
          .status(400)
          .json({ error: "idempotencyKey required (max 64 chars)" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        `SELECT e.id, e.title, e.slug, e.status, e.organizer_id, e.service_fee_percent,
                e.start_date, e.requires_waiver, e.registration_opens_at, e.registration_closes_at,
                o.stripe_account_id, o.stripe_onboarding_complete, o.stripe_connect_status,
                o.stripe_charges_enabled, o.stripe_payouts_enabled,
                o.service_fee_percent AS org_fee_percent
         FROM events e
         JOIN organizers o ON o.id = e.organizer_id
         WHERE e.slug = ? AND e.status = 'published' LIMIT 1`,
        [slug],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
      const event = eventRows[0];

      await cancelStalePendingEventPayments(athleteId, event.id as number, idempotencyKey);
      checkoutTrace("stale-payments-cancelled", { eventId: event.id });

      const [dupReg] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE event_id = ? AND athlete_id = ? AND status = 'confirmed'
           AND deleted_at IS NULL LIMIT 1`,
        [event.id, athleteId],
      );
      if (dupReg.length > 0) {
        return res.status(409).json({
          error: "Already registered for this event",
          code: "already_registered",
        });
      }

      const [catRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, price_cents, capacity, currency, waitlist_enabled,
                registration_opens_at, registration_closes_at,
                min_age, max_age, gender_restriction,
                ${CATEGORY_SOLD_COUNT_UNALIASED_SQL} AS sold_count
         FROM event_categories
         WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1`,
        [categoryId, event.id],
      );
      if (catRows.length === 0) {
        return res.status(404).json({ error: "Category not found" });
      }
      const category = catRows[0];

      const athleteProfile = await loadAthleteEligibilityProfile(athleteId);
      if (!athleteProfile) {
        return res.status(401).json({ error: "Athlete not found" });
      }
      const eligibilityErr = categoryEligibilityResponse(
        category,
        athleteProfile,
        event.start_date as string,
      );
      if (eligibilityErr) {
        return res.status(eligibilityErr.status).json(eligibilityErr.body);
      }

      const windowErr = getRegistrationWindowError(
        {
          registration_opens_at: event.registration_opens_at as string | null,
          registration_closes_at: event.registration_closes_at as string | null,
        },
        {
          registration_opens_at: category.registration_opens_at as string | null,
          registration_closes_at: category.registration_closes_at as string | null,
        },
      );
      if (windowErr) {
        return res.status(409).json({ error: windowErr.error, code: windowErr.code });
      }

      const waitlistEntryId =
        req.body?.waitlistEntryId != null ? Number(req.body.waitlistEntryId) : null;
      const soldOut =
        category.capacity != null &&
        Number(category.sold_count) >= Number(category.capacity);
      if (soldOut) {
        if (
          waitlistEntryId &&
          Number.isFinite(waitlistEntryId) &&
          (await getValidWaitlistOffer(
            pool,
            athleteId,
            event.id,
            category.id as number,
            waitlistEntryId,
          ))
        ) {
          // Waitlist claim bypasses sold-out gate
        } else if (Boolean(category.waitlist_enabled)) {
          return res.status(409).json({
            error: "Category is sold out",
            code: "waitlist_available",
            categoryId: category.id,
          });
        } else {
          return res.status(409).json({ error: "Category is sold out" });
        }
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
            return res
              .status(400)
              .json({ error: `${field.label} is required` });
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
            return res
              .status(400)
              .json({ error: `Invalid option for ${field.label}` });
          }
        }
      }

      const requiresWaiver = Boolean(event.requires_waiver);
      let waiverSignatures: WaiverSignatureInput[] | null = null;

      if (requiresWaiver) {
        waiverSignatures = parseWaiverSignatures(req.body);
        if (!waiverSignatures) {
          return res.status(400).json({ error: "Waiver acceptance required" });
        }
        const validation = await validateWaiverSignaturesForEvent(
          pool,
          event.id as number,
          waiverSignatures,
        );
        if ("error" in validation) {
          return res.status(400).json({ error: validation.error });
        }
      }

      const feePercent = Number(
        event.service_fee_percent ?? event.org_fee_percent ?? 11,
      );
      const basePriceCents = Number(category.price_cents);
      const baseServiceFeeCents = calcServiceFeeCents(basePriceCents, feePercent);
      let priceCents = basePriceCents;
      let serviceFeeCents = baseServiceFeeCents;
      let totalCents = priceCents + serviceFeeCents;
      let discountCodeId: number | undefined;
      let discountCode: string | undefined;
      let discountAmountCents = 0;

      if (discountCodeInput) {
        checkoutTrace("discount-apply", { code: discountCodeInput });
        const discountResult = await fetchValidDiscountCode(
          discountCodeInput,
          event.id as number,
          event.organizer_id as number,
        );
        if ("error" in discountResult) {
          return res.status(400).json({ error: discountResult.error });
        }
        try {
          const applied = applyDiscountToCheckout(
            basePriceCents,
            baseServiceFeeCents,
            discountResult.discount,
          );
          priceCents = applied.priceCents;
          serviceFeeCents = applied.serviceFeeCents;
          totalCents = applied.totalCents;
          discountAmountCents = applied.discountAmountCents;
          discountCodeId = discountResult.discount.id;
          discountCode = discountResult.discount.code;
        } catch (err) {
          return res.status(400).json({
            error: err instanceof Error ? err.message : "Discount not applicable",
          });
        }
      }

      checkoutTrace("pricing", {
        eventId: event.id,
        categoryId: category.id,
        totalCents,
        priceCents,
        serviceFeeCents,
        discountApplied: Boolean(discountCodeId),
      });

      const checkoutMetadata: CheckoutPaymentMetadata = {
        categoryId: category.id as number,
        fieldValues,
        categoryName: String(category.name),
        ...(waitlistEntryId && Number.isFinite(waitlistEntryId)
          ? { waitlistEntryId }
          : {}),
        ...(discountCodeId
          ? { discountCodeId, discountCode, discountAmountCents }
          : {}),
        ...(requiresWaiver && waiverSignatures
          ? {
              waiverSignatures,
              waiverAcceptedAt: new Date().toISOString(),
              clientIp: req.ip?.slice(0, 45),
              userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
              deviceInfo: String(req.headers["user-agent"] ?? "").slice(0, 255),
            }
          : {}),
      };

      const metadataJson = JSON.stringify(checkoutMetadata);

      const [existingPay] = await pool.query<RowDataPacket[]>(
        `SELECT public_uuid FROM payments
         WHERE idempotency_key = ? AND athlete_id = ? AND registration_id IS NULL
           AND status IN ('pending', 'processing', 'succeeded') LIMIT 1`,
        [idempotencyKey, athleteId],
      );
      if (existingPay.length > 0) {
        const existingUuid = existingPay[0].public_uuid as string;
        checkoutTrace("existing-payment", { paymentPublicUuid: existingUuid, totalCents });
        await pool.query<ResultSetHeader>(
          `UPDATE payments SET metadata_json = ?, amount_cents = ?,
           registration_amount_cents = ?, service_fee_cents = ?
           WHERE public_uuid = ?`,
          [metadataJson, totalCents, priceCents, serviceFeeCents, existingUuid],
        );

        const [[existingRow]] = await pool.query<RowDataPacket[]>(
          `SELECT stripe_payment_intent_id, amount_cents FROM payments WHERE public_uuid = ? LIMIT 1`,
          [existingUuid],
        );
        if (
          existingRow?.stripe_payment_intent_id &&
          getStripeClient() &&
          totalCents > 0 &&
          Number(existingRow.amount_cents) !== totalCents
        ) {
          try {
            await getStripeClient()!.paymentIntents.update(
              String(existingRow.stripe_payment_intent_id),
              { amount: totalCents },
            );
          } catch (err) {
            console.error("[checkout] payment intent amount update failed:", err);
          }
        }

        if (totalCents === 0) {
          checkoutTrace("free-checkout-resume", { paymentPublicUuid: existingUuid });
          return res.json({
            paymentPublicUuid: existingUuid,
            clientSecret: null,
            amountCents: 0,
            registrationAmountCents: priceCents,
            serviceFeeCents,
            currency: category.currency || "MXN",
            categoryName: category.name,
            eventTitle: event.title,
            fieldValues,
            ...(discountCode ? { discountCode, discountAmountCents } : {}),
          });
        }

        if (!isStripeConfigured() || !getStripeClient()) {
          return res.status(503).json({ error: "Payment service unavailable" });
        }

        const resumed = await buildCheckoutResponseForPayment(existingUuid, athleteId);
        if (resumed) {
          checkoutTrace("checkout-resumed", { paymentPublicUuid: existingUuid });
          return res.json({ ...resumed, fieldValues });
        }
      }

      const payUuid = newPublicUuid();

      if (totalCents === 0) {
        checkoutTrace("free-checkout-new", { paymentPublicUuid: payUuid });
        await pool.query<ResultSetHeader>(
          `INSERT INTO payments (
            public_uuid, idempotency_key, registration_id, athlete_id, organizer_id, event_id,
            amount_cents, registration_amount_cents, service_fee_cents, currency, status, provider,
            metadata_json, paid_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [
            payUuid,
            idempotencyKey,
            null,
            athleteId,
            event.organizer_id,
            event.id,
            0,
            priceCents,
            serviceFeeCents,
            category.currency || "MXN",
            "succeeded",
            "mock",
            JSON.stringify(checkoutMetadata),
          ],
        );

        return res.json({
          paymentPublicUuid: payUuid,
          clientSecret: null,
          amountCents: 0,
          registrationAmountCents: priceCents,
          serviceFeeCents,
          currency: category.currency || "MXN",
          categoryName: category.name,
          eventTitle: event.title,
          ...(discountCode ? { discountCode, discountAmountCents } : {}),
        });
      }

      if (!isStripeConfigured() || !getStripeClient()) {
        checkoutTrace("stripe-unavailable");
        return res.status(503).json({ error: "Payment service unavailable" });
      }

      let connectDestinationAccountId: string | null = null;
      let connectChargeMode: "destination" = "destination";
      if (totalCents > 0) {
        const connectMode = await resolveCheckoutConnectMode(
          pool,
          event.organizer_id as number,
          getStripeClient(),
        );
        if (connectMode.mode === "blocked") {
          checkoutTrace("organizer-payouts-blocked", { code: connectMode.code });
          return res.status(503).json({
            error: "Registration payments are temporarily unavailable for this event",
            code: connectMode.code,
          });
        }
        connectDestinationAccountId = connectMode.stripeAccountId;
      }

      checkoutTrace("payment-insert", { paymentPublicUuid: payUuid, totalCents });
      const checkoutMetadataWithConnect = {
        ...checkoutMetadata,
        connect_charge_mode: connectChargeMode,
      };
      const [payResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO payments (
          public_uuid, idempotency_key, registration_id, athlete_id, organizer_id, event_id,
          amount_cents, registration_amount_cents, service_fee_cents, currency, status, provider, metadata_json
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          payUuid,
          idempotencyKey,
          null,
          athleteId,
          event.organizer_id,
          event.id,
          totalCents,
          priceCents,
          serviceFeeCents,
          category.currency || "MXN",
          "pending",
          "stripe",
          JSON.stringify(checkoutMetadataWithConnect),
        ],
      );
      const paymentId = payResult.insertId;

      const stripeCustomerId = await ensureStripeCustomer(athleteId);
      checkoutTrace("stripe-customer", {
        paymentPublicUuid: payUuid,
        hasCustomer: Boolean(stripeCustomerId),
      });
      let piParams = buildRegistrationPaymentIntentParams({
        amount: totalCents,
        currency: (category.currency as string) || "mxn",
        metadata: {
          payment_public_uuid: payUuid,
          event_slug: slug,
          athlete_id: String(athleteId),
          category_id: String(category.id),
          event_id: String(event.id),
          organizer_id: String(event.organizer_id),
          connect_charge_mode: connectChargeMode,
          ...(discountCodeId ? { discount_code_id: String(discountCodeId) } : {}),
        },
        eventTitle: String(event.title),
        customerId: stripeCustomerId,
      });

      if (totalCents > 0 && connectDestinationAccountId) {
        piParams = applyConnectToPaymentIntent(piParams, {
          destinationAccountId: connectDestinationAccountId,
          applicationFeeCents: serviceFeeCents,
        });
      }

      checkoutTrace("payment-intent-create", {
        paymentPublicUuid: payUuid,
        totalCents,
        currency: piParams.currency,
      });
      let pi: Stripe.PaymentIntent;
      try {
        pi = await getStripeClient()!.paymentIntents.create(piParams, {
          idempotencyKey: `pi_${payUuid}`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Payment intent creation failed";
        checkoutTraceError("payment-intent-create", err, {
          paymentPublicUuid: payUuid,
        });
        await pool.query<ResultSetHeader>(
          `UPDATE payments SET status = 'failed', failure_code = 'pi_create_failed', failure_message = ?
           WHERE id = ? AND registration_id IS NULL`,
          [message.slice(0, 500), paymentId],
        );
        return res.status(503).json({
          error: "Could not initialize payment. Please try again.",
          code: "payment_setup_failed",
        });
      }
      const clientSecret = pi.client_secret;
      checkoutTrace("payment-intent-created", {
        paymentPublicUuid: payUuid,
        paymentIntentId: pi.id,
        hasClientSecret: Boolean(clientSecret),
      });
      await pool.query<ResultSetHeader>(
        `UPDATE payments SET stripe_payment_intent_id = ?, status = 'processing' WHERE id = ?`,
        [pi.id, paymentId],
      );

      res.json({
        paymentPublicUuid: payUuid,
        clientSecret,
        amountCents: totalCents,
        registrationAmountCents: priceCents,
        serviceFeeCents,
        currency: category.currency || "MXN",
        categoryName: category.name,
        eventTitle: event.title,
        ...(discountCode
          ? { discountCode, discountAmountCents }
          : {}),
      });
    }),
  );

  app.post(
    "/api/events/:slug/register/resume",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const slug = String(req.params.slug);
      const athleteId = req.auth!.id;
      const paymentPublicUuid = String(req.body?.paymentPublicUuid ?? "").trim();
      const idempotencyKey = String(req.body?.idempotencyKey ?? "").trim();

      if (!paymentPublicUuid && !idempotencyKey) {
        return res.status(400).json({ error: "paymentPublicUuid or idempotencyKey required" });
      }

      const [eventRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM events WHERE slug = ? AND status = 'published' LIMIT 1",
        [slug],
      );
      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
      const eventId = eventRows[0].id as number;

      const [payRows] = await pool.query<RowDataPacket[]>(
        paymentPublicUuid
          ? `SELECT p.*, e.title AS event_title, e.slug AS event_slug
             FROM payments p
             JOIN events e ON e.id = p.event_id
             WHERE p.public_uuid = ? AND p.athlete_id = ? AND p.event_id = ? LIMIT 1`
          : `SELECT p.*, e.title AS event_title, e.slug AS event_slug
             FROM payments p
             JOIN events e ON e.id = p.event_id
             WHERE p.idempotency_key = ? AND p.athlete_id = ? AND p.event_id = ?
               AND p.registration_id IS NULL
             ORDER BY p.created_at DESC LIMIT 1`,
        paymentPublicUuid
          ? [paymentPublicUuid, athleteId, eventId]
          : [idempotencyKey, athleteId, eventId],
      );
      if (payRows.length === 0) {
        return res.status(404).json({ error: "Checkout session not found" });
      }
      const pay = payRows[0];
      const payUuid = pay.public_uuid as string;

      if (pay.registration_id) {
        const [existing] = await pool.query<RowDataPacket[]>(
          `SELECT r.public_uuid, r.registration_number, r.qr_code_token, r.status, r.total_cents,
                  ec.name AS category_name, e.title AS event_title, e.slug AS event_slug
           FROM registrations r
           JOIN event_categories ec ON ec.id = r.event_category_id
           JOIN events e ON e.id = r.event_id
           WHERE r.id = ? AND r.deleted_at IS NULL`,
          [pay.registration_id],
        );
        return res.json({
          status: "complete",
          registration: existing[0] ?? null,
          confirmationEmail: await athleteLoginEmail(athleteId),
        });
      }

      if (pay.provider === "mock" && Number(pay.amount_cents) === 0) {
        const result = await confirmRegistrationPayment(payUuid, athleteId);
        if (result.success && result.registration) {
          return res.json({
            status: "complete",
            registration: result.registration,
            confirmationEmail: await athleteLoginEmail(athleteId),
          });
        }
        return res.status(402).json({
          status: "failed",
          error: result.error || "Could not complete free registration",
        });
      }

      if (getStripeClient() && pay.stripe_payment_intent_id) {
        const pi = await getStripeClient()!.paymentIntents.retrieve(
          pay.stripe_payment_intent_id as string,
        );
        if (pi.status === "succeeded") {
          const result = await finalizeRegistrationAfterPayment(payUuid, pi);
          if (result.success && result.registration) {
            return res.json({
              status: "complete",
              registration: result.registration,
              confirmationEmail: await athleteLoginEmail(athleteId),
            });
          }
          return res.status(402).json({
            status: "failed",
            error: result.error || "Payment captured but registration failed",
          });
        }
      }

      const resumed = await buildCheckoutResponseForPayment(payUuid, athleteId);
      if (!resumed) {
        return res.status(410).json({
          status: "expired",
          error: "Checkout session expired — please start again",
        });
      }

      return res.json({ status: "checkout", checkout: resumed });
    },
  );

  app.post(
    "/api/events/:slug/register/confirm",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const paymentPublicUuid = String(
        req.body?.paymentPublicUuid ?? req.body?.registrationPublicUuid ?? "",
      ).trim();
      const paymentIntentId = req.body?.paymentIntentId
        ? String(req.body.paymentIntentId)
        : undefined;
      const paymentMethodId = req.body?.paymentMethodId
        ? String(req.body.paymentMethodId)
        : undefined;

      if (!paymentPublicUuid) {
        return res.status(400).json({ error: "paymentPublicUuid required" });
      }

      const [payProbe] = await pool.query<RowDataPacket[]>(
        `SELECT provider, amount_cents FROM payments
         WHERE public_uuid = ? AND athlete_id = ? LIMIT 1`,
        [paymentPublicUuid, req.auth!.id],
      );
      const isZeroMock =
        payProbe.length > 0 &&
        payProbe[0].provider === "mock" &&
        Number(payProbe[0].amount_cents) === 0;

      if (!isZeroMock && (!isStripeConfigured() || !getStripeClient())) {
        return res.status(503).json({ error: "Payment service unavailable" });
      }

      const result = await confirmRegistrationPayment(
        paymentPublicUuid,
        req.auth!.id,
        paymentIntentId,
        paymentMethodId,
      );

      if (!result.success || !result.registration) {
        return res.status(402).json({
          success: false,
          error: result.error || "Payment failed",
          ...(result.requiresAction
            ? { requiresAction: true, clientSecret: result.clientSecret }
            : {}),
        });
      }

      const r = result.registration;
      res.json({
        success: true,
        confirmationEmail: await athleteLoginEmail(req.auth!.id),
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

const ATHLETE_GENDER_VALUES = new Set([
  "male",
  "female",
  "other",
  "prefer_not_to_say",
]);
const ATHLETE_SHIRT_SIZE_VALUES = new Set(["XS", "S", "M", "L", "XL", "XXL"]);

function parseAthleteProfileUpdate(body: Record<string, unknown>):
  | { error: string }
  | {
      data: {
        first_name: string;
        last_name: string;
        phone: string | null;
        date_of_birth: string | null;
        gender: string | null;
        shirt_size: string | null;
        country: string;
        city: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
      };
    } {
  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();
  if (!first_name || first_name.length > 100) {
    return { error: "first_name required (max 100 characters)" };
  }
  if (!last_name || last_name.length > 100) {
    return { error: "last_name required (max 100 characters)" };
  }

  const phoneRaw = body.phone;
  const phone =
    phoneRaw === null || phoneRaw === undefined || phoneRaw === ""
      ? null
      : String(phoneRaw).trim();
  if (phone && phone.length > 20) {
    return { error: "phone max 20 characters" };
  }

  const dobRaw = body.date_of_birth;
  const date_of_birth =
    dobRaw === null || dobRaw === undefined || dobRaw === ""
      ? null
      : String(dobRaw).trim();
  if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
    return { error: "date_of_birth must be YYYY-MM-DD" };
  }

  const genderRaw = body.gender;
  const gender =
    genderRaw === null || genderRaw === undefined || genderRaw === ""
      ? null
      : String(genderRaw);
  if (gender && !ATHLETE_GENDER_VALUES.has(gender)) {
    return { error: "invalid gender" };
  }

  const shirtRaw = body.shirt_size;
  const shirt_size =
    shirtRaw === null || shirtRaw === undefined || shirtRaw === ""
      ? null
      : String(shirtRaw);
  if (shirt_size && !ATHLETE_SHIRT_SIZE_VALUES.has(shirt_size)) {
    return { error: "invalid shirt_size" };
  }

  const country = String(body.country ?? "MX").trim().toUpperCase().slice(0, 2);
  if (!country) {
    return { error: "country required" };
  }

  const cityRaw = body.city;
  const city =
    cityRaw === null || cityRaw === undefined || cityRaw === ""
      ? null
      : String(cityRaw).trim();
  if (city && city.length > 100) {
    return { error: "city max 100 characters" };
  }

  const ecNameRaw = body.emergency_contact_name;
  const emergency_contact_name =
    ecNameRaw === null || ecNameRaw === undefined || ecNameRaw === ""
      ? null
      : String(ecNameRaw).trim();
  if (emergency_contact_name && emergency_contact_name.length > 200) {
    return { error: "emergency_contact_name max 200 characters" };
  }

  const ecPhoneRaw = body.emergency_contact_phone;
  const emergency_contact_phone =
    ecPhoneRaw === null || ecPhoneRaw === undefined || ecPhoneRaw === ""
      ? null
      : String(ecPhoneRaw).trim();
  if (emergency_contact_phone && emergency_contact_phone.length > 20) {
    return { error: "emergency_contact_phone max 20 characters" };
  }

  return {
    data: {
      first_name,
      last_name,
      phone,
      date_of_birth,
      gender,
      shirt_size,
      country,
      city,
      emergency_contact_name,
      emergency_contact_phone,
    },
  };
}

function parseAvatarDataUrl(image: unknown):
  | { error: string }
  | { dataUrl: string } {
  const raw = String(image ?? "").trim();
  if (!raw.startsWith("data:image/")) {
    return { error: "image must be a data URL (jpeg, png, or webp)" };
  }

  const match = raw.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) {
    return { error: "invalid image format (jpeg, png, webp only)" };
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 180 * 1024) {
    return { error: "image too large (max 180KB)" };
  }
  if (raw.length > 500_000) {
    return { error: "image payload too large" };
  }

  return { dataUrl: raw };
}

function parseStaffProfileUpdate(body: Record<string, unknown>):
  | { error: string }
  | { updates: string[]; params: (string | null)[] } {
  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (body.first_name !== undefined) {
    const first_name = String(body.first_name).trim();
    if (!first_name) return { error: "first_name required" };
    updates.push("first_name = ?");
    params.push(first_name.slice(0, 100));
  }
  if (body.last_name !== undefined) {
    const last_name = String(body.last_name).trim();
    if (!last_name) return { error: "last_name required" };
    updates.push("last_name = ?");
    params.push(last_name.slice(0, 100));
  }
  if (body.phone !== undefined) {
    const phoneRaw = body.phone == null ? "" : String(body.phone).trim();
    updates.push("phone = ?");
    params.push(phoneRaw ? phoneRaw.slice(0, 20) : null);
  }
  if (body.preferred_language !== undefined) {
    updates.push("preferred_language = ?");
    params.push(normalizeLocale(String(body.preferred_language)));
  }

  if (updates.length === 0) {
    return { error: "No fields to update" };
  }
  return { updates, params };
}

function registerAthleteRoutes(app: express.Express) {
  app.get(
    "/api/athlete/me",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, email, phone, first_name, last_name, date_of_birth, gender,
              shirt_size, country, city, emergency_contact_name, emergency_contact_phone,
              avatar_url, preferred_language, created_at
       FROM athletes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [req.auth!.id],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }
      res.json({ athlete: serializeAthleteRow(rows[0]) });
    },
  );

  app.patch(
    "/api/athlete/me",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const parsed = parseAthleteProfileUpdate(
        (req.body ?? {}) as Record<string, unknown>,
      );
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data } = parsed;

      if (data.phone) {
        const [phoneRows] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM athletes
           WHERE phone = ? AND id <> ? AND deleted_at IS NULL LIMIT 1`,
          [data.phone, req.auth!.id],
        );
        if (phoneRows.length > 0) {
          return res.status(409).json({ error: "Phone number already in use" });
        }
      }

      await pool.query<ResultSetHeader>(
        `UPDATE athletes SET
           first_name = ?, last_name = ?, phone = ?, date_of_birth = ?,
           gender = ?, shirt_size = ?, country = ?, city = ?,
           emergency_contact_name = ?, emergency_contact_phone = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          data.first_name,
          data.last_name,
          data.phone,
          data.date_of_birth,
          data.gender,
          data.shirt_size,
          data.country,
          data.city,
          data.emergency_contact_name,
          data.emergency_contact_phone,
          req.auth!.id,
        ],
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, email, phone, first_name, last_name, date_of_birth, gender,
                shirt_size, country, city, emergency_contact_name, emergency_contact_phone,
                avatar_url, preferred_language, created_at
         FROM athletes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [req.auth!.id],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }
      res.json({ ok: true, athlete: serializeAthleteRow(rows[0]) });
    },
  );

  app.patch(
    "/api/athlete/preferences",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const locale = req.body?.preferred_language
        ? normalizeLocale(String(req.body.preferred_language))
        : null;
      if (!locale) {
        return res
          .status(400)
          .json({ error: "preferred_language required (es|en)" });
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
                r.total_cents, r.created_at, r.waiver_signed_at,
                e.title AS event_title, e.slug AS event_slug, e.start_date, e.allows_transfers,
                e.requires_waiver,
                ec.name AS category_name
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
         JOIN event_categories ec ON ec.id = r.event_category_id
         WHERE r.athlete_id = ? AND r.deleted_at IS NULL AND r.status = 'confirmed'
         ORDER BY r.created_at DESC`,
        [req.auth!.id],
      );

      const registrations = await Promise.all(
        rows.map(async (row) => {
          let waiver_outdated = false;
          if (Boolean(row.requires_waiver)) {
            const status = await getRegistrationWaiverStatus(pool, row.id as number);
            waiver_outdated = status.outdated;
          }
          const { requires_waiver, ...rest } = row;
          return { ...rest, waiver_outdated };
        }),
      );

      res.json({ registrations });
    },
  );

  app.get(
    "/api/athlete/registrations/:publicUuid/waivers",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const publicUuid = String(req.params.publicUuid).trim();
      const [regRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.event_id, r.status, e.requires_waiver, e.slug AS event_slug
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
         WHERE r.public_uuid = ? AND r.athlete_id = ? AND r.deleted_at IS NULL LIMIT 1`,
        [publicUuid, req.auth!.id],
      );
      if (regRows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }
      const reg = regRows[0];
      if (reg.status !== "confirmed") {
        return res.status(400).json({ error: "Registration is not confirmed" });
      }
      if (!Boolean(reg.requires_waiver)) {
        return res.json({ requiresResign: false, waivers: [], waiverStatus: { signed: true, outdated: false, outdatedWaivers: [] } });
      }

      const waivers = await fetchActiveEventWaiversPublic(pool, reg.event_id as number);
      const waiverStatus = await getRegistrationWaiverStatus(pool, reg.id as number);

      res.json({
        requiresResign: waiverStatus.outdated,
        waivers,
        waiverStatus,
      });
    },
  );

  app.post(
    "/api/athlete/registrations/:publicUuid/waivers/resign",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const publicUuid = String(req.params.publicUuid).trim();
      const signatures = parseWaiverSignatures(req.body);
      if (!signatures) {
        return res.status(400).json({ error: "Waiver acceptance required" });
      }

      const [regRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.event_id, r.status, e.requires_waiver
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
         WHERE r.public_uuid = ? AND r.athlete_id = ? AND r.deleted_at IS NULL LIMIT 1`,
        [publicUuid, req.auth!.id],
      );
      if (regRows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }
      const reg = regRows[0];

      const validation = await validateWaiverSignaturesForEvent(
        pool,
        reg.event_id as number,
        signatures,
      );
      if ("error" in validation) {
        return res.status(400).json({ error: validation.error });
      }

      const result = await resignRegistrationWaivers(pool, reg.id as number, signatures, {
        clientIp: req.ip?.slice(0, 45),
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
        deviceInfo: String(req.headers["user-agent"] ?? "").slice(0, 255),
      });
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ ok: true });
    },
  );

  app.get(
    "/api/athlete/pending-checkout",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const eventSlug = req.query.eventSlug ? String(req.query.eventSlug) : null;
      const sql = eventSlug
        ? `SELECT p.public_uuid, p.amount_cents, p.currency, p.status, p.created_at,
                  p.metadata_json, e.title AS event_title, e.slug AS event_slug
           FROM payments p
           JOIN events e ON e.id = p.event_id
           WHERE p.athlete_id = ? AND p.registration_id IS NULL
             AND p.status IN ('pending', 'processing', 'succeeded')
             AND e.slug = ?
           ORDER BY p.created_at DESC LIMIT 1`
        : `SELECT p.public_uuid, p.amount_cents, p.currency, p.status, p.created_at,
                  p.metadata_json, e.title AS event_title, e.slug AS event_slug
           FROM payments p
           JOIN events e ON e.id = p.event_id
           WHERE p.athlete_id = ? AND p.registration_id IS NULL
             AND p.status IN ('pending', 'processing', 'succeeded')
           ORDER BY p.created_at DESC LIMIT 5`;
      const params = eventSlug ? [req.auth!.id, eventSlug] : [req.auth!.id];
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      const pending = rows.map((row) => {
        const meta = parseCheckoutPaymentMetadata(
          typeof row.metadata_json === "string"
            ? JSON.parse(row.metadata_json as string)
            : row.metadata_json,
        );
        return {
          public_uuid: row.public_uuid,
          amount_cents: row.amount_cents,
          currency: row.currency,
          status: row.status,
          created_at: row.created_at,
          event_title: row.event_title,
          event_slug: row.event_slug,
          category_name: meta?.categoryName ?? null,
          category_id: meta?.categoryId ?? null,
        };
      });
      res.json({ pending });
    },
  );

  app.get(
    "/api/athlete/waitlist",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      await expireStaleWaitlistOffers(pool);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT w.id, w.event_id, w.event_category_id, w.status, w.position,
                w.offered_at, w.offer_expires_at, w.created_at,
                e.title AS event_title, e.slug AS event_slug,
                ec.name AS category_name,
                (w.status = 'offered' AND (w.offer_expires_at IS NULL OR w.offer_expires_at > NOW())) AS can_claim
         FROM waitlist_entries w
         JOIN events e ON e.id = w.event_id AND e.deleted_at IS NULL
         JOIN event_categories ec ON ec.id = w.event_category_id
         WHERE w.athlete_id = ?
           AND w.status IN ('waiting', 'offered')
         ORDER BY w.created_at DESC`,
        [req.auth!.id],
      );
      res.json({
        entries: rows.map((r) => ({
          ...r,
          can_claim: Boolean(r.can_claim),
        })),
      });
    },
  );

  app.post(
    "/api/athlete/registrations/:publicUuid/transfer",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const publicUuid = String(req.params.publicUuid).trim();
      const recipientEmail = String(req.body?.recipientEmail ?? "")
        .trim()
        .toLowerCase();
      const fromAthleteId = req.auth!.id;

      if (!publicUuid) {
        return res.status(400).json({ error: "Registration id required" });
      }
      if (!recipientEmail || !recipientEmail.includes("@")) {
        return res.status(400).json({ error: "Valid recipientEmail required" });
      }

      const [regRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.athlete_id, r.status, r.event_id,
                e.allows_transfers, e.transfer_fee_cents, e.title AS event_title
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
         WHERE r.public_uuid = ? AND r.deleted_at IS NULL LIMIT 1`,
        [publicUuid],
      );
      if (regRows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }
      const reg = regRows[0];

      if (Number(reg.athlete_id) !== fromAthleteId) {
        return res.status(403).json({ error: "Not your registration" });
      }
      if (reg.status !== "confirmed") {
        return res.status(400).json({ error: "Only confirmed registrations can be transferred" });
      }
      if (!Boolean(reg.allows_transfers)) {
        return res.status(400).json({ error: "Transfers are not allowed for this event" });
      }

      const [toRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email FROM athletes
         WHERE LOWER(email) = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
        [recipientEmail],
      );
      if (toRows.length === 0) {
        return res.status(404).json({ error: "Recipient athlete not found" });
      }
      const toAthleteId = Number(toRows[0].id);
      if (toAthleteId === fromAthleteId) {
        return res.status(400).json({ error: "Cannot transfer to yourself" });
      }

      const [dupReg] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE event_id = ? AND athlete_id = ? AND status = 'confirmed'
           AND deleted_at IS NULL LIMIT 1`,
        [reg.event_id, toAthleteId],
      );
      if (dupReg.length > 0) {
        return res.status(409).json({ error: "Recipient is already registered for this event" });
      }

      const transferFeeCents = Number(reg.transfer_fee_cents ?? 0);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [transferResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO registration_transfers (
             registration_id, from_athlete_id, to_athlete_id, transfer_fee_cents, status, completed_at
           ) VALUES (?,?,?,?,?,NOW())`,
          [reg.id, fromAthleteId, toAthleteId, transferFeeCents, "completed"],
        );

        await conn.query<ResultSetHeader>(
          `UPDATE registrations SET athlete_id = ?, source = 'transfer' WHERE id = ?`,
          [toAthleteId, reg.id],
        );

        await conn.commit();

        res.json({
          ok: true,
          transfer: {
            id: transferResult.insertId,
            registration_id: reg.id,
            status: "completed",
            completed_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },
  );

  app.get(
    "/api/athlete/results",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT er.id, er.overall_rank, er.category_rank, er.gender_rank,
                er.finish_time_ms, er.pace_per_km_ms, er.status, er.published_at,
                e.title AS event_title, e.slug AS event_slug, e.start_date,
                ec.name AS category_name,
                r.registration_number, r.bib_number
         FROM event_results er
         JOIN registrations r ON r.id = er.registration_id AND r.deleted_at IS NULL
         JOIN events e ON e.id = er.event_id AND e.deleted_at IS NULL
         JOIN event_categories ec ON ec.id = er.event_category_id
         WHERE r.athlete_id = ? AND er.published_at IS NOT NULL
         ORDER BY er.published_at DESC, e.start_date DESC`,
        [req.auth!.id],
      );

      const results = [];
      for (const row of rows) {
        const [splits] = await pool.query<RowDataPacket[]>(
          `SELECT id, split_name, split_order, distance_km, elapsed_ms, pace_per_km_ms
           FROM result_splits WHERE result_id = ? ORDER BY split_order ASC, id ASC`,
          [row.id],
        );
        results.push({ ...row, splits });
      }
      res.json({ results });
    },
  );

  app.get(
    "/api/athlete/results/:resultId/visualization",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const resultId = Number(req.params.resultId);
      if (!Number.isFinite(resultId)) {
        return res.status(400).json({ error: "Invalid result id" });
      }

      const [resultRows] = await pool.query<RowDataPacket[]>(
        `SELECT er.id, er.finish_time_ms, er.event_id, e.slug AS event_slug
         FROM event_results er
         JOIN registrations r ON r.id = er.registration_id AND r.deleted_at IS NULL
         JOIN events e ON e.id = er.event_id AND e.deleted_at IS NULL
         WHERE er.id = ? AND r.athlete_id = ? AND er.published_at IS NOT NULL LIMIT 1`,
        [resultId, req.auth!.id],
      );
      if (resultRows.length === 0) {
        return res.status(404).json({ error: "Result not found" });
      }
      const result = resultRows[0];

      const [splitRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, split_name, split_order, distance_km, elapsed_ms, pace_per_km_ms
         FROM result_splits WHERE result_id = ? ORDER BY split_order ASC, id ASC`,
        [resultId],
      );

      const [courseRows] = await pool.query<RowDataPacket[]>(
        `SELECT route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json
         FROM event_courses WHERE event_id = ? LIMIT 1`,
        [result.event_id],
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
          elevationProfile: parseElevationProfile(courseRow.elevation_profile_json),
        };
      }

      const totalKm = Number(course?.distanceKm ?? splitRows[splitRows.length - 1]?.distance_km ?? 0);
      const paceSegments = buildServerPaceSegments(splitRows, totalKm);

      res.json({
        resultId,
        finishTimeMs: result.finish_time_ms,
        splits: splitRows,
        course,
        paceSegments,
      });
    },
  );

  app.post(
    "/api/athlete/avatar",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const parsed = parseAvatarDataUrl(req.body?.image);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      await pool.query<ResultSetHeader>(
        "UPDATE athletes SET avatar_url = ? WHERE id = ? AND deleted_at IS NULL",
        [parsed.dataUrl, req.auth!.id],
      );

      res.json({ ok: true, avatar_url: parsed.dataUrl });
    },
  );

  app.delete(
    "/api/athlete/avatar",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      await pool.query<ResultSetHeader>(
        "UPDATE athletes SET avatar_url = NULL WHERE id = ? AND deleted_at IS NULL",
        [req.auth!.id],
      );
      res.json({ ok: true, avatar_url: null });
    },
  );

  app.get(
    "/api/athlete/payment-methods",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      if (!isStripeConfigured() || !getStripeClient()) {
        return res.status(503).json({ error: "Payment service unavailable" });
      }

      const customerId = await ensureStripeCustomer(req.auth!.id);
      if (!customerId) {
        return res.status(500).json({ error: "Could not create Stripe customer" });
      }

      const { paymentMethods, defaultPaymentMethodId } =
        await listAthleteStripePaymentMethods(customerId);
      res.json({ paymentMethods, defaultPaymentMethodId });
    },
  );

  app.post(
    "/api/athlete/payment-methods/setup-intent",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      if (!isStripeConfigured() || !getStripeClient()) {
        return res.status(503).json({ error: "Payment service unavailable" });
      }

      const customerId = await ensureStripeCustomer(req.auth!.id);
      if (!customerId) {
        return res.status(500).json({ error: "Could not create Stripe customer" });
      }

      const setupIntent = await getStripeClient()!.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
      });

      res.json({
        clientSecret: setupIntent.client_secret,
      });
    },
  );

  app.post(
    "/api/athlete/payment-methods/complete-setup",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const setupIntentId = String(req.body?.setupIntentId ?? "").trim();
      const setAsDefault = req.body?.setAsDefault !== false;

      if (!setupIntentId) {
        return res.status(400).json({ error: "setupIntentId required" });
      }
      if (!isStripeConfigured() || !getStripeClient()) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const customerId = await ensureStripeCustomer(req.auth!.id);
      if (!customerId) {
        return res.status(500).json({ error: "Could not resolve Stripe customer" });
      }

      const setupIntent =
        await getStripeClient()!.setupIntents.retrieve(setupIntentId);
      if (setupIntent.status !== "succeeded") {
        return res.status(400).json({ error: "Setup not completed" });
      }
      if (setupIntent.customer !== customerId) {
        return res.status(403).json({ error: "Invalid setup intent" });
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;

      if (!paymentMethodId) {
        return res.status(400).json({ error: "No payment method on setup intent" });
      }

      const { paymentMethods, defaultPaymentMethodId } =
        await listAthleteStripePaymentMethods(customerId);
      const shouldSetDefault =
        setAsDefault || paymentMethods.length <= 1 || !defaultPaymentMethodId;

      if (shouldSetDefault) {
        await setAthleteDefaultPaymentMethod(
          req.auth!.id,
          customerId,
          paymentMethodId,
        );
      }

      const updated = await listAthleteStripePaymentMethods(customerId);
      res.json(updated);
    },
  );

  app.patch(
    "/api/athlete/payment-methods/default",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const paymentMethodId = String(req.body?.paymentMethodId ?? "").trim();
      if (!paymentMethodId) {
        return res.status(400).json({ error: "paymentMethodId required" });
      }
      if (!isStripeConfigured() || !getStripeClient()) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const customerId = await ensureStripeCustomer(req.auth!.id);
      if (!customerId) {
        return res.status(500).json({ error: "Could not resolve Stripe customer" });
      }

      try {
        await setAthleteDefaultPaymentMethod(
          req.auth!.id,
          customerId,
          paymentMethodId,
        );
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Invalid payment method",
        });
      }

      const updated = await listAthleteStripePaymentMethods(customerId);
      res.json(updated);
    },
  );

  app.delete(
    "/api/athlete/payment-methods/:paymentMethodId",
    requireAthlete,
    async (req: AuthedRequest, res) => {
      const paymentMethodId = String(req.params.paymentMethodId ?? "").trim();
      if (!paymentMethodId) {
        return res.status(400).json({ error: "paymentMethodId required" });
      }
      if (!isStripeConfigured() || !getStripeClient()) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const customerId = await ensureStripeCustomer(req.auth!.id);
      if (!customerId) {
        return res.status(500).json({ error: "Could not resolve Stripe customer" });
      }

      try {
        await detachAthletePaymentMethod(customerId, paymentMethodId);
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Could not remove card",
        });
      }

      const updated = await listAthleteStripePaymentMethods(customerId);
      res.json(updated);
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
      const rows = await listOrganizerMemberEvents(pool, req.auth!.id, organizerId);
      const events = await enrichStaffEventsWithPaymentAvailability(
        pool,
        rows.map((row) => ({
          id: Number(row.id),
          status: String(row.status),
          organizer_id: Number(row.organizer_id ?? organizerId),
          slug: String(row.slug),
          title: String(row.title),
          start_date: String(row.start_date),
          registration_count: Number(row.registration_count ?? 0),
          location_city: row.location_city != null ? String(row.location_city) : undefined,
          sport_name: row.sport_name != null ? String(row.sport_name) : undefined,
        })),
        getStripeClient(),
      );
      res.json({ events });
    },
  );

  app.get(
    "/api/organizer/registrations",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }

      const eventIdRaw = req.query.eventId;
      const eventId =
        eventIdRaw != null && String(eventIdRaw).trim() !== ""
          ? Number(eventIdRaw)
          : undefined;
      if (eventId != null && !Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid eventId" });
      }

      const q = String(req.query.q ?? "").trim();
      const result = await listStaffRegistrations(pool, {
        organizerId,
        eventId,
        q: q || undefined,
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      });
      res.json(result);
    },
  );

  app.patch(
    "/api/organizer/preferences",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const locale = req.body?.preferred_language
        ? normalizeLocale(String(req.body.preferred_language))
        : null;
      if (!locale) {
        return res
          .status(400)
          .json({ error: "preferred_language required (es|en)" });
      }
      await pool.query<ResultSetHeader>(
        "UPDATE organizer_members SET preferred_language = ? WHERE id = ?",
        [locale, req.auth!.id],
      );
      res.json({ ok: true, preferred_language: locale });
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

      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
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

      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
      if (!memberRole || !canOrganizerEditEvents(memberRole)) {
        return res.status(403).json({ error: "Insufficient permissions to edit events" });
      }

      const raw = req.body?.sponsors;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "sponsors array required" });
      }

      const validTiers = new Set([
        "title",
        "gold",
        "silver",
        "bronze",
        "partner",
      ]);
      const sponsors = raw
        .map((s: Record<string, unknown>, index: number) => {
          const name = String(s.name ?? "").trim();
          if (!name) return null;
          const tier = String(s.tier ?? "partner");
          return {
            name: name.slice(0, 200),
            logo_url: s.logo_url ? String(s.logo_url).slice(0, 500) : null,
            website_url: s.website_url
              ? String(s.website_url).slice(0, 500)
              : null,
            tier: validTiers.has(tier) ? tier : "partner",
            sort_order: Number.isFinite(Number(s.sort_order))
              ? Number(s.sort_order)
              : index + 1,
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
        await conn.query("DELETE FROM event_sponsors WHERE event_id = ?", [
          eventId,
        ]);
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
         (SELECT COUNT(*) FROM athletes WHERE status = 'active' AND deleted_at IS NULL) AS athletes,
         (SELECT COUNT(*) FROM organizers WHERE status = 'active') AS organizers,
         (SELECT COUNT(*) FROM events WHERE status = 'published' AND deleted_at IS NULL) AS published_events,
         (SELECT COUNT(*) FROM events WHERE status = 'pending_approval' AND deleted_at IS NULL) AS pending_approval_events,
         (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed' AND deleted_at IS NULL) AS confirmed_registrations,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'succeeded') AS total_revenue_cents`,
    );
    res.json({ stats: stats ?? {} });
  });

  app.post(
    "/api/admin/registrations/:registrationId/resend-confirmation",
    requireAdmin,
    async (req, res) => {
      const registrationId = Number(req.params.registrationId);
      if (!Number.isFinite(registrationId) || registrationId <= 0) {
        return res.status(400).json({ error: "Invalid registration id" });
      }
      const result = await deliverRegistrationConfirmedEmail(registrationId, {
        force: true,
      });
      if (!result.sent) {
        return res.status(result.skipped ? 409 : 502).json({
          error: result.error ?? "Could not send confirmation email",
          skipped: result.skipped ?? false,
        });
      }
      res.json({ ok: true, sent: true });
    },
  );

  app.get("/api/admin/athletes", requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const result = await listAdminAthletes(pool, {
      q: q || undefined,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(result);
  });

  app.get("/api/admin/events", requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const like = q ? `%${q}%` : null;
    const params: string[] = [];
    let filters = " WHERE e.deleted_at IS NULL";

    if (like) {
      filters += " AND (e.title LIKE ? OR e.slug LIKE ? OR o.name LIKE ?)";
      params.push(like, like, like);
    }
    if (
      status &&
      ["draft", "pending_approval", "published", "cancelled", "completed"].includes(status)
    ) {
      filters += " AND e.status = ?";
      params.push(status);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.slug, e.title, e.status, e.start_date, e.organizer_id,
              ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count,
              e.location_city, st.name AS sport_name, o.name AS organizer_name
       FROM events e
       JOIN sport_types st ON st.id = e.sport_type_id
       JOIN organizers o ON o.id = e.organizer_id
       ${filters}
       ORDER BY e.start_date DESC
       LIMIT 100`,
      params,
    );
    const events = await enrichStaffEventsWithPaymentAvailability(
      pool,
      rows as Array<{ id: number; status: string; organizer_id?: number | null }>,
      getStripeClient(),
    );
    res.json({ events });
  });

  app.get("/api/admin/analytics", requireAdmin, async (_req, res) => {
    const [[stats]] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM athletes WHERE status = 'active' AND deleted_at IS NULL) AS athletes,
         (SELECT COUNT(*) FROM organizers WHERE status = 'active') AS organizers,
         (SELECT COUNT(*) FROM events WHERE status = 'published' AND deleted_at IS NULL) AS published_events,
         (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed' AND deleted_at IS NULL) AS confirmed_registrations,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'succeeded') AS total_revenue_cents`,
    );

    const [[last30]] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM registrations
          WHERE status = 'confirmed' AND deleted_at IS NULL
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS registrations,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM payments
          WHERE status = 'succeeded'
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS revenue_cents`,
    );

    const [topEvents] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.title, e.slug,
              ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count,
              COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount_cents ELSE 0 END), 0) AS revenue_cents
       FROM events e
       LEFT JOIN payments p ON p.event_id = e.id
       WHERE e.deleted_at IS NULL
       GROUP BY e.id, e.title, e.slug
       ORDER BY revenue_cents DESC, registration_count DESC
       LIMIT 5`,
    );

    res.json({
      stats: stats ?? {},
      last_30_days: {
        registrations: Number(last30?.registrations ?? 0),
        revenue_cents: Number(last30?.revenue_cents ?? 0),
      },
      top_events: topEvents,
    });
  });

  app.patch("/api/admin/preferences", requireAdmin, async (req: AuthedRequest, res) => {
    const locale = req.body?.preferred_language
      ? normalizeLocale(String(req.body.preferred_language))
      : null;
    if (!locale) {
      return res
        .status(400)
        .json({ error: "preferred_language required (es|en)" });
    }
    await pool.query<ResultSetHeader>(
      "UPDATE admins SET preferred_language = ? WHERE id = ?",
      [locale, req.auth!.id],
    );
    res.json({ ok: true, preferred_language: locale });
  });

  app.get("/api/admin/events/:eventId/sponsors", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const [eventRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [eventId],
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
  });

  app.put("/api/admin/events/:eventId/sponsors", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const [eventRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [eventId],
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
  });
}

// ============================================================================
// ROUTES — WEBHOOKS (Stripe direct payments; Connect account.updated)
// ============================================================================

async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  if (!stripe || !webhookSecret) {
    return res.status(503).json({ error: "Webhook not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ error: "Missing Stripe signature" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      webhookSecret,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe:webhook] signature error:", message);
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  try {
    const claim = await claimStripeWebhookEvent(pool, event);
    if (claim.action === "skip") {
      return res.json({ received: true, duplicate: true, reason: claim.reason });
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentUuid = pi.metadata?.payment_public_uuid;
      if (paymentUuid) {
        await finalizeRegistrationAfterPayment(paymentUuid, pi);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentUuid = pi.metadata?.payment_public_uuid;
      if (paymentUuid) {
        await pool.query<ResultSetHeader>(
          `UPDATE payments SET status = 'failed',
             failure_code = ?, failure_message = ?
           WHERE public_uuid = ? AND status IN ('pending', 'processing')`,
          [
            pi.last_payment_error?.code ?? "payment_failed",
            (pi.last_payment_error?.message ?? "Payment failed").slice(0, 500),
            paymentUuid,
          ],
        );
      }
    } else if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await handleStripeAccountUpdatedWebhook(pool, account);
    } else if (event.type === "account.application.deauthorized") {
      const accountId = (event.data.object as { id?: string }).id;
      if (accountId) {
        await handleStripeConnectDeauthorized(pool, accountId);
      }
    } else {
      await pool.query<ResultSetHeader>(
        `UPDATE stripe_webhook_events SET status = 'ignored', processed_at = NOW()
         WHERE stripe_event_id = ?`,
        [event.id],
      );
      return res.json({ received: true, ignored: true });
    }

    await markStripeWebhookEventProcessed(pool, event.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe:webhook] handler error:", err);
    try {
      await markStripeWebhookEventFailed(pool, event.id, message);
    } catch (markErr) {
      console.error("[stripe:webhook] failed to mark event failed:", markErr);
    }
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  res.json({ received: true });
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
  return new Promise<void>((resolve, reject) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    res.on("error", reject);
    try {
      app(req as any, res as any);
    } catch (err) {
      reject(err);
    }
  }).catch((err) => {
    console.error("[Vercel handler]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "A server error has occurred" });
    }
  });
}

export function createServer() {
  return buildApp();
}
