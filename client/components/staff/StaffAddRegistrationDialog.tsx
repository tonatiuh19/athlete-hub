import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createStaffRegistration, fetchStaffEventDetail } from "@/store/slices/staffPortalSlice";
import type { StaffEventCategory, StaffEventRow, StaffRole } from "@shared/api";

const schema = Yup.object({
  athlete_email: Yup.string().email("Invalid email").required("Required"),
  event_category_id: Yup.string().required("Required"),
});

interface StaffAddRegistrationDialogProps {
  /** Fixed event — omit when using `events` picker mode */
  eventId?: number;
  role: StaffRole;
  /** Pre-loaded categories when `eventId` is set */
  categories?: StaffEventCategory[];
  /** Event list for picker mode (global registrations, all-events filter) */
  events?: StaffEventRow[];
  onCreated?: () => void;
}

export default function StaffAddRegistrationDialog({
  eventId: fixedEventId,
  role,
  categories = [],
  events,
  onCreated,
}: StaffAddRegistrationDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    creatingStaffRegistration,
    createStaffRegistrationError,
    eventDetail,
    loadingEventDetail,
  } = useAppSelector((s) => s.staffPortal);
  const [open, setOpen] = useState(false);
  const [pickedEventId, setPickedEventId] = useState("");

  const resolvedEventId =
    fixedEventId ?? (pickedEventId ? Number(pickedEventId) : undefined);
  const resolvedCategories =
    fixedEventId != null ? categories : (eventDetail?.categories ?? []);

  useEffect(() => {
    if (!open || fixedEventId != null || !pickedEventId) return;
    dispatch(fetchStaffEventDetail({ eventId: Number(pickedEventId), role }));
  }, [open, fixedEventId, pickedEventId, dispatch, role]);

  useEffect(() => {
    if (!open) {
      setPickedEventId("");
    }
  }, [open]);

  const formik = useFormik({
    initialValues: {
      athlete_email: "",
      event_category_id: "",
      comp: true,
      manual_sale: false,
      create_guest: false,
      guest_first_name: "",
      guest_last_name: "",
      guest_date_of_birth: "",
      managed_by_purchaser: false,
      purchaser_email: "",
      waiver_waived: false,
      bib_number: "",
    },
    validationSchema: schema,
    enableReinitialize: true,
    onSubmit: async (values, { resetForm }) => {
      if (!resolvedEventId) return;
      const result = await dispatch(
        createStaffRegistration({
          eventId: resolvedEventId,
          role,
          body: {
            athlete_email: values.athlete_email.trim(),
            event_category_id: Number(values.event_category_id),
            comp: values.manual_sale ? false : values.comp,
            manual_sale: values.manual_sale || undefined,
            create_guest: values.create_guest || undefined,
            guest_first_name: values.create_guest ? values.guest_first_name.trim() : undefined,
            guest_last_name: values.create_guest ? values.guest_last_name.trim() : undefined,
            guest_date_of_birth: values.create_guest ? values.guest_date_of_birth : undefined,
            managed_by_purchaser: values.managed_by_purchaser || undefined,
            purchaser_email: values.create_guest && values.purchaser_email.trim() ? values.purchaser_email.trim() : undefined,
            waiver_waived: values.waiver_waived,
            bib_number: values.bib_number.trim() || undefined,
          },
        }),
      );
      if (createStaffRegistration.fulfilled.match(result)) {
        resetForm();
        setOpen(false);
        onCreated?.();
      }
    },
  });

  const activeCategories = resolvedCategories.filter((c) => c.is_active);
  const canSubmit =
    resolvedEventId != null &&
    activeCategories.length > 0 &&
    !creatingStaffRegistration &&
    (!eventDetail?.event?.requires_waiver ||
      eventDetail.event.requires_waiver === 0 ||
      formik.values.waiver_waived);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          {t("staffPortal.registrations.addManual")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("staffPortal.registrations.addManualTitle")}</DialogTitle>
          <DialogDescription>{t("staffPortal.registrations.addManualSubtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={formik.handleSubmit} className="space-y-4 mt-2">
          {events && fixedEventId == null ? (
            <div className="space-y-2">
              <Label htmlFor="pick-event">{t("staffPortal.registrations.selectEvent")}</Label>
              <Select
                value={pickedEventId}
                onValueChange={(v) => {
                  setPickedEventId(v);
                  formik.setFieldValue("event_category_id", "");
                }}
              >
                <SelectTrigger id="pick-event">
                  <SelectValue placeholder={t("staffPortal.registrations.selectEvent")} />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={String(ev.id)}>
                      {ev.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="athlete_email">{t("staffPortal.team.fieldEmail")}</Label>
            <Input id="athlete_email" type="email" {...formik.getFieldProps("athlete_email")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={formik.values.create_guest}
              onCheckedChange={(v) => formik.setFieldValue("create_guest", Boolean(v))}
            />
            {t("staffPortal.registrations.createGuest")}
          </label>
          {formik.values.create_guest ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("staffPortal.registrations.guestFirstName")}</Label>
                <Input {...formik.getFieldProps("guest_first_name")} />
              </div>
              <div className="space-y-2">
                <Label>{t("staffPortal.registrations.guestLastName")}</Label>
                <Input {...formik.getFieldProps("guest_last_name")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("staffPortal.registrations.guestDob")}</Label>
                <Input type="date" {...formik.getFieldProps("guest_date_of_birth")} />
              </div>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <Checkbox
                  checked={formik.values.managed_by_purchaser}
                  onCheckedChange={(v) => formik.setFieldValue("managed_by_purchaser", Boolean(v))}
                />
                <span>{t("staffPortal.registrations.managedByPurchaser")}</span>
              </label>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("staffPortal.registrations.purchaserEmail")}</Label>
                <Input type="email" {...formik.getFieldProps("purchaser_email")} />
                <p className="text-xs text-muted-foreground">{t("staffPortal.registrations.purchaserEmailHint")}</p>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="category">{t("staffPortal.people.colCategory")}</Label>
            {loadingEventDetail && fixedEventId == null && pickedEventId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : (
              <Select
                value={formik.values.event_category_id}
                onValueChange={(v) => formik.setFieldValue("event_category_id", v)}
                disabled={!resolvedEventId || activeCategories.length === 0}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder={t("staffPortal.registrations.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} — ${(c.price_cents / 100).toFixed(0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bib">{t("staffPortal.registrations.bibOptional")}</Label>
            <Input id="bib" {...formik.getFieldProps("bib_number")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={formik.values.comp && !formik.values.manual_sale}
              onCheckedChange={(v) => {
                formik.setFieldValue("comp", Boolean(v));
                if (v) formik.setFieldValue("manual_sale", false);
              }}
            />
            {t("staffPortal.registrations.modeComp")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={formik.values.manual_sale}
              onCheckedChange={(v) => {
                formik.setFieldValue("manual_sale", Boolean(v));
                if (v) formik.setFieldValue("comp", false);
              }}
            />
            {t("staffPortal.registrations.modePaid")}
          </label>
          {eventDetail?.event?.requires_waiver !== false &&
          eventDetail?.event?.requires_waiver !== 0 ? (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={formik.values.waiver_waived}
                onCheckedChange={(v) => formik.setFieldValue("waiver_waived", Boolean(v))}
              />
              <span className="leading-snug text-muted-foreground">
                {t("staffPortal.registrations.waiverWaivedManual")}
              </span>
            </label>
          ) : null}
          {createStaffRegistrationError ? (
            <p className="text-sm text-destructive">{createStaffRegistrationError}</p>
          ) : null}
          <Button type="submit" disabled={!canSubmit} className="w-full">
            {creatingStaffRegistration ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.registrations.addManualSubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
