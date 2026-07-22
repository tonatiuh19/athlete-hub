import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Banknote } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import StaffPayoutSetupWizard from "@/components/staff/StaffPayoutSetupWizard";
import { StaffFormSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { canAccessStaffPayouts } from "@/utils/staffNav";
import {
  fetchOrganizerPayoutStatus,
  syncOrganizerPayouts,
} from "@/store/slices/staffPortalSlice";

export default function StaffPayouts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const {
    payoutStatus,
    loadingPayoutStatus,
    payoutStatusError,
  } = useAppSelector((s) => s.staffPortal);

  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const canAccess = canAccessStaffPayouts(role === "admin", organizerRole);

  useEffect(() => {
    void dispatch(fetchOrganizerPayoutStatus());
  }, [dispatch]);

  useEffect(() => {
    const connect = searchParams.get("connect");
    if (connect === "return" || connect === "refresh") {
      void dispatch(syncOrganizerPayouts());
    }
    const mp = searchParams.get("mp");
    if (mp === "connected") {
      void dispatch(fetchOrganizerPayoutStatus());
      toast({ title: t("staffPortal.payouts.mpConnected") });
    } else if (mp === "error") {
      toast({
        variant: "destructive",
        title: t("staffPortal.payouts.mpConnectError"),
      });
    }
  }, [dispatch, searchParams, t, toast]);

  if (!canAccess || !role) {
    return <Navigate to="/staff" replace />;
  }

  return (
    <div className="max-w-3xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.payouts.title")}
        description={t("staffPortal.payouts.subtitle")}
      />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="w-7 h-7 text-primary" />
          {t("staffPortal.payouts.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.payouts.subtitle")}</p>
      </div>

      {loadingPayoutStatus && !payoutStatus ? (
        <div className="card-sport p-5 sm:p-6" aria-busy="true">
          <StaffFormSkeleton fields={5} />
        </div>
      ) : null}

      {payoutStatusError ? (
        <p className="text-sm text-destructive">{payoutStatusError}</p>
      ) : null}

      {payoutStatus ? <StaffPayoutSetupWizard payoutStatus={payoutStatus} /> : null}
    </div>
  );
}
