import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import RegistrationQrPass, {
  type RegistrationQrPassData,
} from "@/components/shared/RegistrationQrPass";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PurchaserQrWalletItem {
  public_uuid: string;
  registration_number: string;
  qr_code_token: string;
  bib_number?: string | null;
  participant_label?: string;
  category_name?: string;
  wallet_held_by_purchaser?: boolean;
  is_managed_participant?: boolean;
  guest_claim_token?: string | null;
}

interface PurchaserQrWalletProps {
  items: PurchaserQrWalletItem[];
  /** When true, only show passes purchaser should hold (managed + unclaimed) */
  heldOnly?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
}

function toPass(item: PurchaserQrWalletItem): RegistrationQrPassData {
  const unclaimed = Boolean(item.guest_claim_token);
  const managed = Boolean(item.is_managed_participant);
  return {
    qr_code_token: item.qr_code_token,
    registration_number: item.registration_number,
    bib_number: item.bib_number,
    label: item.participant_label || item.category_name || item.registration_number,
    subtitle: item.category_name,
    badge: managed ? "managed" : unclaimed ? "unclaimed" : "self",
  };
}

export default function PurchaserQrWallet({
  items,
  heldOnly = true,
  className,
  title,
  subtitle,
}: PurchaserQrWalletProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const passes = useMemo(() => {
    const filtered = heldOnly
      ? items.filter(
          (i) =>
            i.wallet_held_by_purchaser ||
            i.is_managed_participant ||
            Boolean(i.guest_claim_token),
        )
      : items;
    return filtered.map(toPass);
  }, [items, heldOnly]);

  if (passes.length === 0) return null;

  const safeIndex = Math.min(index, passes.length - 1);
  const current = passes[safeIndex];

  return (
    <div className={cn("rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-4", className)}>
      <div className="flex items-start gap-3 text-left">
        <div className="rounded-xl bg-primary/15 p-2 shrink-0">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm">
            {title ?? t("registrationWallet.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {subtitle ?? t("registrationWallet.subtitle", { count: passes.length })}
          </p>
        </div>
      </div>

      <RegistrationQrPass pass={current} size={180} />

      {passes.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={safeIndex <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            aria-label={t("common.back")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <p className="text-xs text-muted-foreground tabular-nums">
            {safeIndex + 1} / {passes.length}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={safeIndex >= passes.length - 1}
            onClick={() => setIndex((i) => Math.min(passes.length - 1, i + 1))}
            aria-label={t("common.next")}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      ) : null}

      {passes.length > 1 ? (
        <div className="flex gap-1.5 justify-center flex-wrap">
          {passes.map((p, i) => (
            <button
              key={`${p.registration_number}-${i}`}
              type="button"
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i === safeIndex ? "bg-primary" : "bg-muted-foreground/30",
              )}
              onClick={() => setIndex(i)}
              aria-label={p.label}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
