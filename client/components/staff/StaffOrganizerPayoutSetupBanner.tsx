import { Banknote } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchOrganizerPayoutStatus } from "@/store/slices/staffPortalSlice";
import { canAccessStaffPayouts } from "@/utils/staffNav";
import { useEffect } from "react";

export interface StaffOrganizerPayoutSetupBannerProps {
  organizerRole?: string;
  className?: string;
  variant?: "inline" | "sticky";
}

export function useOrganizerPayoutSetupBannerVisible(organizerRole?: string) {
  const location = useLocation();
  const { payoutStatus, loadingPayoutStatus } = useAppSelector((s) => s.staffPortal);

  const canShow = canAccessStaffPayouts(false, organizerRole);
  const onPayoutsPage = location.pathname.startsWith("/staff/payouts");

  return (
    canShow &&
    !onPayoutsPage &&
    !loadingPayoutStatus &&
    Boolean(payoutStatus) &&
    !payoutStatus?.payoutReady
  );
}

/**
 * Proactive nudge for organizers who have not completed payout / Connect setup.
 * Hidden on /staff/payouts and when payoutReady is true.
 */
export default function StaffOrganizerPayoutSetupBanner({
  organizerRole,
  className,
  variant = "inline",
}: StaffOrganizerPayoutSetupBannerProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { payoutStatus, loadingPayoutStatus, payoutStatusError } = useAppSelector(
    (s) => s.staffPortal,
  );

  const canShow = canAccessStaffPayouts(false, organizerRole);
  const onPayoutsPage = location.pathname.startsWith("/staff/payouts");

  useEffect(() => {
    if (!canShow || onPayoutsPage) return;
    // Do not retry-loop on failure — that flooded prod with Stripe 500s.
    if (!payoutStatus && !loadingPayoutStatus && !payoutStatusError) {
      void dispatch(fetchOrganizerPayoutStatus());
    }
  }, [
    canShow,
    dispatch,
    loadingPayoutStatus,
    onPayoutsPage,
    payoutStatus,
    payoutStatusError,
  ]);

  if (!canShow || onPayoutsPage) return null;
  if (loadingPayoutStatus && !payoutStatus) return null;
  if (!payoutStatus || payoutStatus.payoutReady) return null;

  const cta = (
    <Button
      asChild
      size="sm"
      className={cn("shrink-0", variant === "sticky" ? "h-9 px-4" : "w-full lg:w-auto")}
    >
      <Link to="/staff/payouts">{t("staffPortal.payouts.setupBannerCta")}</Link>
    </Button>
  );

  if (variant === "sticky") {
    return (
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 border-t border-primary/30 bg-background/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom)]",
          className,
        )}
        role="status"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <Banknote className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {t("staffPortal.payouts.setupBannerTitle")}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {t("staffPortal.payouts.setupBannerBody")}
            </p>
          </div>
          {cta}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-5",
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6",
        className,
      )}
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <Banknote className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {t("staffPortal.payouts.setupBannerTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("staffPortal.payouts.setupBannerBody")}
          </p>
        </div>
      </div>
      <div className="w-full shrink-0 lg:w-auto lg:pl-2">{cta}</div>
    </div>
  );
}
