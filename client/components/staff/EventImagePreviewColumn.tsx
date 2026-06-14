import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { Area } from "react-easy-crop";
import EventImageContextPreview from "@/components/staff/EventImageContextPreview";
import type { EventImagePreviewContext } from "@/constants/eventImageContexts";

interface EventImagePreviewColumnProps {
  imageSrc: string | null;
  croppedArea: Area | null;
  contexts: EventImagePreviewContext[];
  roleHintKey: string;
}

function EventImagePreviewColumn({
  imageSrc,
  croppedArea,
  contexts,
  roleHintKey,
}: EventImagePreviewColumnProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-col lg:max-h-[min(55vh,560px)]">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <p className="text-sm font-semibold">{t("staffPortal.eventEdit.imageCrop.previewTitle")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          {contexts.map((context) => (
            <EventImageContextPreview
              key={context.id}
              context={context}
              imageSrc={imageSrc}
              croppedArea={croppedArea}
            />
          ))}
        </div>
      </div>
      <p className="shrink-0 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6">
        {t(roleHintKey)}
      </p>
    </div>
  );
}

export default memo(EventImagePreviewColumn);
