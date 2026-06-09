import type { BlogPostPublic, BlogPostScope } from "@shared/api";

export type BlogOriginKind = "platform" | "organizer";

export interface BlogOriginInfo {
  kind: BlogOriginKind;
  organizerName?: string | null;
  organizerSlug?: string | null;
}

export function getBlogOrigin(post: Pick<
  BlogPostPublic,
  "scope" | "organizerName" | "organizerSlug"
>): BlogOriginInfo {
  if (post.scope === "organizer") {
    return {
      kind: "organizer",
      organizerName: post.organizerName,
      organizerSlug: post.organizerSlug,
    };
  }
  return { kind: "platform" };
}

/** Normalize app language to blog locale code (es | en). */
export function normalizeBlogLocale(language: string): "es" | "en" {
  return language.startsWith("en") ? "en" : "es";
}
