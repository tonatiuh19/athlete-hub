import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import { Button } from "@/components/ui/button";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchOrganizerEvents,
  sendBulkMessage,
} from "@/store/slices/staffPortalSlice";

export default function StaffMessaging() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    events,
    loadingEvents,
    eventsError,
    sendingBulkMessage,
    bulkMessageResult,
    bulkMessageError,
  } = useAppSelector((s) => s.staffPortal);

  useEffect(() => {
    dispatch(fetchOrganizerEvents());
  }, [dispatch]);

  const formik = useFormik({
    initialValues: {
      eventId: "",
      subject: "",
      body: "",
    },
    validationSchema: Yup.object({
      eventId: Yup.string().required(t("common.required")),
      subject: Yup.string().trim().min(1).max(500).required(t("common.required")),
      body: Yup.string().trim().min(1).required(t("common.required")),
    }),
    onSubmit: async (values, { resetForm }) => {
      const result = await dispatch(
        sendBulkMessage({
          eventId: Number(values.eventId),
          subject: values.subject.trim(),
          body: values.body.trim(),
        }),
      );
      if (sendBulkMessage.fulfilled.match(result)) {
        resetForm();
      }
    },
  });

  return (
    <div className="max-w-xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.messaging.title")}
        description={t("staffPortal.messaging.subtitle")}
      />

      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-cyan/10 border border-cyan/25">
          <Mail className="w-6 h-6 text-cyan" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("staffPortal.messaging.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("staffPortal.messaging.subtitle")}
          </p>
        </div>
      </div>

      {eventsError ? (
        <p className="text-sm text-destructive">{eventsError}</p>
      ) : null}

      {bulkMessageResult ? (
        <div className="card-sport p-4 flex items-start gap-3 border-accent/30 bg-accent/5">
          <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-sm">
              {t("staffPortal.messaging.sent", {
                queued: bulkMessageResult.queued,
                total: bulkMessageResult.total,
              })}
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={formik.handleSubmit} className="card-sport p-6 space-y-5">
        <div className="space-y-2">
          <Label>{t("staffPortal.messaging.event")}</Label>
          <Select
            value={formik.values.eventId}
            onValueChange={(v) => formik.setFieldValue("eventId", v)}
            disabled={loadingEvents}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("staffPortal.messaging.selectEvent")} />
            </SelectTrigger>
            <SelectContent>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={String(ev.id)}>
                  {ev.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formik.touched.eventId && formik.errors.eventId ? (
            <p className="text-xs text-destructive">{formik.errors.eventId}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{t("staffPortal.messaging.subject")}</Label>
          <Input
            placeholder={t("staffPortal.messaging.subject")}
            {...formik.getFieldProps("subject")}
          />
          {formik.touched.subject && formik.errors.subject ? (
            <p className="text-xs text-destructive">{formik.errors.subject}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{t("staffPortal.messaging.body")}</Label>
          <Textarea
            placeholder={t("staffPortal.messaging.body")}
            className="min-h-[140px]"
            {...formik.getFieldProps("body")}
          />
          {formik.touched.body && formik.errors.body ? (
            <p className="text-xs text-destructive">{formik.errors.body}</p>
          ) : null}
        </div>

        {bulkMessageError ? (
          <p className="text-sm text-destructive">{bulkMessageError}</p>
        ) : null}

        <Button
          type="submit"
          disabled={sendingBulkMessage || loadingEvents}
          className="w-full btn-primary rounded-xl"
        >
          {sendingBulkMessage ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {t("staffPortal.messaging.send")}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
