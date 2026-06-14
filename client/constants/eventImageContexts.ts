export type EventImageRole = "hero" | "banner" | "sponsor" | "gallery";

export interface EventImageRecommendedDimensions {
  width: number;
  height: number;
  ratio: string;
  maxFileMb: number;
}

/** Recommended upload dimensions aligned with crop presets and CDN output limits. */
export const EVENT_IMAGE_RECOMMENDED_DIMENSIONS: Record<
  EventImageRole,
  EventImageRecommendedDimensions
> = {
  hero: { width: 1280, height: 800, ratio: "16:10", maxFileMb: 8 },
  banner: { width: 1600, height: 686, ratio: "21:9", maxFileMb: 8 },
  sponsor: { width: 1200, height: 400, ratio: "3:1", maxFileMb: 8 },
  gallery: { width: 1280, height: 960, ratio: "4:3", maxFileMb: 8 },
};

export interface EventImageAspectOption {
  id: string;
  labelKey: string;
  /** width / height; omit for free-form crop */
  aspect?: number;
}

export interface EventImagePreviewContext {
  id: string;
  labelKey: string;
  /** Tailwind aspect-* utility suffix, e.g. "16/10" */
  aspect: string;
  objectFit: "cover" | "contain";
  frameClass?: string;
  /** Decorative mock chrome matching the destination UI */
  variant:
    | "marketplace-card"
    | "home-featured"
    | "detail-hero"
    | "compact-list"
    | "search-thumb"
    | "sponsor-inline"
    | "sponsor-compact"
    | "gallery-standard"
    | "gallery-featured";
}

export const EVENT_IMAGE_ASPECT_OPTIONS: Record<EventImageRole, EventImageAspectOption[]> = {
  hero: [
    { id: "card", labelKey: "staffPortal.eventEdit.imageCrop.aspect.card", aspect: 16 / 10 },
    { id: "wide", labelKey: "staffPortal.eventEdit.imageCrop.aspect.wide", aspect: 21 / 9 },
    { id: "square", labelKey: "staffPortal.eventEdit.imageCrop.aspect.square", aspect: 1 },
  ],
  banner: [
    { id: "wide", labelKey: "staffPortal.eventEdit.imageCrop.aspect.banner", aspect: 21 / 9 },
    { id: "ultra", labelKey: "staffPortal.eventEdit.imageCrop.aspect.ultraWide", aspect: 3 / 1 },
    { id: "card", labelKey: "staffPortal.eventEdit.imageCrop.aspect.card", aspect: 16 / 10 },
  ],
  sponsor: [
    { id: "wide", labelKey: "staffPortal.eventEdit.imageCrop.aspect.logoWide", aspect: 3 / 1 },
    { id: "square", labelKey: "staffPortal.eventEdit.imageCrop.aspect.square", aspect: 1 },
    { id: "free", labelKey: "staffPortal.eventEdit.imageCrop.aspect.free" },
  ],
  gallery: [
    { id: "standard", labelKey: "staffPortal.eventEdit.imageCrop.aspect.standard", aspect: 4 / 3 },
    { id: "featured", labelKey: "staffPortal.eventEdit.imageCrop.aspect.card", aspect: 16 / 10 },
    { id: "square", labelKey: "staffPortal.eventEdit.imageCrop.aspect.square", aspect: 1 },
  ],
};

export const EVENT_IMAGE_PREVIEW_CONTEXTS: Record<EventImageRole, EventImagePreviewContext[]> = {
  hero: [
    {
      id: "marketplace-card",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.marketplaceCard",
      aspect: "16/10",
      objectFit: "cover",
      variant: "marketplace-card",
    },
    {
      id: "home-featured",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.homeFeatured",
      aspect: "16/10",
      objectFit: "cover",
      frameClass: "max-w-[220px]",
      variant: "home-featured",
    },
    {
      id: "detail-hero",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.detailHero",
      aspect: "21/9",
      objectFit: "cover",
      variant: "detail-hero",
    },
    {
      id: "compact-list",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.compactList",
      aspect: "1/1",
      objectFit: "cover",
      frameClass: "w-[120px]",
      variant: "compact-list",
    },
    {
      id: "search-thumb",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.searchThumb",
      aspect: "1/1",
      objectFit: "cover",
      frameClass: "w-11",
      variant: "search-thumb",
    },
  ],
  banner: [
    {
      id: "detail-hero",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.detailHero",
      aspect: "21/9",
      objectFit: "cover",
      variant: "detail-hero",
    },
    {
      id: "marketplace-card",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.marketplaceCard",
      aspect: "16/10",
      objectFit: "cover",
      variant: "marketplace-card",
    },
    {
      id: "og-share",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.ogShare",
      aspect: "1200/630",
      objectFit: "cover",
      variant: "detail-hero",
    },
  ],
  sponsor: [
    {
      id: "sponsor-inline",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.sponsorInline",
      aspect: "3/1",
      objectFit: "contain",
      frameClass: "h-8 max-w-[160px]",
      variant: "sponsor-inline",
    },
    {
      id: "sponsor-compact",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.sponsorCompact",
      aspect: "3/1",
      objectFit: "contain",
      frameClass: "h-10 max-w-[200px]",
      variant: "sponsor-compact",
    },
    {
      id: "sponsor-title",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.sponsorTitle",
      aspect: "2/1",
      objectFit: "contain",
      frameClass: "h-12 max-w-[240px]",
      variant: "sponsor-compact",
    },
  ],
  gallery: [
    {
      id: "gallery-standard",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.galleryStandard",
      aspect: "4/3",
      objectFit: "cover",
      variant: "gallery-standard",
    },
    {
      id: "gallery-featured",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.galleryFeatured",
      aspect: "16/10",
      objectFit: "cover",
      variant: "gallery-featured",
    },
    {
      id: "marketplace-card",
      labelKey: "staffPortal.eventEdit.imageCrop.preview.marketplaceCard",
      aspect: "16/10",
      objectFit: "cover",
      variant: "marketplace-card",
    },
  ],
};

export function resolveEventImageRole(assetType?: string): EventImageRole {
  switch (assetType?.toLowerCase()) {
    case "hero":
      return "hero";
    case "banner":
      return "banner";
    case "logo":
      return "sponsor";
    default:
      return "gallery";
  }
}
