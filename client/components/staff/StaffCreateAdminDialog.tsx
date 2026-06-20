import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, Plus } from "lucide-react";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createStaffAdmin } from "@/store/slices/staffPortalSlice";

const schema = Yup.object({
  email: Yup.string().email("Invalid email").required("Required"),
  first_name: Yup.string().trim().required("Required"),
  last_name: Yup.string().trim().required("Required"),
});

interface StaffCreateAdminDialogProps {
  onCreated?: () => void;
  isSuperAdmin?: boolean;
}

export default function StaffCreateAdminDialog({
  onCreated,
  isSuperAdmin = false,
}: StaffCreateAdminDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { savingStaffAdmin, staffAdminSaveError } = useAppSelector((s) => s.staffPortal);
  const [open, setOpen] = useState(false);

  const formik = useFormik({
    initialValues: { email: "", first_name: "", last_name: "", role: "admin" },
    validationSchema: schema,
    onSubmit: async (values, { resetForm }) => {
      const result = await dispatch(
        createStaffAdmin({
          email: values.email.trim(),
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          role: values.role as "admin" | "super_admin",
        }),
      );
      if (createStaffAdmin.fulfilled.match(result)) {
        resetForm();
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
          {t("staffPortal.staffManagement.addAdmin")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("staffPortal.staffManagement.addAdminTitle")}</DialogTitle>
          <DialogDescription>{t("staffPortal.staffManagement.addAdminSubtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={formik.handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="admin-email">{t("staffPortal.team.fieldEmail")}</Label>
            <Input id="admin-email" type="email" {...formik.getFieldProps("email")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-first">{t("staffPortal.team.fieldFirst")}</Label>
              <Input id="admin-first" {...formik.getFieldProps("first_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-last">{t("staffPortal.team.fieldLast")}</Label>
              <Input id="admin-last" {...formik.getFieldProps("last_name")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-role">{t("staffPortal.team.fieldRole")}</Label>
            <Select value={formik.values.role} onValueChange={(v) => formik.setFieldValue("role", v)}>
              <SelectTrigger id="admin-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                {isSuperAdmin ? <SelectItem value="super_admin">super_admin</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>

          {staffAdminSaveError ? (
            <p className="text-sm text-destructive">{staffAdminSaveError}</p>
          ) : null}

          <Button type="submit" disabled={savingStaffAdmin} className="w-full">
            {savingStaffAdmin ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.staffManagement.addAdminSubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
