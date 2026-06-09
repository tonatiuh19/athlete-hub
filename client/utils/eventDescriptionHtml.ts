/** True when stored content is TipTap/HTML rather than legacy plain text. */
export function eventDescriptionIsHtml(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return /<[a-z][\s\S]*>/i.test(text.trim());
}

/** Strip HTML tags for meta descriptions and JSON-LD. */
export function eventDescriptionPlainText(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  const stripped = text
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return stripped;
}

export function eventDescriptionHasContent(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  if (eventDescriptionIsHtml(text)) {
    return eventDescriptionPlainText(text).length > 0;
  }
  return true;
}

export function eventDescriptionPlainParagraphs(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
