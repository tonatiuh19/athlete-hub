import { useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { format } from "date-fns";
import { CalendarDays, Loader2, Plus, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { slugify } from "@shared/slugify";
import GeoCitySelector from "@/components/geo/GeoCitySelector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchGeoStates } from "@/store/slices/geoSlice";
import { createStaffOrganizer, fetchAdminEvents } from "@/store/slices/staffPortalSlice";
import StaffFeeCalculatorCard from "@/components/staff/StaffFeeCalculatorCard";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { isCatalogCitySelectionValid } from "@/utils/geoCityValidation";

const schema = Yup.object({
  name: Yup.string().trim().required("Required"),
  email: Yup.string().email("Invalid email").required("Required"),
  owner_email: Yup.string().email("Invalid email").required("Required"),
  owner_first_name: Yup.string().trim().required("Required"),
  owner_last_name: Yup.string().trim().required("Required"),
});

interface StaffCreateOrganizerDialogProps {
  onCreated?: () => void;
}

const ORGANIZER_SLUG_MAX = 80;

export default function StaffCreateOrganizerDialog({ onCreated }: StaffCreateOrganizerDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const { savingStaffOrganizer, staffOrganizerSaveError, events, loadingEvents } = useAppSelector(
    (s) => s.staffPortal,
  );
  const [open, setOpen] = useState(false);
  const [eventQuery, setEventQuery] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [serviceFeePercent, setServiceFeePercent] = useState(11);
  const [geoStateId, setGeoStateId] = useState<number | null>(null);
  const [geoCityId, setGeoCityId] = useState<number | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    if (open) {
      dispatch(fetchAdminEvents({}));
      dispatch(fetchGeoStates("MX"));
      setEventQuery("");
      setSelectedEventIds([]);
      setServiceFeePercent(11);
      setGeoStateId(null);
      setGeoCityId(null);
      setSlugEdited(false);
    }
  }, [open, dispatch]);

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.organizer_name?.toLowerCase().includes(q) ?? false),
    );
  }, [events, eventQuery]);

  const toggleEvent = (id: number) => {
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const formik = useFormik({
    initialValues: {
      name: "",
      email: "",
      slug: "",
      city: "",
      country: "MX",
      phone: "",
      owner_email: "",
      owner_first_name: "",
      owner_last_name: "",
    },
    validationSchema: schema,
    onSubmit: async (values, { resetForm, setFieldValue }) => {
      if (!isCatalogCitySelectionValid(geoCityId, values.city)) {
        toast({
          title: t("geo.citySelector.invalidSelectionTitle"),
          description: t("geo.citySelector.supportMessageAdmin"),
          variant: "destructive",
        });
        return;
      }

      const result = await dispatch(
        createStaffOrganizer({
          name: values.name.trim(),
          email: values.email.trim(),
          slug: values.slug.trim() || undefined,
          city: values.city.trim() || undefined,
          country: values.country.trim() || undefined,
          phone: values.phone.trim() || undefined,
          owner_email: values.owner_email.trim(),
          owner_first_name: values.owner_first_name.trim(),
          owner_last_name: values.owner_last_name.trim(),
          event_ids: selectedEventIds.length > 0 ? selectedEventIds : undefined,
          service_fee_percent: serviceFeePercent,
        }),
      );
      if (createStaffOrganizer.fulfilled.match(result)) {
        resetForm();
        setFieldValue("country", "MX");
        setSelectedEventIds([]);
        setServiceFeePercent(11);
        setGeoStateId(null);
        setGeoCityId(null);
        setSlugEdited(false);
        setOpen(false);
        onCreated?.();
      }
    },
  });

  const handleNameChange = (name: string) => {
    void formik.setFieldValue("name", name);
    if (!slugEdited) {
      void formik.setFieldValue("slug", slugify(name, ORGANIZER_SLUG_MAX));
    }
  };

  const handleSlugChange = (raw: string) => {
    setSlugEdited(true);
    void formik.setFieldValue("slug", slugify(raw, ORGANIZER_SLUG_MAX));
  };

  const regenerateSlug = () => {
    setSlugEdited(false);
    void formik.setFieldValue("slug", slugify(formik.values.name, ORGANIZER_SLUG_MAX));
  };

  const slugPreview = formik.values.slug.trim() || slugify(formik.values.name, ORGANIZER_SLUG_MAX);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          {t("staffPortal.staffManagement.createOrganizer")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("staffPortal.staffManagement.createOrganizerTitle")}</DialogTitle>
          <DialogDescription>{t("staffPortal.staffManagement.createOrganizerSubtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={formik.handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t("staffPortal.staffManagement.fieldOrgName")}</Label>
            <Input
              id="org-name"
              name="name"
              value={formik.values.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={formik.handleBlur}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-email">{t("staffPortal.staffManagement.fieldOrgEmail")}</Label>
              <Input id="org-email" type="email" {...formik.getFieldProps("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">{t("staffPortal.staffManagement.fieldPhone")}</Label>
              <Input id="org-phone" {...formik.getFieldProps("phone")} />
            </div>
          </div>

          <GeoCitySelector
            stateId={geoStateId}
            cityId={geoCityId}
            cityName={formik.values.city}
            staffRole="admin"
            onChange={(sel) => {
              setGeoStateId(sel.stateId);
              setGeoCityId(sel.geoCityId);
              void formik.setFieldValue("city", sel.city);
            }}
          />

          <div className="space-y-2">
            <Label htmlFor="org-slug">{t("staffPortal.staffManagement.fieldSlug")}</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("staffPortal.staffManagement.slugHelp")}
            </p>
            <div className="flex gap-2">
              <Input
                id="org-slug"
                name="slug"
                value={formik.values.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                onBlur={formik.handleBlur}
                placeholder={t("staffPortal.staffManagement.slugPlaceholder")}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title={t("staffPortal.staffManagement.regenerateSlug")}
                onClick={regenerateSlug}
                disabled={!formik.values.name.trim()}
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>
            {slugPreview ? (
              <p className="text-xs text-muted-foreground font-mono">/{slugPreview}</p>
            ) : null}
            {!slugEdited && formik.values.name.trim() ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.staffManagement.slugAutoHint")}
              </p>
            ) : null}
          </div>

          <StaffFeeCalculatorCard
            serviceFeePercent={serviceFeePercent}
            feeEditable
            onFeePercentChange={setServiceFeePercent}
            compact
          />

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium">{t("staffPortal.staffManagement.ownerSection")}</p>
            <div className="space-y-2">
              <Label htmlFor="owner-email">{t("staffPortal.team.fieldEmail")}</Label>
              <Input id="owner-email" type="email" {...formik.getFieldProps("owner_email")} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner-first">{t("staffPortal.team.fieldFirst")}</Label>
                <Input id="owner-first" {...formik.getFieldProps("owner_first_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-last">{t("staffPortal.team.fieldLast")}</Label>
                <Input id="owner-last" {...formik.getFieldProps("owner_last_name")} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium">{t("staffPortal.staffManagement.createOrganizerEventsTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("staffPortal.staffManagement.createOrganizerEventsSubtitle")}
              </p>
            </div>
            <Input
              value={eventQuery}
              onChange={(e) => setEventQuery(e.target.value)}
              placeholder={t("staffPortal.staffManagement.searchLinkEvents")}
            />
            {loadingEvents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : filteredEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("staffPortal.staffManagement.noLinkableEvents")}</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-border p-2">
                {filteredEvents.map((ev) => {
                  const checked = selectedEventIds.includes(ev.id);
                  return (
                    <li key={ev.id}>
                      <label className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={() => toggleEvent(ev.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-sm block truncate">{ev.title}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <CalendarDays className="w-3 h-3 shrink-0" />
                            {format(new Date(ev.start_date), "d MMM yyyy", { locale: dateLocale })}
                            {ev.organizer_name ? ` · ${ev.organizer_name}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedEventIds.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.staffManagement.createOrganizerEventsSelected", {
                  count: selectedEventIds.length,
                })}
              </p>
            ) : null}
          </div>

          {staffOrganizerSaveError ? (
            <p className="text-sm text-destructive">{staffOrganizerSaveError}</p>
          ) : null}

          <Button type="submit" disabled={savingStaffOrganizer} className="w-full">
            {savingStaffOrganizer ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.staffManagement.createOrganizerSubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
