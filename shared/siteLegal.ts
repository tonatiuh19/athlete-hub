/** Public site / legal entity fields — empty values are hidden in UI and legal docs. */

export type LegalEntityConfig = {
  brandName: string;
  legalName: string | null;
  rfc: string | null;
  address: string | null;
  arcoEmail: string | null;
  supportEmail: string | null;
  website: string | null;
  lastUpdated: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export type ContactPageConfig = {
  headline: string | null;
  subtitle: string | null;
  supportHint: string | null;
  organizerHint: string | null;
  responseTime: string | null;
  officeHours: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialYoutube: string | null;
};

export type SitePublicProfile = {
  legalEntity: LegalEntityConfig;
  contact: ContactPageConfig;
};

export const DEFAULT_LEGAL_ENTITY: LegalEntityConfig = {
  brandName: "Triboo Sport",
  legalName: "TRIBOO SPORT, S.A.P.I. DE C.V.",
  rfc: null,
  address: "Ciudad de México, México",
  arcoEmail: "privacidad@triboosport.com",
  supportEmail: "soporte@triboosport.com",
  website: "https://www.triboosport.com",
  lastUpdated: "2026-06-13",
  phone: null,
  whatsapp: null,
};

export const DEFAULT_CONTACT_PAGE: ContactPageConfig = {
  headline: null,
  subtitle: null,
  supportHint: null,
  organizerHint: null,
  responseTime: null,
  officeHours: null,
  socialInstagram: null,
  socialFacebook: null,
  socialYoutube: null,
};

export const DEFAULT_SITE_PUBLIC_PROFILE: SitePublicProfile = {
  legalEntity: DEFAULT_LEGAL_ENTITY,
  contact: DEFAULT_CONTACT_PAGE,
};

/** Placeholder tokens like `[RFC POR CONFIRMAR]` are treated as unpublished. */
export function isLegalFieldEmpty(value: unknown): boolean {
  if (value == null) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  if (/^\[[^\]]+\]$/.test(trimmed)) return true;
  return false;
}

export function legalFieldDisplay(value: unknown): string | null {
  if (isLegalFieldEmpty(value)) return null;
  return String(value).trim();
}

export function mergeLegalEntity(
  base: LegalEntityConfig,
  patch: Partial<LegalEntityConfig> | null | undefined,
): LegalEntityConfig {
  if (!patch) return { ...base };
  const merged = { ...base, ...patch };
  if (isLegalFieldEmpty(merged.brandName)) {
    merged.brandName = base.brandName;
  }
  return merged;
}

export function mergeContactPage(
  base: ContactPageConfig,
  patch: Partial<ContactPageConfig> | null | undefined,
): ContactPageConfig {
  if (!patch) return { ...base };
  return { ...base, ...patch };
}

export function mergeSitePublicProfile(
  stored: Partial<SitePublicProfile> | null | undefined,
): SitePublicProfile {
  return {
    legalEntity: mergeLegalEntity(
      DEFAULT_LEGAL_ENTITY,
      stored?.legalEntity ?? undefined,
    ),
    contact: mergeContactPage(DEFAULT_CONTACT_PAGE, stored?.contact ?? undefined),
  };
}

export type LegalDocumentId = "terms" | "privacy" | "organizer-terms";

export const LEGAL_ROUTES: Record<LegalDocumentId, string> = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  "organizer-terms": "/legal/organizer-terms",
};

/** @deprecated Use DEFAULT_LEGAL_ENTITY — kept for imports during transition */
export const LEGAL_ENTITY = DEFAULT_LEGAL_ENTITY;
