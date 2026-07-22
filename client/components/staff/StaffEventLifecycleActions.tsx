import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StaffRole } from "@shared/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch } from "@/store/hooks";
import {
  deactivateStaffEventListing,
  deleteStaffEvent,
} from "@/store/slices/staffPortalSlice";
import { cn } from "@/lib/utils";

type Props = {
  eventId: number;
  eventTitle: string;
  role: StaffRole;
  /** Hide deactivate when already unlisted/private */
  visibility?: string | null;
  /** Soft-deleted / cancelled events should not show delete again */
  status?: string | null;
  canDeactivate?: boolean;
  canDelete?: boolean;
  compact?: boolean;
  className?: string;
  onDone?: () => void;
};

export default function StaffEventLifecycleActions({
  eventId,
  eventTitle,
  role,
  visibility,
  status,
  canDeactivate = true,
  canDelete = true,
  compact = false,
  className,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<"deactivate" | "delete" | null>(null);

  const isGone = status === "cancelled";
  const alreadyUnlisted =
    visibility === "unlisted" || visibility === "private" || isGone;

  if (isGone || (!canDeactivate && !canDelete)) return null;

  const showDeactivate = canDeactivate && !alreadyUnlisted;
  const showDelete = canDelete;

  const runDeactivate = async () => {
    setBusy("deactivate");
    try {
      const result = await dispatch(
        deactivateStaffEventListing({ eventId, role }),
      );
      if (deactivateStaffEventListing.fulfilled.match(result)) {
        toast({ title: t("staffPortal.events.lifecycle.deactivateSuccess") });
        setDeactivateOpen(false);
        onDone?.();
      } else {
        toast({
          title: t("staffPortal.errors.deactivateEvent"),
          variant: "destructive",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const runDelete = async () => {
    setBusy("delete");
    try {
      const result = await dispatch(deleteStaffEvent({ eventId, role }));
      if (deleteStaffEvent.fulfilled.match(result)) {
        const cancelled = result.payload.cancelledRegistrations;
        toast({
          title: t("staffPortal.events.lifecycle.deleteSuccess"),
          description:
            cancelled > 0
              ? t("staffPortal.events.lifecycle.deleteSuccessRegs", {
                  count: cancelled,
                })
              : undefined,
        });
        setDeleteOpen(false);
        onDone?.();
        navigate("/staff/events");
      } else {
        toast({
          title: t("staffPortal.errors.deleteEvent"),
          variant: "destructive",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {showDeactivate ? (
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "sm"}
            className={cn(compact && "h-8 px-2 text-xs")}
            onClick={(e) => {
              e.stopPropagation();
              setDeactivateOpen(true);
            }}
          >
            <EyeOff className={cn("shrink-0", compact ? "w-3 h-3" : "w-4 h-4 mr-2")} />
            {!compact ? t("staffPortal.events.lifecycle.deactivate") : null}
            {compact ? (
              <span className="ml-1">{t("staffPortal.events.lifecycle.deactivateShort")}</span>
            ) : null}
          </Button>
        ) : null}
        {showDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "text-destructive border-destructive/40 hover:bg-destructive/10",
              compact && "h-8 px-2 text-xs",
            )}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className={cn("shrink-0", compact ? "w-3 h-3" : "w-4 h-4 mr-2")} />
            {!compact ? t("staffPortal.events.lifecycle.delete") : null}
            {compact ? (
              <span className="ml-1">{t("staffPortal.events.lifecycle.deleteShort")}</span>
            ) : null}
          </Button>
        ) : null}
      </div>

      {showDeactivate ? (
      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("staffPortal.events.lifecycle.deactivateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {t("staffPortal.events.lifecycle.deactivateBody", {
                  title: eventTitle,
                })}
              </span>
              <span className="block text-muted-foreground">
                {t("staffPortal.events.lifecycle.deactivateHint")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "deactivate"}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "deactivate"}
              onClick={(e) => {
                e.preventDefault();
                void runDeactivate();
              }}
            >
              {busy === "deactivate"
                ? t("common.loading")
                : t("staffPortal.events.lifecycle.deactivateConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      ) : null}

      {showDelete ? (
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {t("staffPortal.events.lifecycle.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {t("staffPortal.events.lifecycle.deleteWarning", {
                    title: eventTitle,
                  })}
                </p>
                <p>{t("staffPortal.events.lifecycle.deleteBody")}</p>
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-foreground">
                  {t("staffPortal.events.lifecycle.deleteRecommend")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={busy === "delete"}>
              {t("common.cancel")}
            </AlertDialogCancel>
            {showDeactivate ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy === "delete"}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeactivateOpen(true);
                }}
              >
                {t("staffPortal.events.lifecycle.preferDeactivate")}
              </Button>
            ) : null}
            <AlertDialogAction
              disabled={busy === "delete"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void runDelete();
              }}
            >
              {busy === "delete"
                ? t("common.loading")
                : t("staffPortal.events.lifecycle.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      ) : null}
    </>
  );
}
