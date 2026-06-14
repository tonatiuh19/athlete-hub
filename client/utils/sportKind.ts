export type SportKind =
  | "running"
  | "trail"
  | "cycling"
  | "triathlon"
  | "hyrox"
  | "ocr"
  | "fitness"
  | "virtual"
  | "fishing"
  | "default";

export function resolveSportKind(sportSlug?: string, sportName?: string): SportKind {
  const slug = (sportSlug ?? "").toLowerCase();
  const name = (sportName ?? "").toLowerCase();
  const key = `${slug} ${name}`;

  if (slug === "trail" || key.includes("trail")) return "trail";
  if (slug === "cycling" || key.includes("cycl") || key.includes("bike") || key.includes("gran fondo"))
    return "cycling";
  if (slug === "triathlon" || key.includes("tri") || key.includes("ironman") || key.includes("swim"))
    return "triathlon";
  if (slug === "hyrox" || key.includes("hyrox")) return "hyrox";
  if (slug === "ocr" || key.includes("ocr") || key.includes("spartan")) return "ocr";
  if (slug === "fitness" || key.includes("fitness") || key.includes("crossfit")) return "fitness";
  if (slug === "virtual" || key.includes("virtual")) return "virtual";
  if (slug === "fishing" || key.includes("fish") || key.includes("pesca")) return "fishing";
  if (slug === "running" || key.includes("run") || key.includes("marathon") || key.includes("carrera"))
    return "running";

  return "default";
}

export interface SportPinTheme {
  fill: string;
  accent: string;
  icon: string;
}

/** Lucide-inspired 24×24 paths, stroke-based for crisp map pins */
const SPORT_ICONS: Record<SportKind, string> = {
  running: `<path d="M4 16l2.5-1 2 3.5 3-1.5V11l3.5-2 2 4 3.5 1.5-1 3-2.5-.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="1.5" fill="currentColor"/>`,
  trail: `<path d="M8 20l4-10 4 6 4-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  cycling: `<circle cx="6" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 17h3l2-5 2 3h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  triathlon: `<path d="M3 14c2-4 5-6 9-6s7 2 9 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 18c1.5 2 4 3 5 3s3.5-1 5-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  hyrox: `<path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ocr: `<path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  fitness: `<path d="M6 9v6M18 9v6M6 12H4v3h2M18 12h2v-3h-2M9 12h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  virtual: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 12h4M18 12h4M12 2v4M12 18v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  fishing: `<path d="M6.5 12c.94-3.46 4.03-6 8.5-6 1.56 0 3 .4 4.2 1.1L20 4v6h-6l2.2-2.2C14.8 7.4 13.5 7 12 7c-3.04 0-5.5 2.46-5.5 5.5 0 .83.18 1.62.5 2.33" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="14" r="2" fill="currentColor"/>`,
  default: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
};

const SPORT_THEMES: Record<SportKind, { fill: string; accent: string }> = {
  running: { fill: "#00BCD4", accent: "#00E5FF" },
  trail: { fill: "#00A152", accent: "#00E676" },
  cycling: { fill: "#651FFF", accent: "#7C4DFF" },
  triathlon: { fill: "#E65100", accent: "#FF9100" },
  hyrox: { fill: "#D50000", accent: "#FF5252" },
  ocr: { fill: "#FF8F00", accent: "#FFAB00" },
  fitness: { fill: "#2962FF", accent: "#448AFF" },
  virtual: { fill: "#7C4DFF", accent: "#B388FF" },
  fishing: { fill: "#00838F", accent: "#00BCD4" },
  default: { fill: "#0091EA", accent: "#00E5FF" },
};

/** Gradient surfaces for sport-type picker cards (semantic tokens only). */
export const SPORT_CARD_SURFACES: Record<SportKind, string> = {
  running: "bg-gradient-to-br from-primary/30 via-primary/10 to-card border-primary/25",
  trail: "bg-gradient-to-br from-accent/30 via-accent/10 to-card border-accent/25",
  cycling: "bg-gradient-to-br from-primary/25 via-secondary/50 to-card border-primary/20",
  triathlon: "bg-gradient-to-br from-primary/20 via-accent/15 to-card border-accent/20",
  hyrox: "bg-gradient-to-br from-destructive/25 via-card to-card border-destructive/25",
  ocr: "bg-gradient-to-br from-accent/25 via-secondary/40 to-card border-accent/20",
  fitness: "bg-gradient-to-br from-primary/25 via-primary/5 to-card border-primary/20",
  virtual: "bg-gradient-to-br from-secondary/80 via-card to-card border-border",
  fishing: "bg-gradient-to-br from-accent/30 via-primary/10 to-card border-accent/25",
  default: "bg-gradient-to-br from-primary/20 via-card to-card border-border",
};

export function getSportCardSurface(sportSlug?: string, sportName?: string): string {
  return SPORT_CARD_SURFACES[resolveSportKind(sportSlug, sportName)];
}

export function getSportPinTheme(
  sportSlug?: string,
  sportName?: string,
  featured?: boolean,
): SportPinTheme {
  const kind = resolveSportKind(sportSlug, sportName);
  const theme = SPORT_THEMES[kind];
  if (featured) {
    return {
      fill: "#F9A825",
      accent: "#FFD54F",
      icon: SPORT_ICONS[kind],
    };
  }
  return { ...theme, icon: SPORT_ICONS[kind] };
}
