import { useState } from "react";
import { Film, ImageIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventMediaAsset } from "@shared/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resolveAbsoluteUrl } from "@/lib/siteMeta";

interface EventMediaGalleryProps {
  media: EventMediaAsset[];
  className?: string;
}

function isVideo(asset: EventMediaAsset) {
  const t = asset.asset_type?.toLowerCase() ?? "";
  return t.includes("video") || asset.mime_type?.startsWith("video/");
}

export default function EventMediaGallery({ media, className }: EventMediaGalleryProps) {
  const { t } = useTranslation();
  const [lightbox, setLightbox] = useState<EventMediaAsset | null>(null);

  const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length === 0) return null;

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-cyan" />
          {t("eventDetail.mediaGallery")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sorted.map((item, i) => {
            const url = resolveAbsoluteUrl(item.url);
            const video = isVideo(item);
            return (
              <button
                key={`${item.url}-${i}`}
                type="button"
                onClick={() => setLightbox(item)}
                className={cn(
                  "group relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-700/50",
                  "bg-surface-dark/60 hover:border-cyan/40 transition-all focus:outline-none focus:ring-2 focus:ring-cyan/40",
                  item.is_primary && "md:col-span-2 md:row-span-2 aspect-[16/10]",
                )}
              >
                {video ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Film className="w-10 h-10 text-cyan" />
                  </div>
                ) : (
                  <img
                    src={url}
                    alt={item.alt_text ?? ""}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={lightbox != null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl w-[calc(100%-2rem)] p-0 bg-black border-gray-700 overflow-hidden">
          <button
            type="button"
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
            onClick={() => setLightbox(null)}
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
          {lightbox ? (
            isVideo(lightbox) ? (
              <video
                src={resolveAbsoluteUrl(lightbox.url)}
                controls
                autoPlay
                className="w-full max-h-[80vh] object-contain"
              />
            ) : (
              <img
                src={resolveAbsoluteUrl(lightbox.url)}
                alt={lightbox.alt_text ?? ""}
                className="w-full max-h-[80vh] object-contain"
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
