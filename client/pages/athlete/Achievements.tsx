import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Award,
  Flame,
  Loader2,
  Medal,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { Progress } from "@/components/ui/progress";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAchievements,
  fetchGamification,
} from "@/store/slices/gamificationSlice";
import { format } from "date-fns";
import { getDateFnsLocale } from "@/utils/dateLocale";

const BADGE_ICONS: Record<string, typeof Trophy> = {
  registration: Trophy,
  result: Medal,
  streak: Flame,
  team: Star,
};

export default function AthleteAchievements() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { profile, achievements, loading, loadingAchievements, error } =
    useAppSelector((s) => s.gamification);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    dispatch(fetchGamification());
    dispatch(fetchAchievements());
  }, [dispatch]);

  const xpProgress = useMemo(() => {
    if (!profile) return 0;
    const currentLevelXp = (profile.profile.level - 1) * 100;
    const intoLevel = profile.profile.xp_total - currentLevelXp;
    const span = profile.nextLevelXp - currentLevelXp;
    if (span <= 0) return 100;
    return Math.min(100, Math.round((intoLevel / span) * 100));
  }, [profile]);

  const loadAll = () => {
    dispatch(fetchGamification());
    dispatch(fetchAchievements());
  };

  const isLoading = loading && !profile;

  return (
    <div className="max-w-3xl mx-auto space-y-8 min-w-0">
      <MetaHelmet
        title={t("athletePortal.achievements.title")}
        description={t("athletePortal.achievements.subtitle")}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-br from-purple-accent/15 via-card to-cyan/10 p-6 md:p-8"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan to-blue-electric flex items-center justify-center shadow-lg shadow-cyan/20">
              <Sparkles className="w-8 h-8 text-navy-deep" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-cyan font-semibold">
                {t("athletePortal.achievements.level")}
              </p>
              <p className="text-4xl font-bold">
                {profile?.profile.level ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("athletePortal.achievements.xp", {
                  current: profile?.profile.xp_total ?? 0,
                  next: profile?.nextLevelXp ?? 100,
                })}
              </span>
              <span className="font-medium text-cyan">{xpProgress}%</span>
            </div>
            <Progress value={xpProgress} className="h-2" />
            <div className="flex flex-wrap gap-4 pt-1 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Flame className="w-4 h-4 text-accent" />
                {t("athletePortal.achievements.streak", {
                  days: profile?.profile.streak_days ?? 0,
                })}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <PortalErrorAlert error={error} onRetry={loadAll} />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cyan" />
        </div>
      ) : (
        <>
          {profile && profile.recentAchievements.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan" />
                {t("athletePortal.achievements.badges")}
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {profile.recentAchievements.map((a) => {
                  const Icon = BADGE_ICONS[a.criteria_type] ?? Trophy;
                  return (
                    <div
                      key={a.id}
                      className="shrink-0 w-36 card-sport p-3 text-center space-y-2"
                    >
                      <div className="w-10 h-10 mx-auto rounded-full bg-cyan/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-cyan" />
                      </div>
                      <p className="text-xs font-semibold line-clamp-2">{a.name}</p>
                      <p className="text-[10px] text-accent">+{a.xp_reward} XP</p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Medal className="w-5 h-5 text-cyan" />
              {t("athletePortal.achievements.badges")}
              <span className="text-sm font-normal text-muted-foreground">
                ({achievements.length})
              </span>
            </h2>

            {loadingAchievements && achievements.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : achievements.length === 0 ? (
              <div className="card-sport p-8 text-center text-sm text-muted-foreground">
                {t("athletePortal.achievements.empty")}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {achievements.map((badge, i) => {
                  const Icon = BADGE_ICONS[badge.criteria_type] ?? Trophy;
                  return (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="card-sport p-4 flex gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan/20 to-purple-accent/20 border border-cyan/20 flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6 text-cyan" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{badge.name}</h3>
                        {badge.description ? (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {badge.description}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          <span className="text-accent font-medium">+{badge.xp_reward} XP</span>
                          <span>·</span>
                          <span>
                            {format(new Date(badge.earned_at), "d MMM yyyy", {
                              locale: dateLocale,
                            })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
