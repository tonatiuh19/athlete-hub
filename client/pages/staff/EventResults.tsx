import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Send, Timer, Trophy, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchEventResults,
  fetchResultSplits,
  fetchStaffEventDetail,
  publishEventResults,
  updateResultSplits,
  upsertEventResults,
} from "@/store/slices/staffPortalSlice";
import { formatRaceTimeMs } from "@/utils/formatRaceTime";
import type { ResultSplitRow, StaffRole } from "@shared/api";

function parseCsvResults(text: string) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const folioIdx = header.findIndex((h) =>
    ["folio", "registration_number", "registration", "num"].includes(h),
  );
  const timeIdx = header.findIndex((h) =>
    ["time", "finish_time", "finish"].includes(h),
  );
  const rankIdx = header.findIndex((h) => ["rank", "overall_rank", "overall"].includes(h));

  const dataLines = folioIdx >= 0 ? lines.slice(1) : lines;
  const folioCol = folioIdx >= 0 ? folioIdx : 0;
  const timeCol = timeIdx >= 0 ? timeIdx : 1;
  const rankCol = rankIdx >= 0 ? rankIdx : 2;

  return dataLines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      registration_number: cols[folioCol] ?? "",
      finish_time: cols[timeCol] ?? "",
      overall_rank: cols[rankCol] ? Number(cols[rankCol]) : undefined,
      status: "finished" as const,
    };
  }).filter((r) => r.registration_number);
}

export default function StaffEventResults() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = Number(eventIdParam);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.staffAuth);
  const {
    eventDetail,
    eventResults,
    loadingResults,
    savingResults,
    publishingResults,
    resultsError,
    resultSplits,
    loadingSplits,
    savingSplits,
    splitsError,
  } = useAppSelector((s) => s.staffPortal);
  const [csvText, setCsvText] = useState("");
  const [singleFolio, setSingleFolio] = useState("");
  const [singleTime, setSingleTime] = useState("");
  const [singleRank, setSingleRank] = useState("");
  const [editingResultId, setEditingResultId] = useState<number | null>(null);
  const [splitDrafts, setSplitDrafts] = useState<ResultSplitRow[]>([]);

  const staffRole: StaffRole = role === "admin" ? "admin" : "organizer";

  useEffect(() => {
    if ((role === "organizer" || role === "admin") && eventId) {
      dispatch(fetchStaffEventDetail({ eventId, role: staffRole }));
      dispatch(fetchEventResults({ eventId, role: staffRole }));
    }
  }, [dispatch, role, eventId, staffRole]);

  useEffect(() => {
    setSplitDrafts(
      resultSplits.length > 0
        ? resultSplits.map((s, i) => ({ ...s, split_order: s.split_order ?? i + 1 }))
        : [{ split_name: "Split 1", split_order: 1, elapsed_ms: 0 }],
    );
  }, [resultSplits]);

  if (role !== "organizer" && role !== "admin") {
    return <Navigate to="/staff" replace />;
  }

  if (!eventId || Number.isNaN(eventId)) {
    return <Navigate to="/staff/events" replace />;
  }

  const event = eventDetail?.event;
  const reload = () => {
    dispatch(fetchEventResults({ eventId, role: staffRole }));
  };

  const handleImportCsv = async () => {
    const results = parseCsvResults(csvText);
    if (results.length === 0) return;
    const result = await dispatch(upsertEventResults({ eventId, results, role: staffRole }));
    if (upsertEventResults.fulfilled.match(result)) {
      setCsvText("");
      reload();
    }
  };

  const handleAddSingle = async () => {
    if (!singleFolio.trim()) return;
    const result = await dispatch(
      upsertEventResults({
        eventId,
        role: staffRole,
        results: [
          {
            registration_number: singleFolio.trim(),
            finish_time: singleTime.trim() || undefined,
            overall_rank: singleRank ? Number(singleRank) : undefined,
            status: "finished",
          },
        ],
      }),
    );
    if (upsertEventResults.fulfilled.match(result)) {
      setSingleFolio("");
      setSingleTime("");
      setSingleRank("");
      reload();
    }
  };

  const handlePublish = async () => {
    await dispatch(publishEventResults({ eventId, role: staffRole }));
    reload();
  };

  const openSplitsEditor = (resultId: number) => {
    setEditingResultId(resultId);
    dispatch(fetchResultSplits({ eventId, resultId, role: staffRole }));
  };

  const handleSaveSplits = async () => {
    if (editingResultId == null) return;
    const result = await dispatch(
      updateResultSplits({
        eventId,
        resultId: editingResultId,
        splits: splitDrafts,
        role: staffRole,
      }),
    );
    if (updateResultSplits.fulfilled.match(result)) {
      setEditingResultId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.results.title")}
        description={t("staffPortal.results.subtitle")}
      />

      <div>
        <Link
          to={`/staff/events/${eventId}/edit`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("staffPortal.eventEdit.back")}
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7 text-primary" />
          {t("staffPortal.results.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {event?.title ?? t("staffPortal.results.subtitle")}
        </p>
      </div>

      <PortalErrorAlert error={resultsError} onRetry={reload} />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-sport p-5 space-y-4">
          <h2 className="font-semibold">{t("staffPortal.results.importCsv")}</h2>
          <p className="text-xs text-muted-foreground">{t("staffPortal.results.csvHint")}</p>
          <Textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"folio,time,rank\nRMX-001,1:23:45,1"}
            className="font-mono text-xs"
          />
          <Button onClick={handleImportCsv} disabled={savingResults || !csvText.trim()}>
            {savingResults ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.results.import")}
          </Button>
        </div>

        <div className="card-sport p-5 space-y-4">
          <h2 className="font-semibold">{t("staffPortal.results.addSingle")}</h2>
          <Input
            placeholder={t("staffPortal.results.folio")}
            value={singleFolio}
            onChange={(e) => setSingleFolio(e.target.value)}
          />
          <Input
            placeholder={t("staffPortal.results.timePlaceholder")}
            value={singleTime}
            onChange={(e) => setSingleTime(e.target.value)}
          />
          <Input
            type="number"
            placeholder={t("staffPortal.results.rankPlaceholder")}
            value={singleRank}
            onChange={(e) => setSingleRank(e.target.value)}
          />
          <Button onClick={handleAddSingle} disabled={savingResults || !singleFolio.trim()}>
            {t("staffPortal.results.add")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-semibold">{t("staffPortal.results.listTitle")}</h2>
        <Button
          variant="outline"
          className="border-cyan text-primary"
          onClick={handlePublish}
          disabled={publishingResults || eventResults.length === 0}
        >
          {publishingResults ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {t("staffPortal.results.publishAll")}
        </Button>
      </div>

      {loadingResults ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : eventResults.length === 0 ? (
        <div className="card-sport p-8 text-center text-muted-foreground">
          {t("staffPortal.results.empty")}
        </div>
      ) : (
        <div className="card-sport overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-4">{t("staffPortal.results.colRank")}</th>
                  <th className="p-4">{t("staffPortal.results.colAthlete")}</th>
                  <th className="p-4">{t("staffPortal.results.folio")}</th>
                  <th className="p-4">{t("staffPortal.results.colTime")}</th>
                  <th className="p-4">{t("staffPortal.results.colStatus")}</th>
                  <th className="p-4">{t("staffPortal.results.colSplits")}</th>
                </tr>
              </thead>
              <tbody>
                {eventResults.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="p-4 font-bold text-primary">{r.overall_rank ?? "—"}</td>
                    <td className="p-4">
                      {r.athlete_first_name} {r.athlete_last_name}
                      {r.category_name ? (
                        <p className="text-xs text-muted-foreground">{r.category_name}</p>
                      ) : null}
                    </td>
                    <td className="p-4 font-mono text-xs">{r.registration_number}</td>
                    <td className="p-4">{formatRaceTimeMs(r.finish_time_ms)}</td>
                    <td className="p-4">
                      <StaffStatusBadge status={r.published_at ? "published" : r.status} />
                    </td>
                    <td className="p-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openSplitsEditor(r.id)}
                      >
                        <Timer className="w-3.5 h-3.5 mr-1" />
                        {t("staffPortal.results.editSplits")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingResultId != null ? (
        <div className="card-sport p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t("staffPortal.results.splitsTitle")}</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingResultId(null)}>
              {t("common.cancel")}
            </Button>
          </div>
          {splitsError ? <p className="text-sm text-destructive">{splitsError}</p> : null}
          {loadingSplits ? (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <div className="space-y-2">
              {splitDrafts.map((split, i) => (
                <div key={i} className="grid sm:grid-cols-4 gap-2">
                  <Input
                    placeholder={t("staffPortal.results.splitName")}
                    value={split.split_name}
                    onChange={(e) => {
                      const next = [...splitDrafts];
                      next[i] = { ...next[i], split_name: e.target.value };
                      setSplitDrafts(next);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder={t("staffPortal.results.splitKm")}
                    value={split.distance_km ?? ""}
                    onChange={(e) => {
                      const next = [...splitDrafts];
                      next[i] = {
                        ...next[i],
                        distance_km: e.target.value ? Number(e.target.value) : null,
                      };
                      setSplitDrafts(next);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder={t("staffPortal.results.splitElapsedMs")}
                    value={split.elapsed_ms}
                    onChange={(e) => {
                      const next = [...splitDrafts];
                      next[i] = { ...next[i], elapsed_ms: Number(e.target.value) || 0 };
                      setSplitDrafts(next);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder={t("staffPortal.results.splitOrder")}
                    value={split.split_order}
                    onChange={(e) => {
                      const next = [...splitDrafts];
                      next[i] = { ...next[i], split_order: Number(e.target.value) || i + 1 };
                      setSplitDrafts(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSplitDrafts([
                  ...splitDrafts,
                  {
                    split_name: `Split ${splitDrafts.length + 1}`,
                    split_order: splitDrafts.length + 1,
                    elapsed_ms: 0,
                  },
                ])
              }
            >
              {t("staffPortal.results.addSplit")}
            </Button>
            <Button type="button" disabled={savingSplits} onClick={handleSaveSplits}>
              {savingSplits ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t("staffPortal.results.saveSplits")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
