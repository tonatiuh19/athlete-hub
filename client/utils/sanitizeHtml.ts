import DOMPurify from "dompurify";

/** Sanitize organizer-authored HTML before rendering in the client. */
export function sanitizeHtml(html: string): string {
  if (!html?.trim()) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  });
}
