import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  QrCode,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffQrScanner from "@/components/staff/StaffQrScanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkInRegistration,
  clearLookup,
  fetchCheckInWindow,
  lookupRegistration,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import type { StaffRole } from "@shared/api";

interface StaffCheckInPanelProps {
  eventId?: number;
  role?: StaffRole;
}

export default function StaffCheckInPanel({ eventId, role = "organizer" }: StaffCheckInPanelProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    lookupRegistration: found,
    lookingUp,
    lookupError,
    checkingIn,
    checkInError,
    checkInErrorCode,
    checkInWindow,
    canBypassCheckInWindow,
    loadingCheckInWindow,
  } = useAppSelector((s) => s.staffPortal);
  const [query, setQuery] = useState("");
  const [forceDialogOpen, setForceDialogOpen] = useState(false);
  const [bypassWindowDialogOpen, setBypassWindowDialogOpen] = useState(false);
  const [lastLookupMethod, setLastLookupMethod] = useState<"qr_scan" | "manual">("manual");
  const dateLocale = getDateFnsLocale(i18n.language);

  const waiverBlocked =
    checkInErrorCode === "waiver_unsigned" || checkInErrorCode === "waiver_outdated";
  const windowBlocked =
    checkInErrorCode === "check_in_not_yet" ||
    checkInErrorCode === "check_in_window_closed" ||
    checkInErrorCode === "invalid_check_in_timezone";

  const checkInOpen = checkInWindow?.open === true;
  const organizerWindowLocked =
    role === "organizer" &&
    !checkInOpen &&
    (eventId != null
      ? !loadingCheckInWindow && checkInWindow != null
      : Boolean(found?.event_id && checkInWindow != null));

  const windowEventId = eventId ?? found?.event_id;

  useEffect(() => {
    if (windowEventId == null) return;
    void dispatch(fetchCheckInWindow({ eventId: windowEventId, role }));
    const timer = window.setInterval(() => {
      void dispatch(fetchCheckInWindow({ eventId: windowEventId, role }));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [dispatch, role, windowEventId]);

  const windowBanner = useMemo(() => {
    if (loadingCheckInWindow && windowEventId != null) {
      return (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          {t("staffPortal.checkIn.windowLoading")}
        </div>
      );
    }
    if (!checkInWindow) return null;
    const opens = format(new Date(checkInWindow.opensAt), "d MMM yyyy HH:mm", {
      locale: dateLocale,
    });
    const closes = format(new Date(checkInWindow.closesAt), "d MMM yyyy HH:mm", {
      locale: dateLocale,
    });

    if (checkInWindow.open) {
      return (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t("staffPortal.checkIn.windowOpen")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("staffPortal.checkIn.windowOpenHint", { closes })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("staffPortal.checkIn.windowTimezoneLabel", { tz: checkInWindow.timezone })}
            </p>
          </div>
        </div>
      );
    }

    if (checkInWindow.status === "invalid_timezone") {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">{t("staffPortal.checkIn.windowInvalidTimezone")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("staffPortal.checkIn.windowInvalidTimezoneHint")}
            </p>
          </div>
        </div>
      );
    }

    const statusKey =
      checkInWindow.status === "not_yet"
        ? "staffPortal.checkIn.windowNotYet"
        : "staffPortal.checkIn.windowClosed";

    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm flex items-start gap-2">
        <Lock className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
        <div>
          <p className="font-medium text-destructive">{t(statusKey)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {checkInWindow.status === "not_yet"
              ? t("staffPortal.checkIn.windowOpensAt", { opens })
              : t("staffPortal.checkIn.windowClosedHint", { closes })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("staffPortal.checkIn.windowTimezoneLabel", { tz: checkInWindow.timezone })}
          </p>
          {checkInWindow.firstEventDay !== checkInWindow.lastEventDay ? (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {t("staffPortal.checkIn.windowEventDays", {
                from: checkInWindow.firstEventDay,
                to: checkInWindow.lastEventDay,
              })}
            </p>
          ) : null}
        </div>
      </div>
    );
  }, [checkInWindow, dateLocale, loadingCheckInWindow, t, windowEventId]);

  const runLookup = (q: string, method: "qr_scan" | "manual") => {
    if (organizerWindowLocked) return;
    setLastLookupMethod(method);
    dispatch(lookupRegistration({ q, eventId, role }));
  };

  const handleLookup = () => {
    const q = query.trim();
    if (!q) return;
    runLookup(q, "manual");
  };

  const runCheckIn = (opts?: { force?: boolean; bypassWindow?: boolean }) => {
    if (!found) return;
    dispatch(
      checkInRegistration({
        registrationId: found.id,
        eventId: eventId ?? found.event_id,
        role,
        force: opts?.force,
        bypassWindow: opts?.bypassWindow,
        method: lastLookupMethod,
      }),
    ).then((result) => {
      if (checkInRegistration.fulfilled.match(result)) {
        setForceDialogOpen(false);
        setBypassWindowDialogOpen(false);
        const refreshEventId = eventId ?? found?.event_id;
        if (refreshEventId != null) {
          void dispatch(fetchCheckInWindow({ eventId: refreshEventId, role }));
        }
      } else if (checkInRegistration.rejected.match(result)) {
        const code = result.payload?.code;
        if (code === "waiver_unsigned" || code === "waiver_outdated") {
          setForceDialogOpen(true);
        } else if (
          canBypassCheckInWindow &&
          (code === "check_in_not_yet" || code === "check_in_window_closed")
        ) {
          setBypassWindowDialogOpen(true);
        }
      }
    });
  };

  const handleCheckIn = () => runCheckIn();

  const handleClear = () => {
    setQuery("");
    setForceDialogOpen(false);
    setBypassWindowDialogOpen(false);
    dispatch(clearLookup());
  };

  return (
    <div className="card-sport p-5 space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="w-5 h-5 text-cyan" />
        <h2 className="font-semibold">{t("staffPortal.checkIn.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {eventId != null
          ? t("staffPortal.checkIn.subtitle")
          : t("staffPortal.checkIn.subtitleGlobal")}
      </p>

      {windowBanner}

      <StaffQrScanner
        onScan={(value) => {
          setQuery(value);
          runLookup(value, "qr_scan");
        }}
        disabled={organizerWindowLocked}
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder={t("staffPortal.checkIn.placeholder")}
            className="pl-9"
            disabled={organizerWindowLocked}
          />
        </div>
        <Button onClick={handleLookup} disabled={lookingUp || !query.trim() || organizerWindowLocked}>
          {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : t("staffPortal.checkIn.lookup")}
        </Button>
      </div>

      {organizerWindowLocked ? (
        <p className="text-xs text-muted-foreground">{t("staffPortal.checkIn.windowOrganizerLocked")}</p>
      ) : null}

      {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
      {checkInError && !waiverBlocked && !windowBlocked ? (
        <p className="text-sm text-destructive">{checkInError}</p>
      ) : null}
      {windowBlocked && checkInError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-sm text-destructive font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {checkInError}
          </p>
          {canBypassCheckInWindow ? (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive"
              onClick={() => setBypassWindowDialogOpen(true)}
            >
              {t("staffPortal.checkIn.bypassWindow")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {waiverBlocked && checkInError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-sm text-destructive font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {checkInError}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive"
            onClick={() => setForceDialogOpen(true)}
          >
            {t("staffPortal.checkIn.forceOverride")}
          </Button>
        </div>
      ) : null}

      {found ? (
        <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {found.athlete_first_name} {found.athlete_last_name}
              </h3>
              <p className="text-sm text-muted-foreground">{found.event_title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {found.registration_number}
                {found.bib_number ? ` · Bib ${found.bib_number}` : ""}
              </p>
            </div>
            <StaffStatusBadge status={found.status} />
          </div>

          {found.checked_in_at ? (
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle2 className="w-4 h-4" />
              {t("staffPortal.checkIn.alreadyCheckedIn", {
                time: format(new Date(found.checked_in_at), "d MMM yyyy HH:mm", {
                  locale: dateLocale,
                }),
              })}
            </div>
          ) : (
            <>
              {Boolean(found.requires_waiver) ? (
                <p
                  className={
                    found.waiver_outdated
                      ? "text-xs text-destructive font-medium"
                      : found.waiver_signed_at
                        ? "text-xs text-accent"
                        : "text-xs text-destructive font-medium"
                  }
                >
                  {found.waiver_outdated
                    ? t("staffPortal.checkIn.waiverOutdated")
                    : found.waiver_signed_at
                      ? t("staffPortal.checkIn.waiverSigned")
                      : t("staffPortal.checkIn.waiverUnsigned")}
                </p>
              ) : null}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1"
                  onClick={handleCheckIn}
                  disabled={checkingIn || organizerWindowLocked}
                >
                  {checkingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  {t("staffPortal.checkIn.confirm")}
                </Button>
                <Button variant="outline" onClick={handleClear}>
                  {t("staffPortal.checkIn.clear")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <AlertDialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("staffPortal.checkIn.forceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {checkInErrorCode === "waiver_outdated"
                ? t("staffPortal.checkIn.forceOutdatedDescription")
                : t("staffPortal.checkIn.forceUnsignedDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={checkingIn}
              onClick={(e) => {
                e.preventDefault();
                runCheckIn({ force: true });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {checkingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("staffPortal.checkIn.forceConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bypassWindowDialogOpen} onOpenChange={setBypassWindowDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("staffPortal.checkIn.bypassWindowTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("staffPortal.checkIn.bypassWindowDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={checkingIn}
              onClick={(e) => {
                e.preventDefault();
                runCheckIn({ bypassWindow: true });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {checkingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("staffPortal.checkIn.bypassWindowConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
