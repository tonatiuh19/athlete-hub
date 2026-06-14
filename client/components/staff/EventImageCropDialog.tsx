import { useCallback, useEffect, useMemo, useState } from "react";
import type { Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import EventImageCropWorkbench from "@/components/staff/EventImageCropWorkbench";
import EventImagePreviewColumn from "@/components/staff/EventImagePreviewColumn";
import {
  EVENT_IMAGE_ASPECT_OPTIONS,
  EVENT_IMAGE_PREVIEW_CONTEXTS,
  type EventImageRole,
} from "@/constants/eventImageContexts";
import { cropImageToFile } from "@/utils/imageCrop";
import { cn } from "@/lib/utils";

interface EventImageCropDialogProps {
  open: boolean;
  file: File | null;
  role: EventImageRole;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
}

export default function EventImageCropDialog({
  open,
  file,
  role,
  onOpenChange,
  onConfirm,
}: EventImageCropDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const aspectOptions = EVENT_IMAGE_ASPECT_OPTIONS[role];
  const previewContexts = EVENT_IMAGE_PREVIEW_CONTEXTS[role];

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [aspectId, setAspectId] = useState(aspectOptions[0]?.id ?? "card");
  const [croppedAreaPercent, setCroppedAreaPercent] = useState<Area | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedAspect = useMemo(
    () => aspectOptions.find((option) => option.id === aspectId) ?? aspectOptions[0],
    [aspectId, aspectOptions],
  );

  useEffect(() => {
    if (!open || !file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setAspectId(aspectOptions[0]?.id ?? "card");
    setCroppedAreaPercent(null);
    setCroppedAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [open, file, aspectOptions]);

  const handleCropAreaChange = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPercent(croppedArea);
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !file || !croppedAreaPixels) return;
    setSubmitting(true);
    try {
      const cropped = await cropImageToFile(imageSrc, croppedAreaPixels, file.name, {
        role,
        sourceType: file.type,
      });
      onConfirm(cropped);
      onOpenChange(false);
    } catch {
      toast({
        title: t("staffPortal.eventEdit.imageCrop.applyFailed"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[95dvh] w-[min(calc(100vw-1rem),960px)] max-w-none flex-col gap-0 overflow-hidden p-0",
          "data-[state=open]:animate-none data-[state=closed]:animate-none",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
          <DialogTitle>{t("staffPortal.eventEdit.imageCrop.title")}</DialogTitle>
          <DialogDescription>{t("staffPortal.eventEdit.imageCrop.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:overflow-hidden">
          <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-6">
              {aspectOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={aspectId === option.id ? "default" : "outline"}
                  onClick={() => setAspectId(option.id)}
                >
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>

            {imageSrc ? (
              <EventImageCropWorkbench
                key={`${imageSrc}-${aspectId}`}
                imageSrc={imageSrc}
                aspect={selectedAspect?.aspect}
                onCropAreaChange={handleCropAreaChange}
              />
            ) : (
              <div className="flex h-[min(55vh,440px)] items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          <EventImagePreviewColumn
            imageSrc={imageSrc}
            croppedArea={croppedAreaPercent}
            contexts={previewContexts}
            roleHintKey={`staffPortal.eventEdit.imageCrop.roleHint.${role}`}
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!croppedAreaPixels || submitting}
            onClick={() => void handleConfirm()}
            className={cn(submitting && "pointer-events-none")}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("staffPortal.eventEdit.imageCrop.applying")}
              </>
            ) : (
              t("staffPortal.eventEdit.imageCrop.apply")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
