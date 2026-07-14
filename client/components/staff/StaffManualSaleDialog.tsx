import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, ShoppingBag } from "lucide-react";
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
import {
  createStaffRegistration,
  fetchOrganizerEvents,
  fetchStaffEventDetail,
} from "@/store/slices/staffPortalSlice";
import type { StaffRole } from "@shared/api";

const schema = Yup.object({
  athlete_email: Yup.string().email("Invalid email").required("Required"),
  event_category_id: Yup.string().required("Required"),
});

interface StaffManualSaleDialogProps {
  role: StaffRole;
  onCreated?: () => void;
}

export default function StaffManualSaleDialog({ role, onCreated }: StaffManualSaleDialogProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    creatingStaffRegistration,
    createStaffRegistrationError,
    eventDetail,
    loadingEventDetail,
    events,
    loadingEvents,
  } = useAppSelector((s) => s.staffPortal);
  const [open, setOpen] = useState(false);
  const [pickedEventId, setPickedEventId] = useState("");

  const resolvedEventId = pickedEventId ? Number(pickedEventId) : undefined;
  const categories = eventDetail?.categories ?? [];

  useEffect(() => {
    if (!open || role !== "organizer") return;
    dispatch(fetchOrganizerEvents({ limit: 100, sortBy: "title", sortDir: "ASC" }));
  }, [open, dispatch, role]);

  useEffect(() => {
    if (!open || !pickedEventId) return;
    dispatch(fetchStaffEventDetail({ eventId: Number(pickedEventId), role }));
  }, [open, pickedEventId, dispatch, role]);

  useEffect(() => {
    if (!open) setPickedEventId("");
  }, [open]);

  const formik = useFormik({
    initialValues: {
      athlete_email: "",
      event_category_id: "",
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
            manual_sale: true,
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

  const selectedCategory = categories.find(
    (c) => String(c.id) === formik.values.event_category_id,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <ShoppingBag className="w-4 h-4 mr-2" />
          {t("staffPortal.finance.manualSaleCta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("staffPortal.finance.manualSaleTitle")}</DialogTitle>
          <DialogDescription>{t("staffPortal.finance.manualSaleSubtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("staffPortal.finance.manualSaleEvent")}</Label>
            <Select value={pickedEventId} onValueChange={setPickedEventId}>
              <SelectTrigger>
                <SelectValue placeholder={t("staffPortal.finance.manualSaleEventPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={String(event.id)}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingEvents ? (
              <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-sale-email">{t("staffPortal.registrations.athleteEmail")}</Label>
            <Input id="manual-sale-email" type="email" {...formik.getFieldProps("athlete_email")} />
          </div>

          <div className="space-y-2">
            <Label>{t("staffPortal.registrations.category")}</Label>
            <Select
              value={formik.values.event_category_id}
              onValueChange={(v) => formik.setFieldValue("event_category_id", v)}
              disabled={!resolvedEventId || loadingEventDetail}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("staffPortal.registrations.selectCategory")} />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => Number(c.price_cents) > 0)
                  .map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name} —{" "}
                      {new Intl.NumberFormat(i18n.language, {
                        style: "currency",
                        currency: category.currency || "MXN",
                      }).format(Number(category.price_cents) / 100)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedCategory ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.finance.manualSaleNoCommission")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-sale-bib">{t("staffPortal.registrations.bibOptional")}</Label>
            <Input id="manual-sale-bib" {...formik.getFieldProps("bib_number")} />
            {eventDetail?.event?.id === resolvedEventId &&
            eventDetail.event.bib_mode !== "separate" ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.eventEdit.bibMode.manualSaleAutoHint")}
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={formik.values.waiver_waived}
              onCheckedChange={(checked) =>
                formik.setFieldValue("waiver_waived", checked === true)
              }
            />
            {t("staffPortal.registrations.waiverWaived")}
          </label>

          {createStaffRegistrationError ? (
            <p className="text-sm text-destructive">{createStaffRegistrationError}</p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={
              creatingStaffRegistration ||
              !resolvedEventId ||
              !formik.values.event_category_id ||
              !formik.values.athlete_email
            }
          >
            {creatingStaffRegistration ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ShoppingBag className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.finance.manualSaleSubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
