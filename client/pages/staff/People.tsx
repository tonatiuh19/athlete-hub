import { Navigate, useSearchParams } from "react-router-dom";
import { Building2, Shield, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import StaffOrganizersPanel from "@/components/staff/StaffOrganizersPanel";
import StaffPlatformAdminsPanel from "@/components/staff/StaffPlatformAdminsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSelector } from "@/store/hooks";

type StaffTab = "organizers" | "admins";

export default function StaffPeople() {
  const { t } = useTranslation();
  const { role } = useAppSelector((s) => s.staffAuth);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  if (tabParam === "payments") {
    return <Navigate to="/staff/payments" replace />;
  }

  const tab: StaffTab = tabParam === "organizers" ? "organizers" : "admins";

  if (role !== "admin") {
    return <Navigate to="/staff" replace />;
  }

  const setTab = (next: StaffTab) => {
    if (next === "admins") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", next);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.staffManagement.title")}
        description={t("staffPortal.staffManagement.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="w-7 h-7 text-cyan" />
          {t("staffPortal.staffManagement.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.staffManagement.subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as StaffTab)}>
        <TabsList className="w-full sm:w-auto flex-wrap h-auto">
          <TabsTrigger value="admins" className="gap-2">
            <Shield className="w-4 h-4 hidden sm:inline" />
            {t("staffPortal.staffManagement.tabAdmins")}
          </TabsTrigger>
          <TabsTrigger value="organizers" className="gap-2">
            <Building2 className="w-4 h-4 hidden sm:inline" />
            {t("staffPortal.staffManagement.tabOrganizers")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="mt-4">
          <StaffPlatformAdminsPanel active={tab === "admins"} />
        </TabsContent>

        <TabsContent value="organizers" className="mt-4">
          <StaffOrganizersPanel active={tab === "organizers"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
