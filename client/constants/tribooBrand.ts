/** Triboo Sport — Manual de Marca (palette & logo paths) */

export const TRIBOO_COLORS = {
  black: "#05070D",
  white: "#FFFFFF",
  orange: "#FF5A1F",
  red: "#F23C35",
} as const;

export const TRIBOO_GRADIENT =
  "linear-gradient(135deg, #FF5A1F 0%, #F23C35 100%)" as const;

export const ATHLETE_LOGIN_VIDEO_URL =
  "https://disruptinglabs.com/data/athlete-hub/assets/videos/12510392-sd_960_540_30fps.mp4";

/** Staff portal login — separate clip until a dedicated asset is provided */
export const STAFF_LOGIN_VIDEO_URL =
  "https://disruptinglabs.com/data/athlete-hub/assets/videos/3245304-sd_960_540_25fps.mp4";

const CDN =
  "https://disruptinglabs.com/data/triboo/assets/images/logos" as const;

/** Served from `/public/brand/logos/` (Vite root `public/`, not `client/public/`) */
export const TRIBOO_LOGOS = {
  symbolOrange: "/brand/logos/triboo_logo_orange.png",
  symbolWhite: "/brand/logos/triboo_logo_white.png",
  symbolDark: "/brand/logos/triboo_logo_dark.png",
  horizontalWhite: "/brand/logos/triboo_logo_white_horizontal.png",
  horizontalOrangeWhiteTitle:
    "/brand/logos/triboo_logo_orange_horizontal_white_title.png",
  horizontalOrangeDarkTitle:
    "/brand/logos/triboo_logo_orange_horizontal_dark_title.png",
  horizontalDark: "/brand/logos/triboo_logo_dark_horizontal.png",
  verticalWhite: "/brand/logos/triboo_logo_white_vertical.png",
  verticalOrangeWhiteTitle:
    "/brand/logos/triboo_logo_orange_vertical_white_title.png",
  verticalOrangeDarkTitle:
    "/brand/logos/triboo_logo_orange_vertical_dark_title.png",
} as const;

/** CDN fallbacks when local static file is missing */
export const TRIBOO_LOGOS_CDN = {
  symbolOrange: `${CDN}/triboo_logo_orange.png`,
  symbolWhite: `${CDN}/triboo_logo_white.png`,
  symbolDark: `${CDN}/triboo_logo_dark.png`,
  horizontalWhite: `${CDN}/triboo_logo_white_horizontal.png`,
  horizontalOrangeWhiteTitle: `${CDN}/triboo_logo_orange_horizontal_white_title.png`,
  horizontalOrangeDarkTitle: `${CDN}/triboo_logo_orange_horizontal_dark_title.png`,
  horizontalDark: `${CDN}/triboo_logo_dark_horizontal.png`,
  verticalWhite: `${CDN}/triboo_logo_white_vertical.png`,
  verticalOrangeWhiteTitle: `${CDN}/triboo_logo_orange_vertical_white_title.png`,
  verticalOrangeDarkTitle: `${CDN}/triboo_logo_orange_vertical_dark_title.png`,
} as const;

/**
 * Logo variants — always match background contrast (Manual de Marca):
 * - `horizontal-orange` → dark “TRIBOO” wordmark — use on **light** surfaces only
 * - `horizontal-white` → white “TRIBOO” wordmark — use on **dark** surfaces (video panel, nav, footer)
 * - `symbol-orange` / `symbol-white` — same rule for icon-only marks
 *
 * Prefer `surface="dark"` on Triboo backgrounds (`bg-background`, video panel, nav).
 * Use `surface="light"` only on explicit light cards. App root uses `class="dark"` on `<html>`.
 */
export type TribooLogoVariant =
  | "horizontal-white"
  | "horizontal-orange"
  | "horizontal-dark"
  | "symbol-orange"
  | "symbol-white";

export type TribooLogoSurface = "light" | "dark" | "auto";
export type TribooLogoMark = "horizontal" | "symbol";

export type TribooLogoAssetKey = keyof typeof TRIBOO_LOGOS;

const VARIANT_TO_KEY: Record<TribooLogoVariant, TribooLogoAssetKey> = {
  "horizontal-white": "horizontalOrangeWhiteTitle",
  "horizontal-orange": "horizontalOrangeDarkTitle",
  "horizontal-dark": "horizontalDark",
  "symbol-white": "symbolWhite",
  "symbol-orange": "symbolOrange",
};

/** Correct variant(s) for a background — `auto` returns light + dark pair for Tailwind `dark:` swap */
export function tribooLogoVariantsForSurface(
  surface: TribooLogoSurface,
  mark: TribooLogoMark = "horizontal",
): TribooLogoVariant | { light: TribooLogoVariant; dark: TribooLogoVariant } {
  const pair =
    mark === "symbol"
      ? ({ light: "symbol-orange", dark: "symbol-white" } as const)
      : ({ light: "horizontal-orange", dark: "horizontal-white" } as const);

  if (surface === "auto") return pair;
  return surface === "light" ? pair.light : pair.dark;
}

export function tribooLogoLocalSrc(variant: TribooLogoVariant): string {
  return TRIBOO_LOGOS[VARIANT_TO_KEY[variant]];
}

export function tribooLogoCdnSrc(variant: TribooLogoVariant): string {
  return TRIBOO_LOGOS_CDN[VARIANT_TO_KEY[variant]];
}
