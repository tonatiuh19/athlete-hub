/** Public marketplace pages that keep the floating mobile tab bar visible. */
const PUBLIC_TAB_BAR_PATTERNS = [
  /^\/$/,
  /^\/events(\/|$)/,
  /^\/communities(\/|$)/,
  /^\/blog(\/|$)/,
] as const;

export function shouldShowPublicMobileTabBar(pathname: string): boolean {
  return PUBLIC_TAB_BAR_PATTERNS.some((pattern) => pattern.test(pathname));
}
