import { marked } from "marked";
import {
  DEFAULT_LEGAL_ENTITY,
  type LegalDocumentId,
  type LegalEntityConfig,
} from "@shared/siteLegal";
import { normalizeLocale, type AppLocale } from "@shared/i18n";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { applyLegalTemplate } from "@/utils/legalTemplate";

import termsEs from "@/content/legal/es/terms-of-service.md?raw";
import termsEn from "@/content/legal/en/terms-of-service.md?raw";
import privacyEs from "@/content/legal/es/privacy-notice.md?raw";
import privacyEn from "@/content/legal/en/privacy-notice.md?raw";
import organizerTermsEs from "@/content/legal/es/organizer-terms.md?raw";
import organizerTermsEn from "@/content/legal/en/organizer-terms.md?raw";

const SOURCES: Record<LegalDocumentId, Record<AppLocale, string>> = {
  terms: { es: termsEs, en: termsEn },
  privacy: { es: privacyEs, en: privacyEn },
  "organizer-terms": { es: organizerTermsEs, en: organizerTermsEn },
};

export const LEGAL_DOCUMENT_IDS = Object.keys(SOURCES) as LegalDocumentId[];

export function isLegalDocumentId(value: string): value is LegalDocumentId {
  return LEGAL_DOCUMENT_IDS.includes(value as LegalDocumentId);
}

marked.setOptions({ gfm: true, breaks: false });

export function renderLegalMarkdown(
  markdown: string,
  entity: LegalEntityConfig = DEFAULT_LEGAL_ENTITY,
): string {
  const templated = applyLegalTemplate(markdown, entity);
  const html = marked.parse(templated, { async: false }) as string;
  return sanitizeHtml(html);
}

export function getLegalMarkdownSource(
  documentId: LegalDocumentId,
  locale: string,
): string {
  const lang = normalizeLocale(locale) as AppLocale;
  return SOURCES[documentId][lang] ?? SOURCES[documentId].es;
}

export function getLegalDocumentHtml(
  documentId: LegalDocumentId,
  locale: string,
  entity: LegalEntityConfig = DEFAULT_LEGAL_ENTITY,
): string {
  return renderLegalMarkdown(getLegalMarkdownSource(documentId, locale), entity);
}

export function getLegalDocumentTitle(
  documentId: LegalDocumentId,
  locale: string,
  entity: LegalEntityConfig = DEFAULT_LEGAL_ENTITY,
): string {
  const md = applyLegalTemplate(getLegalMarkdownSource(documentId, locale), entity);
  const match = md.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? documentId;
}
