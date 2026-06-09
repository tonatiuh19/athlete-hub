import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  validateEventAssetFile,
  type EventAssetKind,
} from "@/utils/eventAssetValidation";
import { cn } from "@/lib/utils";

export interface EventAssetUploadProps {
  kind: EventAssetKind;
  previewUrl: string | null;
  fileName?: string | null;
  onSelectFile: (file: File) => void;
  onClear: () => void;
  compact?: boolean;
  className?: string;
}

export default function EventAssetUpload({
  kind,
  previewUrl,
  fileName,
  onSelectFile,
  onClear,
  compact = false,
  className,
}: EventAssetUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const accept =
    kind === "image"
      ? "image/jpeg,image/png,image/webp,image/gif"
      : kind === "document"
        ? "application/pdf,.pdf"
        : ".gpx,application/gpx+xml,application/xml,text/xml";

  const handleFile = (file: File) => {
    const validationError = validateEventAssetFile(file, kind, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSelectFile(file);
  };

  const isImagePreview = kind === "image" && Boolean(previewUrl);

  return (
    <div className={cn("space-y-2", className)}>
      {!compact && isImagePreview ? (
        <div className="relative rounded-lg border border-border overflow-hidden">
          <img src={previewUrl!} alt="" className="w-full h-24 object-cover" />
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-background/80 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30">
            {t("staffPortal.eventEdit.assetPreviewBadge")}
          </span>
        </div>
      ) : !compact && fileName ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          <FileText className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate">{fileName}</span>
        </div>
      ) : !compact ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          <ImageIcon className="w-5 h-5 text-primary shrink-0" />
          <span>{t(`staffPortal.eventEdit.assetHint.${kind}`)}</span>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!compact ? (
        <p className="text-xs text-muted-foreground">
          {t("staffPortal.eventEdit.assetUploadOnSave")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {previewUrl || fileName
            ? t("staffPortal.eventEdit.assetReplace")
            : t("staffPortal.eventEdit.assetUpload")}
        </Button>
        {previewUrl || fileName ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {t("staffPortal.eventEdit.assetRemove")}
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
