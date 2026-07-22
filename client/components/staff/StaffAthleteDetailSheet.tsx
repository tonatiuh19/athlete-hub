import { useState } from "react";
import { format } from "date-fns";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffRegistrationDetailSheet from "@/components/staff/StaffRegistrationDetailSheet";
import { StaffSheetSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearAthleteDetail,
  fetchAdminAthleteDetail,
  updateAdminAthleteStatus,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";

interface StaffAthleteDetailSheetProps {
  athleteId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StaffAthleteDetailSheet({
  athleteId,
  open,
  onOpenChange,
}: StaffAthleteDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { athleteDetail, loadingAthleteDetail, athleteDetailError, updatingAthleteStatus } =
    useAppSelector((s) => s.staffPortal);
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);
  const [regLink, setRegLink] = useState<{ eventId: number; registrationId: number } | null>(
    null,
  );

  const handleOpen = (next: boolean) => {
    if (!next) {
      dispatch(clearAthleteDetail());
      setRegLink(null);
    }
    onOpenChange(next);
  };

  const athlete = athleteDetail?.athlete;

  const load = () => {
    if (athleteId) dispatch(fetchAdminAthleteDetail({ athleteId }));
  };

  const toggleSuspend = () => {
    if (!athlete) return;
    const next = athlete.status === "suspended" ? "active" : "suspended";
    dispatch(updateAdminAthleteStatus({ athleteId: athlete.id, status: next }));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("staffPortal.athletes.detailTitle")}</SheetTitle>
            <SheetDescription>{t("staffPortal.athletes.detailSubtitle")}</SheetDescription>
          </SheetHeader>

          {loadingAthleteDetail ? (
            <div className="mt-6" aria-busy="true">
              <StaffSheetSkeleton />
            </div>
          ) : athleteDetailError ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-destructive">{athleteDetailError}</p>
              <Button variant="outline" size="sm" onClick={load}>
                {t("common.retry")}
              </Button>
            </div>
          ) : athlete ? (
            <div className="mt-6 space-y-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {athlete.first_name} {athlete.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{athlete.email || "—"}</p>
                </div>
                <StaffStatusBadge status={athlete.status} />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colContact")}</dt>
                  <dd>{athlete.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colLocation")}</dt>
                  <dd>{[athlete.city, athlete.country].filter(Boolean).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colDob")}</dt>
                  <dd>
                    {athlete.date_of_birth
                      ? format(new Date(athlete.date_of_birth), "d MMM yyyy", { locale: dateLocale })
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colGender")}</dt>
                  <dd className="capitalize">{athlete.gender || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colShirt")}</dt>
                  <dd>{athlete.shirt_size || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colLastLogin")}</dt>
                  <dd>
                    {athlete.last_login_at
                      ? format(new Date(athlete.last_login_at), "d MMM yyyy HH:mm", {
                          locale: dateLocale,
                        })
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colJoined")}</dt>
                  <dd>
                    {format(new Date(athlete.created_at), "d MMM yyyy", { locale: dateLocale })}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("staffPortal.athletes.colRegs")}</dt>
                  <dd className="font-semibold text-primary">{athlete.registration_count}</dd>
                </div>
              </dl>

              <Button
                variant={athlete.status === "suspended" ? "default" : "destructive"}
                className="w-full"
                disabled={updatingAthleteStatus}
                onClick={toggleSuspend}
              >
                {updatingAthleteStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : athlete.status === "suspended" ? (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                ) : (
                  <ShieldAlert className="w-4 h-4 mr-2" />
                )}
                {athlete.status === "suspended"
                  ? t("staffPortal.athletes.reactivate")
                  : t("staffPortal.athletes.suspend")}
              </Button>

              {(athleteDetail?.registrations?.length ?? 0) > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                    {t("staffPortal.athletes.recentRegs")}
                  </h4>
                  <div className="space-y-2">
                    {athleteDetail?.registrations.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full text-left rounded-xl border border-border p-3 text-sm flex justify-between gap-3 hover:bg-muted/40 transition-colors"
                        onClick={() =>
                          setRegLink({ eventId: r.event_id, registrationId: r.id })
                        }
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.event_title}</p>
                          <p className="text-xs text-muted-foreground">{r.registration_number}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <StaffStatusBadge status={r.status} />
                          <p className="text-xs text-primary font-semibold mt-1">
                            ${(r.total_cents / 100).toLocaleString(numLocale)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {regLink ? (
        <StaffRegistrationDetailSheet
          eventId={regLink.eventId}
          registrationId={regLink.registrationId}
          role="admin"
          open
          onOpenChange={(next) => {
            if (!next) setRegLink(null);
          }}
          allowRefund
          allowRegistrationOps
        />
      ) : null}
    </>
  );
}
