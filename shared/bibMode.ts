/**
 * Event policy: whether the registration folio is also the race bib (dorsal).
 * New events default to `folio`. Existing events migrate to `separate`.
 */
export type EventBibMode = "folio" | "separate";

export function isEventBibMode(value: unknown): value is EventBibMode {
  return value === "folio" || value === "separate";
}

/** Default for brand-new events. */
export const DEFAULT_EVENT_BIB_MODE: EventBibMode = "folio";

export function normalizeEventBibMode(raw: unknown): EventBibMode {
  return raw === "separate" ? "separate" : "folio";
}

/**
 * Resolve bib to store on a registration.
 * Explicit staff override always wins; otherwise folio mode copies the folio.
 * Bib column matches folio max length (30).
 */
export function resolveRegistrationBibNumber(opts: {
  registrationNumber: string;
  bibMode: EventBibMode;
  explicitBib?: string | null;
}): string | null {
  const explicit = String(opts.explicitBib ?? "")
    .trim()
    .slice(0, 30);
  if (explicit) return explicit;
  if (opts.bibMode === "folio") {
    const folio = String(opts.registrationNumber ?? "").trim().slice(0, 30);
    return folio || null;
  }
  return null;
}
