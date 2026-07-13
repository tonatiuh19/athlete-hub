import type { EventExtraScopeType } from "@shared/api";

export const FOLIO_PATTERN_TOKEN_IDS = [
  "PREFIX",
  "CAT",
  "YEAR",
  "COUPON",
  "SEQ",
  "EVENT",
] as const;

export type FolioPatternTokenId = (typeof FOLIO_PATTERN_TOKEN_IDS)[number];

export type FolioCouponScope = "any" | "none" | "any_coupon" | "specific_coupon";

export type FolioCounterScope = "segment" | "event" | "category";

export type FolioPatternPart =
  | { kind: "token"; token: FolioPatternTokenId }
  | { kind: "literal"; value: string };

export interface FolioSegmentMatchInput {
  categoryId: number;
  discountCodeId?: number | null;
}

export interface FolioSegmentRule {
  id?: number;
  sort_order: number;
  is_active?: boolean;
  category_scope: EventExtraScopeType;
  category_ids?: number[];
  coupon_scope: FolioCouponScope;
  discount_code_id?: number | null;
  counter_scope?: FolioCounterScope;
  prefix_value?: string;
  category_code?: string;
  pattern_tokens?: FolioPatternPart[];
  seq_padding?: number;
  start_number?: number;
}

export interface FolioRenderContext {
  prefix_value: string;
  category_code: string;
  event_year?: string | null;
  coupon_code?: string | null;
  event_code?: string | null;
  sequence: number;
  seq_padding: number;
}

export interface FolioSegmentPatternConfig {
  prefix_value: string;
  category_code: string;
  pattern_tokens: FolioPatternPart[];
  seq_padding: number;
}

const TOKEN_SET = new Set<string>(FOLIO_PATTERN_TOKEN_IDS);

export function isFolioPatternTokenId(value: string): value is FolioPatternTokenId {
  return TOKEN_SET.has(value);
}

export function normalizeFolioPatternParts(raw: unknown): FolioPatternPart[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ kind: "token", token: "PREFIX" }, { kind: "token", token: "SEQ" }];
  }

  const parts: FolioPatternPart[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (isFolioPatternTokenId(trimmed)) {
        parts.push({ kind: "token", token: trimmed });
      } else {
        parts.push({ kind: "literal", value: item });
      }
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.kind === "token" && isFolioPatternTokenId(String(obj.token))) {
        parts.push({ kind: "token", token: obj.token as FolioPatternTokenId });
        continue;
      }
      if (obj.kind === "literal") {
        parts.push({ kind: "literal", value: String(obj.value ?? "") });
        continue;
      }
      if (isFolioPatternTokenId(String(obj.token ?? obj.id ?? ""))) {
        parts.push({
          kind: "token",
          token: String(obj.token ?? obj.id) as FolioPatternTokenId,
        });
        continue;
      }
      if (obj.value != null) {
        parts.push({ kind: "literal", value: String(obj.value) });
      }
    }
  }

  return parts.length > 0
    ? parts
    : [{ kind: "token", token: "PREFIX" }, { kind: "token", token: "SEQ" }];
}

export function serializeFolioPatternParts(parts: FolioPatternPart[]): FolioPatternPart[] {
  return normalizeFolioPatternParts(parts);
}

export function folioPatternPreview(
  config: FolioSegmentPatternConfig,
  sample: Partial<FolioRenderContext> = {},
): string {
  const ctx: FolioRenderContext = {
    prefix_value: config.prefix_value,
    category_code: config.category_code,
    event_year: sample.event_year ?? String(new Date().getFullYear()),
    coupon_code: sample.coupon_code ?? "EARLY",
    event_code: sample.event_code ?? "0042",
    sequence: sample.sequence ?? 1,
    seq_padding: config.seq_padding,
  };
  return renderFolioPattern(config.pattern_tokens, ctx);
}

export function renderFolioPattern(
  parts: FolioPatternPart[],
  ctx: FolioRenderContext,
): string {
  const normalized = normalizeFolioPatternParts(parts);
  let out = "";
  for (const part of normalized) {
    if (part.kind === "literal") {
      out += part.value;
      continue;
    }
    switch (part.token) {
      case "PREFIX":
        out += ctx.prefix_value;
        break;
      case "CAT":
        out += ctx.category_code;
        break;
      case "YEAR":
        out += ctx.event_year ?? "";
        break;
      case "COUPON":
        out += ctx.coupon_code ?? "";
        break;
      case "SEQ":
        out += String(ctx.sequence).padStart(Math.max(1, ctx.seq_padding), "0");
        break;
      case "EVENT":
        out += ctx.event_code ?? "";
        break;
      default:
        break;
    }
  }
  return out.slice(0, 30);
}

export function segmentMatchesRegistration(
  segment: FolioSegmentRule,
  input: FolioSegmentMatchInput,
): boolean {
  if (segment.is_active === false) return false;

  const scope = segment.category_scope ?? "all_categories";
  if (scope === "selected_categories") {
    const ids = segment.category_ids ?? [];
    if (!ids.includes(input.categoryId)) return false;
  }

  const couponScope = segment.coupon_scope ?? "any";
  const hasCoupon = input.discountCodeId != null && Number(input.discountCodeId) > 0;

  switch (couponScope) {
    case "none":
      if (hasCoupon) return false;
      break;
    case "any_coupon":
      if (!hasCoupon) return false;
      break;
    case "specific_coupon": {
      const targetId = Number(segment.discount_code_id);
      if (!targetId || !hasCoupon || Number(input.discountCodeId) !== targetId) {
        return false;
      }
      break;
    }
    case "any":
    default:
      break;
  }

  return true;
}

export function findMatchingFolioSegment<T extends FolioSegmentRule>(
  segments: T[],
  input: FolioSegmentMatchInput,
): T | null {
  const ordered = [...segments].sort(
    (a, b) => Number(a.sort_order) - Number(b.sort_order),
  );
  for (const segment of ordered) {
    if (segmentMatchesRegistration(segment, input)) {
      return segment;
    }
  }
  return null;
}

export function legacyRegistrationNumber(eventId: number, sequence: number): string {
  return `REG-${String(eventId).padStart(4, "0")}-${String(sequence).padStart(5, "0")}`;
}

export function folioCounterScopeKey(
  counterScope: FolioCounterScope,
  segmentId: number,
  categoryId: number,
): string {
  switch (counterScope) {
    case "event":
      return "event";
    case "category":
      return `cat:${categoryId}`;
    case "segment":
    default:
      return `seg:${segmentId}`;
  }
}

type SegmentOverlapKey = string;

function segmentOverlapKey(segment: FolioSegmentRule): SegmentOverlapKey {
  const cats =
    segment.category_scope === "selected_categories"
      ? [...(segment.category_ids ?? [])].sort((a, b) => a - b).join(",")
      : "*";
  const coupon =
    segment.coupon_scope === "specific_coupon"
      ? `specific:${segment.discount_code_id ?? 0}`
      : segment.coupon_scope;
  return `${cats}|${coupon}`;
}

/** Returns segment ids (by sort order) that are shadowed by an earlier rule with the same scope key. */
export function findShadowedFolioSegmentIds(segments: FolioSegmentRule[]): number[] {
  const ordered = [...segments]
    .filter((s) => s.is_active !== false && s.id != null)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));

  const seen = new Set<SegmentOverlapKey>();
  const shadowed: number[] = [];

  for (const segment of ordered) {
    const key = segmentOverlapKey(segment);
    if (seen.has(key)) {
      shadowed.push(Number(segment.id));
    } else {
      seen.add(key);
    }
  }

  return shadowed;
}

export const FOLIO_PATTERN_PRESETS: Array<{
  id: string;
  labelKey: string;
  parts: FolioPatternPart[];
}> = [
  {
    id: "prefix_seq",
    labelKey: "staffPortal.folioSegments.presetPrefixSeq",
    parts: [
      { kind: "token", token: "PREFIX" },
      { kind: "token", token: "SEQ" },
    ],
  },
  {
    id: "cat_seq",
    labelKey: "staffPortal.folioSegments.presetCatSeq",
    parts: [
      { kind: "token", token: "CAT" },
      { kind: "literal", value: "-" },
      { kind: "token", token: "SEQ" },
    ],
  },
  {
    id: "cat_year_seq",
    labelKey: "staffPortal.folioSegments.presetCatYearSeq",
    parts: [
      { kind: "token", token: "CAT" },
      { kind: "literal", value: "-" },
      { kind: "token", token: "YEAR" },
      { kind: "literal", value: "-" },
      { kind: "token", token: "SEQ" },
    ],
  },
  {
    id: "prefix_cat_seq",
    labelKey: "staffPortal.folioSegments.presetPrefixCatSeq",
    parts: [
      { kind: "token", token: "PREFIX" },
      { kind: "token", token: "CAT" },
      { kind: "literal", value: "-" },
      { kind: "token", token: "SEQ" },
    ],
  },
];
