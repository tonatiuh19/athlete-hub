import { Navigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import StaffGlobalRegistrationsPanel from "@/components/staff/StaffGlobalRegistrationsPanel";
import { useAppSelector } from "@/store/hooks";

/** Organizer-only registrations page. Admins use /staff/athletes?tab=registrations */
export default function StaffRegistrations() {
  const { t } = useTranslation();
  const { role } = useAppSelector((s) => s.staffAuth);

  if (role === "admin") {
    return <Navigate to="/staff/athletes?tab=registrations" replace />;
  }

  if (role !== "organizer") {
    return <Navigate to="/staff" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.registrations.title")}
        description={t("staffPortal.registrations.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-cyan" />
          {t("staffPortal.registrations.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("staffPortal.registrations.subtitle")}
        </p>
      </div>

      <StaffGlobalRegistrationsPanel role="organizer" />
    </div>
  );
}
