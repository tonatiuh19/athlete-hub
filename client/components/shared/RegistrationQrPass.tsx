import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Maximize2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RegistrationQrPassData {
  qr_code_token: string;
  registration_number: string;
  bib_number?: string | null;
  label: string;
  subtitle?: string;
  badge?: "managed" | "unclaimed" | "self" | null;
}

interface RegistrationQrPassProps {
  pass: RegistrationQrPassData;
  size?: number;
  className?: string;
  allowFullscreen?: boolean;
}

export default function RegistrationQrPass({
  pass,
  size = 160,
  className,
  allowFullscreen = true,
}: RegistrationQrPassProps) {
  const { t } = useTranslation();
  const [fullscreen, setFullscreen] = useState(false);

  const badgeLabel =
    pass.badge === "managed"
      ? t("registrationWallet.badgeManaged")
      : pass.badge === "unclaimed"
        ? t("registrationWallet.badgeUnclaimed")
        : pass.badge === "self"
          ? t("registrationWallet.badgeSelf")
          : null;

  const card = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-3 text-center",
        className,
      )}
    >
      <div className="rounded-xl bg-white p-3">
        <QRCodeSVG value={pass.qr_code_token} size={size} level="M" includeMargin />
      </div>
      <div className="space-y-1 min-w-0 w-full">
        <p className="font-semibold text-sm text-foreground truncate">{pass.label}</p>
        {pass.subtitle ? (
          <p className="text-xs text-muted-foreground truncate">{pass.subtitle}</p>
        ) : null}
        <p className="font-mono text-xs text-primary font-bold">
          {t("registrationWallet.folio")} {pass.registration_number}
        </p>
        {pass.bib_number ? (
          <p className="text-xs text-muted-foreground">
            {t("registrationWallet.bib")} {pass.bib_number}
          </p>
        ) : null}
        {badgeLabel ? (
          <span className="inline-flex mt-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            {badgeLabel}
          </span>
        ) : null}
      </div>
      {allowFullscreen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setFullscreen(true)}
        >
          <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
          {t("registrationWallet.fullscreen")}
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      {card}
      {fullscreen ? (
        <div className="fixed inset-0 z-[80] bg-background flex flex-col items-center justify-center p-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4"
            onClick={() => setFullscreen(false)}
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="rounded-2xl bg-white p-6">
            <QRCodeSVG value={pass.qr_code_token} size={280} level="M" includeMargin />
          </div>
          <p className="mt-4 text-lg font-semibold text-foreground">{pass.label}</p>
          <p className="font-mono text-primary font-bold text-xl mt-1">{pass.registration_number}</p>
          <p className="text-xs text-muted-foreground mt-3 max-w-xs text-center">
            {t("registrationWallet.fullscreenHint")}
          </p>
        </div>
      ) : null}
    </>
  );
}
