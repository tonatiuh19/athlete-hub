export function formatEventDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatPriceMxn(cents: number, locale: string): string {
  return `$${(cents / 100).toLocaleString(locale === "es" ? "es-MX" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} MXN`;
}
