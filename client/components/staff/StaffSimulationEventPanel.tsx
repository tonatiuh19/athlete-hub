import { Copy, ExternalLink, FlaskConical, Link2, Loader2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  regenerateOrganizerSimulationLink,
  resetAdminSimulation,
  resetOrganizerSimulation,
} from "@/store/slices/simulationSlice";
import { fetchStaffEventDetail } from "@/store/slices/staffPortalSlice";
import { canOrganizerManageSimulations } from "@shared/staffRoles";
import { toast } from "@/hooks/use-toast";
import type { StaffRole } from "@shared/api";

type Props = {
  eventId: number;
  staffRole: StaffRole;
  isSimulation: boolean;
  accessToken?: string | null;
  expiresAt?: string | null;
};

export default function StaffSimulationEventPanel({
  eventId,
  staffRole,
  isSimulation,
  accessToken,
  expiresAt,
}: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { mutating } = useAppSelector((s) => s.simulation);

  if (!isSimulation) return null;

  const isAdmin = role === "admin";
  const isOwner =
    user?.type === "organizer" && canOrganizerManageSimulations(user.role);
  const canManage = isAdmin || isOwner;
  const accessUrl = accessToken ? `/events/sim/${accessToken}` : null;

  const copyLink = async () => {
    if (!accessUrl) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${accessUrl}`,
      );
      toast({ title: t("simulation.linkCopied") });
    } catch {
      toast({ title: t("simulation.copyFailed"), variant: "destructive" });
    }
  };

  const onRegenerate = async () => {
    if (!isOwner) return;
    const result = await dispatch(regenerateOrganizerSimulationLink(eventId));
    if (regenerateOrganizerSimulationLink.fulfilled.match(result)) {
      toast({ title: t("simulation.linkCopied") });
      void dispatch(fetchStaffEventDetail({ eventId, role: staffRole }));
      if (result.payload.access_url) {
        try {
          await navigator.clipboard.writeText(result.payload.access_url);
        } catch {
          /* ignore */
        }
      }
    }
  };

  const onReset = async () => {
    const result = isAdmin
      ? await dispatch(resetAdminSimulation(eventId))
      : await dispatch(resetOrganizerSimulation(eventId));
    if (
      resetAdminSimulation.fulfilled.match(result) ||
      resetOrganizerSimulation.fulfilled.match(result)
    ) {
      toast({ title: t("simulation.resetDone") });
      void dispatch(fetchStaffEventDetail({ eventId, role: staffRole }));
    }
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FlaskConical className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-foreground">{t("simulation.badge")}</p>
          <p className="text-sm text-muted-foreground">{t("simulation.hubHint")}</p>
          {expiresAt ? (
            <p className="text-xs text-muted-foreground">
              {t("simulation.expires", { date: String(expiresAt).slice(0, 10) })}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("simulation.futureCost")}</p>
        </div>
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {accessUrl ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
                <Copy className="mr-2 h-4 w-4" />
                {t("simulation.copyLink")}
              </Button>
              <Button asChild type="button" size="sm" variant="outline">
                <Link to={accessUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("simulation.openLink")}
                </Link>
              </Button>
            </>
          ) : null}
          {isOwner ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={mutating}
              onClick={() => void onRegenerate()}
            >
              {mutating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {t("simulation.regenerate")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={mutating}
            onClick={() => void onReset()}
          >
            {mutating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {t("simulation.reset")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("simulation.ownerOnly")}</p>
      )}
    </div>
  );
}
