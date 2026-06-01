import { MapPin, Pencil, Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import EventsMap from "@/components/events/EventsMap";
import { Button } from "@/components/ui/button";
import { parseLineString } from "@/utils/courseMapUtils";
import type { StaffEventCoursePayload } from "@shared/api";

interface StaffCourseSummaryCardProps {
  course: StaffEventCoursePayload | null;
  onOpenWizard: () => void;
}

export default function StaffCourseSummaryCard({ course, onOpenWizard }: StaffCourseSummaryCardProps) {
  const { t } = useTranslation();
  const routePoints = course ? parseLineString(course.routeGeojson).length : 0;
  const hasCourse = routePoints >= 2;

  return (
    <div className="space-y-4">
      {hasCourse && course ? (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card-sport p-4 flex items-center gap-3">
              <Route className="w-5 h-5 text-cyan shrink-0" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.distance")}</p>
                <p className="text-lg font-bold text-cyan">{course.distanceKm ?? "—"} km</p>
              </div>
            </div>
            <div className="card-sport p-4 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-cyan shrink-0" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.poiList")}</p>
                <p className="text-lg font-bold">{course.points?.length ?? 0}</p>
              </div>
            </div>
            <div className="card-sport p-4 flex items-center gap-3">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.elevation")}</p>
                <p className="text-lg font-bold">
                  {course.elevationGainM != null ? `${course.elevationGainM} m` : "—"}
                </p>
              </div>
            </div>
          </div>
          <EventsMap
            courseRoute={course.routeGeojson}
            coursePoints={course.points}
            interactive={false}
            height={220}
            className="rounded-xl opacity-90"
          />
        </>
      ) : (
        <div className="card-sport p-8 text-center border-dashed">
          <Route className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {t("staffPortal.courseEditor.summaryEmpty")}
          </p>
        </div>
      )}

      <Button type="button" onClick={onOpenWizard} className="w-full sm:w-auto">
        <Pencil className="w-4 h-4 mr-2" />
        {hasCourse ? t("staffPortal.courseEditor.editCourse") : t("staffPortal.courseEditor.createCourse")}
      </Button>
    </div>
  );
}
