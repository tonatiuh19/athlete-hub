import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { logger } from "@/utils/logger";

interface StaffQrScannerProps {
  onScan: (value: string) => void;
  disabled?: boolean;
}

export default function StaffQrScanner({ onScan, disabled }: StaffQrScannerProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "staff-checkin-qr-region";

  useEffect(() => {
    if (!active || disabled) return;

    let cancelled = false;
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          onScan(decoded);
          setActive(false);
        },
        () => {},
      )
      .catch((err: unknown) => {
        if (!cancelled) {
          logger.warn("QR scanner failed", err);
          setError(t("staffPortal.checkIn.cameraError"));
          setActive(false);
        }
      });

    return () => {
      cancelled = true;
      void scanner.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [active, disabled, onScan, t]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setError(null);
          setActive((v) => !v);
        }}
      >
        {active ? (
          <>
            <CameraOff className="w-4 h-4 mr-2" />
            {t("staffPortal.checkIn.stopCamera")}
          </>
        ) : (
          <>
            <Camera className="w-4 h-4 mr-2" />
            {t("staffPortal.checkIn.scanQr")}
          </>
        )}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {active ? (
        <div
          id={regionId}
          className="rounded-xl overflow-hidden border border-border max-w-sm mx-auto"
        />
      ) : null}
    </div>
  );
}
