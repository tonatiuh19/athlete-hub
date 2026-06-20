import { Loader2, Link2, RefreshCw, ShieldOff, ShieldCheck, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import StaffFeeCalculatorCard from "@/components/staff/StaffFeeCalculatorCard";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  adminDisableOrganizerConnect,
  adminEnableOrganizerConnect,
  adminLinkOrganizerConnectAccount,
  adminOnboardOrganizerConnect,
  adminSyncOrganizerConnect,
  fetchAdminOrganizerConnect,
} from "@/store/slices/staffPortalSlice";
import { useEffect, useState } from "react";

interface StaffAdminConnectPanelProps {
  organizerId: number;
}

export default function StaffAdminConnectPanel({ organizerId }: StaffAdminConnectPanelProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    adminOrganizerConnect,
    loadingAdminOrganizerConnect,
    adminOrganizerConnectError,
    adminConnectActionLoading,
  } = useAppSelector((s) => s.staffPortal);
  const [linkAccountId, setLinkAccountId] = useState("");

  useEffect(() => {
    void dispatch(fetchAdminOrganizerConnect({ organizerId }));
  }, [dispatch, organizerId]);

  const status = adminOrganizerConnect?.organizer.stripe_connect_status ?? "not_started";
  const feePercent = adminOrganizerConnect?.serviceFeePercent ?? 11;
  const feePresentation = adminOrganizerConnect?.feePresentation ?? "pass_through";

  const openOnboard = async () => {
    const result = await dispatch(adminOnboardOrganizerConnect({ organizerId }));
    if (adminOnboardOrganizerConnect.fulfilled.match(result) && result.payload.url) {
      window.open(result.payload.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="card-sport p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">{t("staffPortal.payouts.adminSectionTitle")}</h4>
        {loadingAdminOrganizerConnect ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("staffPortal.payouts.adminSectionHint")}</p>

      {adminOrganizerConnectError ? (
        <p className="text-sm text-destructive">{adminOrganizerConnectError}</p>
      ) : null}

      {adminOrganizerConnect ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("staffPortal.finance.connectStatus")}</span>
            <StaffStatusBadge status={status} />
            {adminOrganizerConnect.payoutReady ? (
              <span className="text-accent text-xs">{t("staffPortal.payouts.statusReady")}</span>
            ) : null}
          </div>

          {adminOrganizerConnect.organizer.stripe_account_id ? (
            <p className="text-xs font-mono text-muted-foreground break-all">
              {adminOrganizerConnect.organizer.stripe_account_id}
            </p>
          ) : null}

          <StaffFeeCalculatorCard
            serviceFeePercent={feePercent}
            feePresentation={feePresentation}
            compact
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openOnboard} disabled={adminConnectActionLoading}>
              <ExternalLink className="w-4 h-4 mr-1" />
              {t("staffPortal.payouts.adminStartOnboard")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => dispatch(adminSyncOrganizerConnect({ organizerId }))}
              disabled={adminConnectActionLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              {t("staffPortal.payouts.syncStatus")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => dispatch(adminDisableOrganizerConnect({ organizerId }))}
              disabled={adminConnectActionLoading}
            >
              <ShieldOff className="w-4 h-4 mr-1" />
              {t("staffPortal.payouts.adminDisable")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => dispatch(adminEnableOrganizerConnect({ organizerId }))}
              disabled={adminConnectActionLoading}
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              {t("staffPortal.payouts.adminEnable")}
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Label htmlFor="link_acct">{t("staffPortal.payouts.adminLinkAccount")}</Label>
            <div className="flex gap-2">
              <Input
                id="link_acct"
                className="min-w-0 flex-1"
                placeholder={t("staffPortal.payouts.adminLinkAccountPlaceholder")}
                value={linkAccountId}
                onChange={(e) => setLinkAccountId(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!linkAccountId.trim().startsWith("acct_") || adminConnectActionLoading}
                onClick={() =>
                  dispatch(
                    adminLinkOrganizerConnectAccount({
                      organizerId,
                      stripe_account_id: linkAccountId.trim(),
                    }),
                  )
                }
              >
                <Link2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
