import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Link2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  assignStaffOrganizerEvents,
  fetchAdminEvents,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import type { AdminOrganizerLinkedEvent } from "@shared/api";

interface StaffOrganizerEventsSectionProps {
  organizerId: number;
  events: AdminOrganizerLinkedEvent[];
}

export default function StaffOrganizerEventsSection({
  organizerId,
  events,
}: StaffOrganizerEventsSectionProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { events: allEvents, loadingEvents } = useAppSelector((s) => s.staffPortal);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const dateLocale = getDateFnsLocale(i18n.language);

  const linkedIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);

  useEffect(() => {
    if (open) {
      dispatch(fetchAdminEvents({}));
      setSelected([]);
    }
  }, [open, dispatch]);

  const linkableEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEvents.filter((e) => {
      if (linkedIds.has(e.id)) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.organizer_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allEvents, linkedIds, query]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAssign = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    const result = await dispatch(
      assignStaffOrganizerEvents({ organizerId, event_ids: selected }),
    );
    setSaving(false);
    if (assignStaffOrganizerEvents.fulfilled.match(result)) {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          {t("staffPortal.staffManagement.eventsSection")}
        </h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-8">
              <Link2 className="w-3.5 h-3.5 mr-1.5" />
              {t("staffPortal.staffManagement.linkEvents")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("staffPortal.staffManagement.linkEventsTitle")}</DialogTitle>
              <DialogDescription>{t("staffPortal.staffManagement.linkEventsSubtitle")}</DialogDescription>
            </DialogHeader>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("staffPortal.staffManagement.searchLinkEvents")}
              className="mt-2"
            />
            {loadingEvents ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : linkableEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("staffPortal.staffManagement.noLinkableEvents")}
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto mt-3">
                {linkableEvents.map((e) => (
                  <li key={e.id}>
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-cyan/30 cursor-pointer">
                      <Checkbox
                        checked={selected.includes(e.id)}
                        onCheckedChange={() => toggle(e.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.organizer_name || t("staffPortal.staffManagement.unassignedOrg")} ·{" "}
                          {format(new Date(e.start_date), "d MMM yyyy", { locale: dateLocale })}
                        </p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              className="w-full mt-2"
              disabled={selected.length === 0 || saving}
              onClick={handleAssign}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("staffPortal.staffManagement.linkEventsSubmit", { count: selected.length })}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground card-sport p-4">
          {t("staffPortal.staffManagement.noLinkedEvents")}
        </p>
      ) : (
        <div className="card-sport overflow-hidden">
          <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">{t("staffPortal.people.colEvent")}</th>
                <th className="p-3 font-medium">{t("staffPortal.staffManagement.fieldStatus")}</th>
                <th className="p-3 font-medium shrink-0">{t("staffPortal.staffManagement.colCreated")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="p-3">
                    <Link
                      to={`/staff/events/${e.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {e.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">/{e.slug}</p>
                  </td>
                  <td className="p-3">
                    <StaffStatusBadge status={e.status} />
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {e.start_date
                      ? format(new Date(e.start_date), "d MMM yyyy", { locale: dateLocale })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
