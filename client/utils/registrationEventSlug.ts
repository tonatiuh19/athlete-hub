/** Public marketplace slug from URL — ignores staff console paths like /staff/events/new. */
export function resolvePublicEventSlugFromPathname(pathname: string): string | null {
  const pathMatch = pathname.match(/^\/events\/([^/]+)(?:\/|$)/);
  if (!pathMatch?.[1]) return null;
  const slug = pathMatch[1];
  if (slug === "browse" || slug === "register") return null;
  return slug;
}
