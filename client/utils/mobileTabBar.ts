/** Public marketplace pages that keep the floating mobile tab bar visible. */
const PUBLIC_TAB_BAR_PATTERNS = [
  /^\/$/,
  /^\/events\/?$/,
  /^\/communities(\/|$)/,
  /^\/blog(\/|$)/,
] as const;

/** Never show the public tab bar on authenticated consoles or auth flows. */
const TAB_BAR_DENY_PATTERNS = [
  /^\/staff(\/|$)/,
  /^\/portal(\/|$)/,
  /^\/login(\/|$)/,
  /^\/sso-callback/,
] as const;

/** Immersive public pages where the bottom nav overlaps maps and CTAs. */
const EVENT_DETAIL_PATTERN = /^\/events\/[^/]+$/;

export function shouldShowPublicMobileTabBar(
  pathname: string,
  options?: { staffSessionActive?: boolean; athleteSessionActive?: boolean },
): boolean {
  if (options?.staffSessionActive || options?.athleteSessionActive) return false;
  if (TAB_BAR_DENY_PATTERNS.some((pattern) => pattern.test(pathname))) return false;
  if (EVENT_DETAIL_PATTERN.test(pathname)) return false;
  return PUBLIC_TAB_BAR_PATTERNS.some((pattern) => pattern.test(pathname));
}
