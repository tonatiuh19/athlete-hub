import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Loader2,
  MapPin,
  Rocket,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { StaffEventCardsSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import GeoCitySelector from "@/components/geo/GeoCitySelector";
import { isCatalogCitySelectionValid } from "@/utils/geoCityValidation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchGeoStates } from "@/store/slices/geoSlice";
import { fetchSportTypes } from "@/store/slices/marketplaceSlice";
import {
  createAdminEvent,
  fetchAdminOrganizers,
} from "@/store/slices/staffPortalSlice";
import type { AdminOrganizerRow } from "@shared/api";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { cn } from "@/lib/utils";

function slugPreview(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function AdminCreateEventPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.staffAuth);
  const { sportTypes } = useAppSelector((s) => s.marketplace);
  const {
    adminOrganizers,
    loadingAdminOrganizers,
    adminOrganizersError,
    savingEvent,
    saveEventError,
  } = useAppSelector((s) => s.staffPortal);

  const [orgQuery, setOrgQuery] = useState("");
  const [debouncedOrgQ, setDebouncedOrgQ] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<AdminOrganizerRow | null>(null);
  const [title, setTitle] = useState("");
  const [sportId, setSportId] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [geoStateId, setGeoStateId] = useState<number | null>(null);
  const [geoCityId, setGeoCityId] = useState<number | null>(null);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [requiresWaiver, setRequiresWaiver] = useState(false);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedOrgQ(orgQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [orgQuery]);

  useEffect(() => {
    if (role === "admin") {
      dispatch(fetchSportTypes());
      dispatch(fetchGeoStates("MX"));
      dispatch(fetchAdminOrganizers({ q: debouncedOrgQ }));
    }
  }, [dispatch, role, debouncedOrgQ]);

  const previewSlug = useMemo(() => slugPreview(title) || "your-event", [title]);
  const sportName = sportTypes.find((s) => String(s.id) === sportId)?.name ?? "";
  const canSubmit = selectedOrg && title.trim().length >= 3 && startDate;

  if (role !== "admin") {
    return <Navigate to="/staff/events" replace />;
  }

  const handleCreate = async () => {
    if (!selectedOrg || !canSubmit) return;
    if (!isCatalogCitySelectionValid(geoCityId, city)) {
      toast({
        title: t("geo.citySelector.invalidSelectionTitle"),
        description: t("geo.citySelector.supportMessageAdmin"),
        variant: "destructive",
      });
      return;
    }
    const result = await dispatch(
      createAdminEvent({
        organizer_id: selectedOrg.id,
        title: title.trim(),
        sport_type_id: Number(sportId) || 1,
        start_date: new Date(startDate).toISOString(),
        short_description: shortDesc.trim() || null,
        location_city: geoCityId ? city.trim() || null : null,
        location_state: geoCityId ? state.trim() || null : null,
        visibility: "public",
        requires_waiver: requiresWaiver,
      }),
    );
    if (createAdminEvent.fulfilled.match(result)) {
      navigate(`/staff/events/${result.payload.event.id}/edit`, { replace: true });
    }
  };

  return (
    <div className="min-h-full w-full min-w-0 overflow-x-clip">
      <MetaHelmet
        title={t("staffPortal.adminCreate.title")}
        description={t("staffPortal.adminCreate.subtitle")}
      />

      <div className="relative overflow-hidden border-b border-cyan/10 bg-gradient-to-br from-cyan/10 via-background to-purple-accent/5">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-cyan/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-4 py-8 relative">
          <Link
            to="/staff/events"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("staffPortal.eventEdit.back")}
          </Link>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan/15 border border-cyan/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {t("staffPortal.adminCreate.title")}
              </h1>
              <p className="text-muted-foreground mt-1 max-w-xl">
                {t("staffPortal.adminCreate.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full min-w-0 px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 space-y-8"
        >
          <section className="card-sport p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">{t("staffPortal.adminCreate.organizerStep")}</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={orgQuery}
                onChange={(e) => setOrgQuery(e.target.value)}
                placeholder={t("staffPortal.adminCreate.searchOrganizer")}
                className="pl-9"
              />
            </div>
            <PortalErrorAlert
              error={adminOrganizersError}
              onRetry={() => dispatch(fetchAdminOrganizers({ q: debouncedOrgQ }))}
            />
            <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {loadingAdminOrganizers ? (
                <StaffEventCardsSkeleton count={4} className="sm:grid-cols-2 col-span-2" />
              ) : adminOrganizers.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-2 py-4 text-center">
                  {t("staffPortal.adminCreate.noOrganizers")}
                </p>
              ) : (
                adminOrganizers.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => setSelectedOrg(org)}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all",
                      selectedOrg?.id === org.id
                        ? "border-cyan bg-cyan/10 ring-1 ring-cyan/30"
                        : "border-border hover:border-cyan/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{org.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{org.email}</p>
                        {org.city ? (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {org.city}
                          </p>
                        ) : null}
                      </div>
                      {selectedOrg?.id === org.id ? (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="card-sport p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">{t("staffPortal.adminCreate.eventStep")}</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t("staffPortal.eventEdit.fieldTitle")}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("staffPortal.adminCreate.titlePlaceholder")}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("staffPortal.eventEdit.fieldSport")}</Label>
                <Select value={sportId} onValueChange={setSportId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sportTypes.map((st) => (
                      <SelectItem key={st.id} value={String(st.id)}>
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">{t("staffPortal.eventEdit.fieldStart")}</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <GeoCitySelector
              stateId={geoStateId}
              cityId={geoCityId}
              cityName={city}
              stateName={state}
              staffRole="admin"
              onChange={(sel) => {
                setGeoStateId(sel.stateId);
                setGeoCityId(sel.geoCityId);
                setCity(sel.city);
                setState(sel.state);
              }}
            />

            <div className="space-y-2">
              <Label htmlFor="short">{t("staffPortal.eventEdit.fieldShortDesc")}</Label>
              <Textarea
                id="short"
                rows={3}
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
              <Checkbox
                id="requires-waiver"
                checked={requiresWaiver}
                onCheckedChange={(v) => setRequiresWaiver(v === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="requires-waiver" className="cursor-pointer">
                  {t("staffPortal.eventEdit.fieldRequiresWaiver")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("staffPortal.adminCreate.requiresWaiverHint")}
                </p>
              </div>
            </div>

            {saveEventError ? (
              <p className="text-sm text-destructive">{saveEventError}</p>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              disabled={!canSubmit || savingEvent}
              onClick={handleCreate}
            >
              {savingEvent ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              {t("staffPortal.adminCreate.launchDraft")}
            </Button>
          </section>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <div className="sticky top-24 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("staffPortal.adminCreate.livePreview")}
            </p>
            <div className="rounded-2xl border border-cyan/20 bg-gradient-to-br from-surface-dark to-bg-dark overflow-hidden shadow-xl shadow-cyan/5">
              <div className="h-28 bg-gradient-to-br from-cyan/20 via-purple-accent/10 to-transparent" />
              <div className="p-5 -mt-8 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-cyan/15 border border-cyan/30 flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                    {sportName || t("staffPortal.eventEdit.fieldSport")}
                  </p>
                  <h3 className="text-xl font-bold mt-1 leading-tight">
                    {title.trim() || t("staffPortal.adminCreate.previewTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 font-mono">/events/{previewSlug}</p>
                </div>
                {selectedOrg ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 shrink-0" />
                    {selectedOrg.name}
                  </p>
                ) : (
                  <p className="text-sm text-amber-500/90">{t("staffPortal.adminCreate.pickOrganizerHint")}</p>
                )}
                {startDate ? (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(startDate), "EEEE d MMMM yyyy · HH:mm", { locale: dateLocale })}
                  </p>
                ) : null}
                {city ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {city}
                  </p>
                ) : null}
                {shortDesc ? (
                  <p className="text-sm text-muted-foreground line-clamp-3">{shortDesc}</p>
                ) : null}
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
