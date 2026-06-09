/**
 * URL-safe slug generation (Spanish diacritics, shared client + server).
 */
export function slugify(text: string, maxLen = 180): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
}

/** Normalize slug input; empty string if nothing valid remains. */
export function normalizeBlogSlug(input: string, maxLen = 180): string {
  return slugify(String(input ?? "").trim(), maxLen);
}

/** Prefer manual slug when set; otherwise derive from title; fallback `post`. */
export function resolveBlogSlug(title: string, manualSlug?: string | null): string {
  const fromManual = manualSlug?.trim() ? normalizeBlogSlug(manualSlug) : "";
  if (fromManual) return fromManual;
  const fromTitle = normalizeBlogSlug(title);
  return fromTitle || "post";
}

export const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidBlogSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 180 && BLOG_SLUG_PATTERN.test(slug);
}
