import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Crop, FileText, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import EventImageCropDialog from "@/components/staff/EventImageCropDialog";
import { Button } from "@/components/ui/button";
import {
  validateEventAssetFile,
  type EventAssetKind,
} from "@/utils/eventAssetValidation";
import type { EventImageRole } from "@/constants/eventImageContexts";
import {
  EVENT_IMAGE_RECOMMENDED_DIMENSIONS,
} from "@/constants/eventImageContexts";
import { fetchRemoteImageAsFile, normalizeImageUploadFile } from "@/utils/eventImageUpload";
import { normalizeCdnUploadUrl } from "@/lib/cdn-url";
import { cn } from "@/lib/utils";

export interface EventAssetUploadProps {
  kind: EventAssetKind;
  previewUrl: string | null;
  fileName?: string | null;
  onSelectFile: (file: File) => void;
  onClear: () => void;
  compact?: boolean;
  className?: string;
  /** Enables crop + multi-context preview for image uploads */
  imageRole?: EventImageRole;
  /** Required for CDN re-crop via staff image proxy */
  staffIsAdmin?: boolean;
}

export default function EventAssetUpload({
  kind,
  previewUrl,
  fileName,
  onSelectFile,
  onClear,
  compact = false,
  className,
  imageRole,
  staffIsAdmin = false,
}: EventAssetUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [recropSourceFile, setRecropSourceFile] = useState<File | null>(null);
  const [recropLoading, setRecropLoading] = useState(false);
  const [stagingFile, setStagingFile] = useState(false);

  const accept =
    kind === "image"
      ? "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
      : kind === "document"
        ? "application/pdf,.pdf"
        : ".gpx,application/gpx+xml,application/xml,text/xml";

  const useCropFlow = kind === "image" && Boolean(imageRole);
  const recommendedSpec = imageRole ? EVENT_IMAGE_RECOMMENDED_DIMENSIONS[imageRole] : null;

  const openCropWithFile = (file: File) => {
    setPendingCropFile(file);
    setCropOpen(true);
  };

  const stageFile = async (file: File) => {
    const validationError = validateEventAssetFile(file, kind, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (useCropFlow && imageRole) {
      setStagingFile(true);
      try {
        const normalized = await normalizeImageUploadFile(file);
        openCropWithFile(normalized);
      } catch {
        setError(t("staffPortal.eventEdit.imageCrop.prepareFailed"));
      } finally {
        setStagingFile(false);
      }
      return;
    }

    onSelectFile(file);
  };

  const openRecrop = () => {
    const source = recropSourceFile ?? pendingCropFile;
    if (!source || !imageRole) return;
    openCropWithFile(source);
  };

  const resolvedPreviewUrl = normalizeCdnUploadUrl(previewUrl);

  const openRecropFromUrl = async () => {
    if (!imageRole || !resolvedPreviewUrl) return;
    if (recropSourceFile) {
      openRecrop();
      return;
    }
    setRecropLoading(true);
    setError(null);
    try {
      const remote = await fetchRemoteImageAsFile(
        resolvedPreviewUrl,
        imageRole,
        staffIsAdmin,
      );
      if (!remote) {
        setError(t("staffPortal.eventEdit.imageCrop.recropFailed"));
        return;
      }
      setRecropSourceFile(remote);
      openCropWithFile(remote);
    } finally {
      setRecropLoading(false);
    }
  };

  const isImagePreview = kind === "image" && Boolean(resolvedPreviewUrl);
  const previewAspectClass =
    imageRole === "sponsor"
      ? "h-24 object-contain bg-muted/20 p-3"
      : imageRole === "banner"
        ? "h-28 object-cover"
        : "h-24 object-cover";

  const canRecrop = useCropFlow && Boolean(recropSourceFile || resolvedPreviewUrl);
  const uploadBusy = stagingFile || recropLoading;

  return (
    <div className={cn("space-y-2", className)}>
      {!compact && isImagePreview ? (
        <div className="relative overflow-hidden rounded-lg border border-border">
          <img src={resolvedPreviewUrl!} alt="" className={cn("w-full", previewAspectClass)} />
          <span className="absolute top-2 right-2 rounded-full border border-primary/30 bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {t("staffPortal.eventEdit.assetPreviewBadge")}
          </span>
        </div>
      ) : !compact && fileName ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{fileName}</span>
        </div>
      ) : !compact ? (
        <div className="space-y-1.5 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 space-y-1">
              <p>{t(`staffPortal.eventEdit.assetHint.${kind}`)}</p>
              {recommendedSpec ? (
                <p className="text-xs leading-relaxed">
                  {t(`staffPortal.eventEdit.imageRecommended.${imageRole}`, {
                    width: recommendedSpec.width,
                    height: recommendedSpec.height,
                    ratio: recommendedSpec.ratio,
                    maxMb: recommendedSpec.maxFileMb,
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {compact && recommendedSpec ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t(`staffPortal.eventEdit.imageRecommended.${imageRole}`, {
            width: recommendedSpec.width,
            height: recommendedSpec.height,
            ratio: recommendedSpec.ratio,
            maxMb: recommendedSpec.maxFileMb,
          })}
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!compact ? (
        <p className="text-xs text-muted-foreground">
          {useCropFlow
            ? t("staffPortal.eventEdit.imageCrop.uploadHint")
            : t("staffPortal.eventEdit.assetUploadOnSave")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadBusy}
          onClick={() => inputRef.current?.click()}
        >
          {stagingFile ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          {previewUrl || fileName
            ? t("staffPortal.eventEdit.assetReplace")
            : t("staffPortal.eventEdit.assetUpload")}
        </Button>
        {canRecrop ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadBusy}
            onClick={() => void openRecropFromUrl()}
          >
            {recropLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crop className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("staffPortal.eventEdit.imageCrop.editCrop")}
          </Button>
        ) : null}
        {previewUrl || fileName ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploadBusy}
            onClick={() => {
              setRecropSourceFile(null);
              onClear();
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
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
          if (file) void stageFile(file);
          e.target.value = "";
        }}
      />

      {useCropFlow && imageRole ? (
        <EventImageCropDialog
          open={cropOpen}
          file={pendingCropFile}
          role={imageRole}
          onOpenChange={(nextOpen) => {
            setCropOpen(nextOpen);
            if (!nextOpen) setPendingCropFile(null);
          }}
          onConfirm={(file) => {
            setRecropSourceFile(pendingCropFile ?? file);
            onSelectFile(file);
            setPendingCropFile(null);
          }}
        />
      ) : null}
    </div>
  );
}
