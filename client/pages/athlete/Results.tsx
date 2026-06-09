import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, Map, Trophy, Medal } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import CoursePaceHeatmap from "@/components/events/CoursePaceHeatmap";
import CourseRouteReplay from "@/components/events/CourseRouteReplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAthleteResults,
  fetchResultVisualization,
} from "@/store/slices/athletePortalSlice";
import { formatPacePerKmMs, formatRaceTimeMs } from "@/utils/raceFormat";
import { getDateFnsLocale } from "@/utils/dateLocale";

export default function AthleteResults() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    results,
    loadingResults,
    resultsError,
    resultVisualization,
    loadingResultViz,
    resultVizError,
  } = useAppSelector((s) => s.athletePortal);
  const [expandedVizId, setExpandedVizId] = useState<number | null>(null);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    dispatch(fetchAthleteResults());
  }, [dispatch]);

  const finishedCount = results.filter((r) => r.status === "finished").length;

  const loadVisualization = (resultId: number) => {
    setExpandedVizId(resultId);
    dispatch(fetchResultVisualization({ resultId }));
  };

  return (
    <div className="max-w-4xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("athletePortal.results.title")}
        description={t("athletePortal.results.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7 text-cyan" />
          {t("athletePortal.results.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("athletePortal.results.subtitle")}
          {finishedCount > 0
            ? ` · ${finishedCount} ${t("athletePortal.dashboard.statCompleted").toLowerCase()}`
            : ""}
        </p>
      </div>

      <PortalErrorAlert
        error={resultsError}
        onRetry={() => dispatch(fetchAthleteResults())}
      />

      {loadingResults ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : resultsError ? null : results.length === 0 ? (
        <div className="card-sport p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-cyan" />
          </div>
          <p className="text-muted-foreground mb-4">{t("athletePortal.results.empty")}</p>
          <Link to="/portal/events" className="btn-primary rounded-xl inline-block">
            {t("athletePortal.results.explore")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => {
            const splits = result.splits ?? [];
            const showViz = expandedVizId === result.id;
            const vizReady =
              showViz &&
              resultVisualization?.resultId === result.id &&
              !loadingResultViz;

            return (
              <div key={result.id} className="card-sport p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold truncate">{result.event_title}</h2>
                      <Badge
                        variant={result.status === "finished" ? "default" : "secondary"}
                      >
                        {t(`athletePortal.results.status.${result.status}`)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.category_name} · {result.registration_number}
                      {result.bib_number
                        ? ` · ${t("athletePortal.registrations.bib")} ${result.bib_number}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(result.start_date), "d MMMM yyyy", {
                        locale: dateLocale,
                      })}
                    </p>
                  </div>
                  {result.overall_rank ? (
                    <div className="flex items-center gap-2 shrink-0 text-cyan">
                      <Medal className="w-5 h-5" />
                      <span className="text-2xl font-bold">#{result.overall_rank}</span>
                    </div>
                  ) : null}
                </div>

                {result.status === "finished" ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("athletePortal.results.finishTime")}
                        </p>
                        <p className="font-bold text-lg">
                          {formatRaceTimeMs(result.finish_time_ms)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("athletePortal.results.pace")}
                        </p>
                        <p className="font-semibold">
                          {formatPacePerKmMs(result.pace_per_km_ms)}
                        </p>
                      </div>
                      {result.category_rank ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("athletePortal.results.categoryRank")}
                          </p>
                          <p className="font-semibold">#{result.category_rank}</p>
                        </div>
                      ) : null}
                      {result.gender_rank ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("athletePortal.results.genderRank")}
                          </p>
                          <p className="font-semibold">#{result.gender_rank}</p>
                        </div>
                      ) : null}
                    </div>

                    {splits.length > 0 ? (
                      <div className="space-y-2 pt-2 border-t border-border/60">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("athletePortal.results.splitsTitle")}
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-border/60">
                          <table className="w-full text-sm min-w-[420px]">
                            <thead>
                              <tr className="text-left text-muted-foreground border-b border-border/60 bg-muted/20">
                                <th className="py-2 px-3 font-medium">
                                  {t("athletePortal.results.splitName")}
                                </th>
                                <th className="py-2 px-3 font-medium">
                                  {t("athletePortal.results.splitDistance")}
                                </th>
                                <th className="py-2 px-3 font-medium">
                                  {t("athletePortal.results.splitElapsed")}
                                </th>
                                <th className="py-2 px-3 font-medium">
                                  {t("athletePortal.results.pace")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {splits.map((split) => (
                                <tr
                                  key={`${split.split_order}-${split.split_name}`}
                                  className="border-b border-border/40 last:border-0"
                                >
                                  <td className="py-2 px-3 font-medium">{split.split_name}</td>
                                  <td className="py-2 px-3 text-muted-foreground">
                                    {split.distance_km != null
                                      ? `${split.distance_km} km`
                                      : "—"}
                                  </td>
                                  <td className="py-2 px-3 tabular-nums">
                                    {formatRaceTimeMs(split.elapsed_ms)}
                                  </td>
                                  <td className="py-2 px-3 tabular-nums text-muted-foreground">
                                    {split.pace_per_km_ms
                                      ? formatPacePerKmMs(split.pace_per_km_ms)
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}

                    <div className="pt-2 border-t border-border/60 space-y-3">
                      {!showViz ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-cyan/30 text-cyan"
                          onClick={() => loadVisualization(result.id)}
                        >
                          <Map className="w-3.5 h-3.5 mr-1.5" />
                          {t("athletePortal.results.viewCourseAnalysis")}
                        </Button>
                      ) : loadingResultViz && !vizReady ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("common.loading")}
                        </div>
                      ) : resultVizError && expandedVizId === result.id ? (
                        <p className="text-sm text-destructive">{resultVizError}</p>
                      ) : vizReady && resultVisualization ? (
                        <div className="space-y-3 animate-in fade-in duration-300">
                          <CoursePaceHeatmap
                            route={resultVisualization.course?.routeGeojson}
                            segments={resultVisualization.paceSegments}
                          />
                          <CourseRouteReplay
                            route={resultVisualization.course?.routeGeojson}
                            finishTimeMs={resultVisualization.finishTimeMs}
                          />
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
