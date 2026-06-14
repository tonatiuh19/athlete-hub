import { memo, useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import { RotateCcw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface EventImageCropWorkbenchProps {
  imageSrc: string;
  aspect?: number;
  onCropAreaChange: (croppedArea: Area, croppedAreaPixels: Area) => void;
}

function EventImageCropWorkbench({
  imageSrc,
  aspect,
  onCropAreaChange,
}: EventImageCropWorkbenchProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleCropAreaChange = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      onCropAreaChange(croppedArea, croppedAreaPixels);
    },
    [onCropAreaChange],
  );

  const resetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <>
      <div className="relative h-[min(55vh,440px)] shrink-0 bg-muted/20">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          minZoom={1}
          maxZoom={3}
          zoomWithScroll={false}
          restrictPosition
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropAreaChange={handleCropAreaChange}
          objectFit="contain"
          showGrid
          classes={{
            containerClassName: "rounded-none",
          }}
        />
      </div>

      <div className="shrink-0 space-y-3 border-t border-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
            aria-label={t("staffPortal.eventEdit.imageCrop.zoom")}
          />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={resetCrop}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {t("staffPortal.eventEdit.imageCrop.reset")}
        </Button>
      </div>
    </>
  );
}

export default memo(EventImageCropWorkbench);
