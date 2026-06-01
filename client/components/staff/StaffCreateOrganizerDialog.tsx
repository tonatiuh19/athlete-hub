import { useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { format } from "date-fns";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createStaffOrganizer, fetchAdminEvents } from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";

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

export default function StaffCreateOrganizerDialog({ onCreated }: StaffCreateOrganizerDialogProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { savingStaffOrganizer, staffOrganizerSaveError, events, loadingEvents } = useAppSelector(
    (s) => s.staffPortal,
  );
  const [open, setOpen] = useState(false);
  const [eventQuery, setEventQuery] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    if (open) {
      dispatch(fetchAdminEvents({}));
      setEventQuery("");
      setSelectedEventIds([]);
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
        }),
      );
      if (createStaffOrganizer.fulfilled.match(result)) {
        resetForm();
        setFieldValue("country", "MX");
        setSelectedEventIds([]);
        setOpen(false);
        onCreated?.();
      }
    },
  });

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
            <Input id="org-name" {...formik.getFieldProps("name")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-email">{t("staffPortal.staffManagement.fieldOrgEmail")}</Label>
              <Input id="org-email" type="email" {...formik.getFieldProps("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-city">{t("staffPortal.staffManagement.fieldCity")}</Label>
              <Input id="org-city" {...formik.getFieldProps("city")} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-slug">{t("staffPortal.staffManagement.fieldSlug")}</Label>
              <Input id="org-slug" placeholder="auto" {...formik.getFieldProps("slug")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">{t("staffPortal.staffManagement.fieldPhone")}</Label>
              <Input id="org-phone" {...formik.getFieldProps("phone")} />
            </div>
          </div>

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
