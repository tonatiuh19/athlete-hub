import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import StaffCategoryScopePicker from "@/components/staff/StaffCategoryScopePicker";
import StaffFolioPatternBuilder from "@/components/staff/StaffFolioPatternBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  FolioCounterScope,
  FolioCouponScope,
  StaffDiscountCodeRow,
  StaffEventCategory,
  StaffFolioSegmentInput,
  StaffFolioSegmentRow,
} from "@shared/api";
import {
  findShadowedFolioSegmentIds,
  normalizeFolioPatternParts,
  type FolioPatternPart,
} from "@shared/folioSegments";

export function createEmptyFolioSegmentDraft(sortOrder: number): StaffFolioSegmentInput {
  return {
    name: "",
    sort_order: sortOrder,
    is_active: true,
    category_scope: "all_categories",
    category_ids: [],
    coupon_scope: "any",
    discount_code_id: null,
    counter_scope: "segment",
    prefix_value: "",
    category_code: "",
    pattern_tokens: [
      { kind: "token", token: "PREFIX" },
      { kind: "literal", value: "-" },
      { kind: "token", token: "SEQ" },
    ],
    seq_padding: 5,
    start_number: 1,
  };
}

function segmentRowToDraft(row: StaffFolioSegmentRow): StaffFolioSegmentInput {
  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order,
    is_active: row.is_active,
    category_scope: row.category_scope,
    category_ids: row.category_ids ?? [],
    coupon_scope: row.coupon_scope,
    discount_code_id: row.discount_code_id ?? null,
    counter_scope: row.counter_scope,
    prefix_value: row.prefix_value,
    category_code: row.category_code,
    pattern_tokens: normalizeFolioPatternParts(row.pattern_tokens),
    seq_padding: row.seq_padding,
    start_number: row.start_number,
  };
}

function moveSegment(
  segments: StaffFolioSegmentInput[],
  index: number,
  direction: -1 | 1,
): StaffFolioSegmentInput[] {
  const next = [...segments];
  const target = index + direction;
  if (target < 0 || target >= next.length) return segments;
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((segment, sort_order) => ({ ...segment, sort_order }));
}

export interface StaffEventFolioSegmentsSectionProps {
  segments: StaffFolioSegmentRow[];
  categories: StaffEventCategory[];
  discountCodes: StaffDiscountCodeRow[];
  saving?: boolean;
  error?: string | null;
  onSave: (segments: StaffFolioSegmentInput[]) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export default function StaffEventFolioSegmentsSection({
  segments,
  categories,
  discountCodes,
  saving = false,
  error,
  onSave,
  t,
}: StaffEventFolioSegmentsSectionProps) {
  const [drafts, setDrafts] = useState<StaffFolioSegmentInput[]>(() =>
    segments.length > 0
      ? segments.map(segmentRowToDraft)
      : [],
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    segments.length > 0 ? 0 : null,
  );

  useEffect(() => {
    setDrafts(
      segments.length > 0 ? segments.map(segmentRowToDraft) : [],
    );
    setExpandedIndex(segments.length > 0 ? 0 : null);
  }, [segments]);

  const shadowedIds = useMemo(
    () =>
      new Set(
        findShadowedFolioSegmentIds(
          drafts.map((segment, index) => ({
            id: segment.id ?? -(index + 1),
            sort_order: segment.sort_order,
            is_active: segment.is_active,
            category_scope: segment.category_scope ?? "all_categories",
            category_ids: segment.category_ids,
            coupon_scope: segment.coupon_scope,
            discount_code_id: segment.discount_code_id,
          })),
        ),
      ),
    [drafts],
  );

  const updateDraft = (index: number, patch: Partial<StaffFolioSegmentInput>) => {
    setDrafts((current) =>
      current.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)),
    );
  };

  const updatePattern = (index: number, pattern_tokens: FolioPatternPart[]) => {
    updateDraft(index, { pattern_tokens });
  };

  const handleAdd = () => {
    const next = [...drafts, createEmptyFolioSegmentDraft(drafts.length)];
    setDrafts(next);
    setExpandedIndex(next.length - 1);
  };

  const handleRemove = (index: number) => {
    const next = drafts
      .filter((_, i) => i !== index)
      .map((segment, sort_order) => ({ ...segment, sort_order }));
    setDrafts(next);
    setExpandedIndex(next.length === 0 ? null : Math.min(index, next.length - 1));
  };

  const canSave = drafts.every(
    (segment) =>
      segment.name.trim() &&
      segment.counter_scope &&
      (segment.coupon_scope !== "specific_coupon" || segment.discount_code_id) &&
      (segment.category_scope !== "selected_categories" ||
        (segment.category_ids?.length ?? 0) > 0),
  );

  return (
    <div className="card-sport p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{t("staffPortal.folioSegments.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("staffPortal.folioSegments.subtitle")}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("staffPortal.folioSegments.empty")}</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((segment, index) => {
            const isExpanded = expandedIndex === index;
            const isShadowed = segment.id != null && shadowedIds.has(segment.id);
            return (
              <div
                key={segment.id ?? `draft-${index}`}
                className={cn(
                  "rounded-xl border border-border/70 overflow-hidden",
                  isShadowed && "border-destructive/40",
                )}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {segment.name.trim() || t("staffPortal.folioSegments.unnamed")}
                    </p>
                    {isShadowed ? (
                      <p className="text-xs text-destructive">
                        {t("staffPortal.folioSegments.shadowedWarning")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrafts(moveSegment(drafts, index, -1));
                      }}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === drafts.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrafts(moveSegment(drafts, index, 1));
                      }}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(index);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-border/60 p-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("staffPortal.folioSegments.ruleName")}</Label>
                        <Input
                          value={segment.name}
                          onChange={(e) => updateDraft(index, { name: e.target.value })}
                          placeholder={t("staffPortal.folioSegments.ruleNamePlaceholder")}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("staffPortal.folioSegments.counterScope")}</Label>
                        <Select
                          value={segment.counter_scope}
                          onValueChange={(value) =>
                            updateDraft(index, {
                              counter_scope: value as FolioCounterScope,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="segment">
                              {t("staffPortal.folioSegments.counterSegment")}
                            </SelectItem>
                            <SelectItem value="event">
                              {t("staffPortal.folioSegments.counterEvent")}
                            </SelectItem>
                            <SelectItem value="category">
                              {t("staffPortal.folioSegments.counterCategory")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <StaffCategoryScopePicker
                      scopeType={segment.category_scope ?? "all_categories"}
                      categoryIds={segment.category_ids ?? []}
                      categories={categories}
                      onChange={(patch) => updateDraft(index, patch)}
                      t={t}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("staffPortal.folioSegments.couponScope")}</Label>
                        <Select
                          value={segment.coupon_scope}
                          onValueChange={(value) =>
                            updateDraft(index, {
                              coupon_scope: value as FolioCouponScope,
                              discount_code_id:
                                value === "specific_coupon"
                                  ? segment.discount_code_id
                                  : null,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">{t("staffPortal.folioSegments.couponAny")}</SelectItem>
                            <SelectItem value="none">{t("staffPortal.folioSegments.couponNone")}</SelectItem>
                            <SelectItem value="any_coupon">
                              {t("staffPortal.folioSegments.couponAnyUsed")}
                            </SelectItem>
                            <SelectItem value="specific_coupon">
                              {t("staffPortal.folioSegments.couponSpecific")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {segment.coupon_scope === "specific_coupon" ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("staffPortal.folioSegments.couponCode")}</Label>
                          <Select
                            value={
                              segment.discount_code_id
                                ? String(segment.discount_code_id)
                                : ""
                            }
                            onValueChange={(value) =>
                              updateDraft(index, {
                                discount_code_id: Number(value),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("staffPortal.folioSegments.selectCoupon")} />
                            </SelectTrigger>
                            <SelectContent>
                              {discountCodes.map((code) => (
                                <SelectItem key={code.id} value={String(code.id)}>
                                  {code.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("staffPortal.folioSegments.startNumber")}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={segment.start_number ?? 1}
                          onChange={(e) =>
                            updateDraft(index, {
                              start_number: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      <div className="flex items-end gap-2 min-h-10 pb-1">
                        <Checkbox
                          id={`folio-active-${index}`}
                          checked={segment.is_active !== false}
                          onCheckedChange={(checked) =>
                            updateDraft(index, { is_active: checked === true })
                          }
                        />
                        <Label htmlFor={`folio-active-${index}`} className="text-sm font-normal">
                          {t("staffPortal.folioSegments.active")}
                        </Label>
                      </div>
                    </div>

                    <StaffFolioPatternBuilder
                      prefixValue={segment.prefix_value ?? ""}
                      categoryCode={segment.category_code ?? ""}
                      patternTokens={normalizeFolioPatternParts(segment.pattern_tokens)}
                      seqPadding={segment.seq_padding ?? 5}
                      onPrefixChange={(value) => updateDraft(index, { prefix_value: value })}
                      onCategoryCodeChange={(value) => updateDraft(index, { category_code: value })}
                      onPatternChange={(parts) => updatePattern(index, parts)}
                      onSeqPaddingChange={(value) => updateDraft(index, { seq_padding: value })}
                      t={t}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t("staffPortal.folioSegments.addRule")}
        </Button>
        <Button
          type="button"
          onClick={() => onSave(drafts)}
          disabled={saving || !canSave}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {t("staffPortal.folioSegments.save")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("staffPortal.folioSegments.fallbackNote")}</p>
    </div>
  );
}
