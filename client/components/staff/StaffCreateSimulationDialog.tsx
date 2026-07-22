import { useEffect, useState } from "react";
import { FlaskConical, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { fetchSportTypes } from "@/store/slices/marketplaceSlice";
import {
  createOrganizerSimulation,
  fetchOrganizerSimulations,
  fetchSimulationCloneCandidates,
} from "@/store/slices/simulationSlice";
import { toast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

export default function StaffCreateSimulationDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { sportTypes } = useAppSelector((s) => s.marketplace);
  const { mutating, quota, cloneCandidates } = useAppSelector((s) => s.simulation);

  const [title, setTitle] = useState("");
  const [sportTypeId, setSportTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [cloneFrom, setCloneFrom] = useState("none");

  useEffect(() => {
    if (!open) return;
    void dispatch(fetchSportTypes());
    void dispatch(fetchOrganizerSimulations());
    void dispatch(fetchSimulationCloneCandidates());
  }, [open, dispatch]);

  const onCreate = async () => {
    const cloneId = cloneFrom === "none" ? null : Number(cloneFrom);
    const sportId = Number(sportTypeId);
    if (!cloneId && (!title.trim() || !sportId || !startDate)) {
      toast({ title: t("simulation.createRequired"), variant: "destructive" });
      return;
    }
    const result = await dispatch(
      createOrganizerSimulation({
        title: title.trim() || t("simulation.defaultTitle"),
        sportTypeId: sportId || 1,
        startDate:
          startDate ||
          new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        cloneFromEventId: cloneId,
      }),
    );
    if (createOrganizerSimulation.fulfilled.match(result)) {
      toast({ title: t("simulation.created") });
      const url = result.payload.access_url;
      if (url) {
        try {
          await navigator.clipboard.writeText(url);
          toast({ title: t("simulation.linkCopied") });
        } catch {
          /* ignore */
        }
      }
      setTitle("");
      setSportTypeId("");
      setStartDate("");
      setCloneFrom("none");
      onOpenChange(false);
      onCreated?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {t("simulation.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("simulation.staffSubtitle", {
              max: quota.max_active,
              regs: quota.max_regs_per_event,
              days: quota.ttl_days,
            })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("simulation.futureCost")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("simulation.fieldTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("simulation.fieldStart")}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("simulation.fieldSport")}</Label>
            <Select value={sportTypeId} onValueChange={setSportTypeId}>
              <SelectTrigger>
                <SelectValue placeholder={t("simulation.pickSport")} />
              </SelectTrigger>
              <SelectContent>
                {sportTypes.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("simulation.fieldClone")}</Label>
            <Select value={cloneFrom} onValueChange={setCloneFrom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("simulation.noClone")}</SelectItem>
                {cloneCandidates.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void onCreate()} disabled={mutating}>
            {mutating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {t("simulation.createCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
