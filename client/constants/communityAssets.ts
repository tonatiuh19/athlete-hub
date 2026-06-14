export const DEFAULT_COMMUNITY_COVER =
  "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80&auto=format&fit=crop";

export function communityCoverUrl(avatarUrl?: string | null): string {
  return avatarUrl?.trim() || DEFAULT_COMMUNITY_COVER;
}

export function communityInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
