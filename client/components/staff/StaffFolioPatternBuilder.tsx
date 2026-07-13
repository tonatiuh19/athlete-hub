import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
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
import {
  FOLIO_PATTERN_PRESETS,
  FOLIO_PATTERN_TOKEN_IDS,
  folioPatternPreview,
  type FolioPatternPart,
  type FolioPatternTokenId,
} from "@shared/folioSegments";

export interface StaffFolioPatternBuilderProps {
  prefixValue: string;
  categoryCode: string;
  patternTokens: FolioPatternPart[];
  seqPadding: number;
  onPrefixChange: (value: string) => void;
  onCategoryCodeChange: (value: string) => void;
  onPatternChange: (parts: FolioPatternPart[]) => void;
  onSeqPaddingChange: (value: number) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const TOKEN_LABEL_KEYS: Record<FolioPatternTokenId, string> = {
  PREFIX: "staffPortal.folioSegments.tokenPrefix",
  CAT: "staffPortal.folioSegments.tokenCat",
  YEAR: "staffPortal.folioSegments.tokenYear",
  COUPON: "staffPortal.folioSegments.tokenCoupon",
  SEQ: "staffPortal.folioSegments.tokenSeq",
  EVENT: "staffPortal.folioSegments.tokenEvent",
};

function movePart(parts: FolioPatternPart[], index: number, direction: -1 | 1): FolioPatternPart[] {
  const next = [...parts];
  const target = index + direction;
  if (target < 0 || target >= next.length) return parts;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function StaffFolioPatternBuilder({
  prefixValue,
  categoryCode,
  patternTokens,
  seqPadding,
  onPrefixChange,
  onCategoryCodeChange,
  onPatternChange,
  onSeqPaddingChange,
  t,
}: StaffFolioPatternBuilderProps) {
  const preview = folioPatternPreview({
    prefix_value: prefixValue,
    category_code: categoryCode,
    pattern_tokens: patternTokens,
    seq_padding: seqPadding,
  });

  const addToken = (token: FolioPatternTokenId) => {
    onPatternChange([...patternTokens, { kind: "token", token }]);
  };

  const addLiteral = () => {
    onPatternChange([...patternTokens, { kind: "literal", value: "-" }]);
  };

  const updateLiteral = (index: number, value: string) => {
    const next = [...patternTokens];
    next[index] = { kind: "literal", value: value.slice(0, 8) };
    onPatternChange(next);
  };

  const removePart = (index: number) => {
    onPatternChange(patternTokens.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/70 p-4">
      <div>
        <h3 className="text-sm font-semibold">{t("staffPortal.folioSegments.patternTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t("staffPortal.folioSegments.patternSubtitle")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("staffPortal.folioSegments.prefixValue")}</Label>
          <Input
            value={prefixValue}
            onChange={(e) => onPrefixChange(e.target.value.toUpperCase().slice(0, 24))}
            placeholder="RMX"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("staffPortal.folioSegments.categoryCode")}</Label>
          <Input
            value={categoryCode}
            onChange={(e) => onCategoryCodeChange(e.target.value.toUpperCase().slice(0, 24))}
            placeholder="5K"
            className="font-mono"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FOLIO_PATTERN_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onPatternChange(preset.parts)}
          >
            {t(preset.labelKey)}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{t("staffPortal.folioSegments.patternParts")}</Label>
        {patternTokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("staffPortal.folioSegments.patternEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {patternTokens.map((part, index) => (
              <div
                key={`${index}-${part.kind}`}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-2"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                {part.kind === "token" ? (
                  <span className="text-sm font-mono flex-1">
                    {t(TOKEN_LABEL_KEYS[part.token])}
                  </span>
                ) : (
                  <Input
                    className="flex-1 font-mono h-8"
                    value={part.value}
                    onChange={(e) => updateLiteral(index, e.target.value)}
                    placeholder="-"
                  />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  disabled={index === 0}
                  onClick={() => onPatternChange(movePart(patternTokens, index, -1))}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  disabled={index === patternTokens.length - 1}
                  onClick={() => onPatternChange(movePart(patternTokens, index, 1))}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  onClick={() => removePart(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FOLIO_PATTERN_TOKEN_IDS.map((token) => (
          <Button
            key={token}
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => addToken(token)}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t(TOKEN_LABEL_KEYS[token])}
          </Button>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={addLiteral}>
          <Plus className="w-3 h-3 mr-1" />
          {t("staffPortal.folioSegments.addSeparator")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("staffPortal.folioSegments.seqPadding")}</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={seqPadding}
            onChange={(e) => onSeqPaddingChange(Math.min(10, Math.max(1, Number(e.target.value) || 5)))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("staffPortal.folioSegments.preview")}</Label>
          <div className="h-10 flex items-center rounded-md border border-border/70 bg-muted/30 px-3 font-mono text-sm">
            {preview || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
