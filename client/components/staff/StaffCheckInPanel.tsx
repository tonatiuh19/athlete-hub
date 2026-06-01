import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2, QrCode, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffQrScanner from "@/components/staff/StaffQrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkInRegistration,
  clearLookup,
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
  } = useAppSelector((s) => s.staffPortal);
  const [query, setQuery] = useState("");
  const dateLocale = getDateFnsLocale(i18n.language);

  const handleLookup = () => {
    const q = query.trim();
    if (!q) return;
    dispatch(lookupRegistration({ q, eventId, role }));
  };

  const handleCheckIn = () => {
    if (!found) return;
    dispatch(checkInRegistration({ registrationId: found.id, eventId, role }));
  };

  const handleClear = () => {
    setQuery("");
    dispatch(clearLookup());
  };

  return (
    <div className="card-sport p-5 space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="w-5 h-5 text-cyan" />
        <h2 className="font-semibold">{t("staffPortal.checkIn.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("staffPortal.checkIn.subtitle")}</p>

      <StaffQrScanner
        onScan={(value) => {
          setQuery(value);
          dispatch(lookupRegistration({ q: value, eventId, role }));
        }}
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
          />
        </div>
        <Button onClick={handleLookup} disabled={lookingUp || !query.trim()}>
          {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : t("staffPortal.checkIn.lookup")}
        </Button>
      </div>

      {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
      {checkInError ? <p className="text-sm text-destructive">{checkInError}</p> : null}

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
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
              {t("staffPortal.checkIn.alreadyCheckedIn", {
                time: format(new Date(found.checked_in_at), "d MMM yyyy HH:mm", {
                  locale: dateLocale,
                }),
              })}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-1" onClick={handleCheckIn} disabled={checkingIn}>
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
          )}
        </div>
      ) : null}
    </div>
  );
}
