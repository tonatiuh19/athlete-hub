import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface WaitlistOfferCountdownProps {
  expiresAt: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WaitlistOfferCountdown({ expiresAt, className }: WaitlistOfferCountdownProps) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(new Date(expiresAt).getTime() - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (remaining <= 0) {
    return (
      <p className={className ?? "text-xs text-muted-foreground"}>
        {t("athletePortal.waitlist.offerExpired")}
      </p>
    );
  }

  return (
    <p className={className ?? "text-xs text-amber-400 font-medium tabular-nums"}>
      {t("athletePortal.waitlist.offerExpiresIn", { time: formatRemaining(remaining) })}
    </p>
  );
}
