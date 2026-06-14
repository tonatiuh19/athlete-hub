import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StaffPaidEventPayoutAlertProps {
  isAdmin?: boolean;
  className?: string;
  compact?: boolean;
  eventEditPath?: string;
}

/** Shown when a published event has paid categories but organizer payout is not ready. */
export default function StaffPaidEventPayoutAlert({
  isAdmin = false,
  className,
  compact = false,
  eventEditPath,
}: StaffPaidEventPayoutAlertProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 flex gap-3",
        compact ? "px-3 py-2 items-center" : "p-4 items-start",
        className,
      )}
      role="alert"
    >
      <AlertTriangle
        className={cn("text-destructive shrink-0", compact ? "w-4 h-4" : "w-5 h-5 mt-0.5")}
      />
      <div className="flex-1 min-w-0 space-y-2">
        <p className={cn("text-destructive", compact ? "text-xs" : "text-sm")}>
          {isAdmin
            ? t("staffPortal.payouts.paymentsUnavailableBannerAdmin")
            : t("staffPortal.payouts.paymentsUnavailableBanner")}
        </p>
        {!compact ? (
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button asChild variant="outline" size="sm" className="border-destructive/40">
                <Link to="/staff/people?tab=organizers">
                  {t("staffPortal.payouts.publishBlockedCtaAdmin")}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="border-destructive/40">
                <Link to="/staff/payouts">{t("staffPortal.payouts.publishBlockedCta")}</Link>
              </Button>
            )}
            {eventEditPath ? (
              <Button asChild variant="ghost" size="sm" className="text-destructive">
                <Link to={eventEditPath}>{t("staffPortal.payouts.paymentsUnavailableEditEvent")}</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function eventNeedsPayoutAlert(input: {
  status?: string;
  has_paid_categories?: boolean;
  payments_available?: boolean;
}): boolean {
  return (
    input.status === "published" &&
    Boolean(input.has_paid_categories) &&
    input.payments_available === false
  );
}
