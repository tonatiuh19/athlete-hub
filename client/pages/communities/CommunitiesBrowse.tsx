import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import CommunityCard from "@/components/communities/CommunityCard";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicHome } from "@/store/slices/publicHomeSlice";
import {
  fetchPublicTeams,
  setPublicTeamsSort,
  type PublicTeamsSort,
} from "@/store/slices/publicTeamsSlice";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function CommunitiesBrowse() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: homeData } = useAppSelector((s) => s.publicHome);
  const { teams, total, page, loading, loadingMore, error, sort, query } =
    useAppSelector((s) => s.publicTeams);
  const { token } = useAppSelector((s) => s.athleteAuth);

  const [searchInput, setSearchInput] = useState("");

  const loadTeams = useCallback(
    (opts?: {
      q?: string;
      page?: number;
      sort?: PublicTeamsSort;
      append?: boolean;
    }) => {
      void dispatch(
        fetchPublicTeams({
          q: opts?.q ?? query,
          page: opts?.page ?? 1,
          sort: opts?.sort ?? sort,
          append: opts?.append,
        }),
      );
    },
    [dispatch, query, sort],
  );

  useEffect(() => {
    dispatch(fetchPublicHome());
    void dispatch(fetchPublicTeams({ page: 1 }));
  }, [dispatch]);

  const stats = useMemo(
    () => ({
      publicTeams: homeData?.stats.public_teams ?? total,
      activeAthletes: homeData?.stats.active_athletes ?? 0,
    }),
    [homeData, total],
  );

  const featuredTeam = teams[0];
  const gridTeams = featuredTeam ? teams.slice(1) : teams;
  const hasMore = teams.length < total;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTeams({ q: searchInput.trim(), page: 1 });
  };

  const handleSort = (next: PublicTeamsSort) => {
    dispatch(setPublicTeamsSort(next));
    loadTeams({ sort: next, page: 1, q: query });
  };

  return (
    <>
      <MetaHelmet
        title={t("communities.meta.title")}
        description={t("communities.meta.description")}
        path="/communities"
      />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-triboo-black" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20 w-full min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            {/*             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              {t("communities.hero.eyebrow")}
            </div> */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              {t("communities.hero.title")}
              <span className="block triboo-shimmer-text mt-1 pb-1">
                {t("communities.hero.titleHighlight")}
              </span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg mt-4 leading-relaxed max-w-2xl">
              {t("communities.hero.subtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl"
          >
            {[
              {
                label: t("communities.stats.tribes"),
                value: stats.publicTeams.toLocaleString(),
                icon: UsersRound,
              },
              {
                label: t("communities.stats.athletes"),
                value: stats.activeAthletes.toLocaleString(),
                icon: TrendingUp,
              },
              {
                label: t("communities.stats.joinable"),
                value: t("communities.stats.free"),
                icon: Sparkles,
                className: "col-span-2 md:col-span-1",
              },
            ].map(({ label, value, icon: Icon, className }) => (
              <div
                key={label}
                className={cn(
                  "rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm p-4",
                  className,
                )}
              >
                <Icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            onSubmit={handleSearch}
            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("communities.searchPlaceholder")}
                className="h-12 pl-10 rounded-xl bg-card/80 border-border"
              />
            </div>
            <Button
              type="submit"
              className="h-12 px-6 rounded-xl btn-primary shrink-0"
            >
              {t("communities.search")}
            </Button>
          </motion.form>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14 w-full min-w-0 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {t("communities.browseTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("communities.resultsCount", { count: total })}
            </p>
          </div>
          <div className="flex items-center gap-2 p-1 rounded-xl bg-muted/40 border border-border">
            {(["members", "newest"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSort(key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  sort === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`communities.sort.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <PortalErrorAlert
          error={error}
          onRetry={() => loadTeams({ page: 1 })}
        />

        {loading && teams.length === 0 ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : teams.length === 0 ? (
          <div className="card-sport p-10 text-center space-y-3">
            <UsersRound className="w-10 h-10 text-primary mx-auto opacity-80" />
            <p className="text-muted-foreground">{t("communities.empty")}</p>
            <Button asChild className="btn-primary rounded-xl">
              <Link to={token ? "/portal/teams" : "/login"}>
                {t("communities.createCta")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {featuredTeam && !query ? (
                <motion.div
                  variants={itemVariants}
                  className="md:col-span-2 lg:col-span-3"
                >
                  <CommunityCard team={featuredTeam} featured rank={1} />
                </motion.div>
              ) : null}
              {gridTeams.map((team, index) => (
                <motion.div key={team.id} variants={itemVariants}>
                  <CommunityCard
                    team={team}
                    rank={!query && featuredTeam ? index + 2 : index + 1}
                  />
                </motion.div>
              ))}
            </motion.div>

            {hasMore ? (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-primary/30 hover:border-primary min-w-[160px]"
                  disabled={loadingMore}
                  onClick={() => loadTeams({ page: page + 1, append: true })}
                >
                  {loadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("communities.loadMore")
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="border-t border-border/60 bg-gradient-to-b from-card/30 to-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-16">
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                {t("communities.cta.title")}
              </h2>
              <p className="text-muted-foreground mt-2">
                {t("communities.cta.subtitle")}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="btn-primary rounded-xl shrink-0 gap-2 h-12"
            >
              <Link to={token ? "/portal/teams" : "/login"}>
                <Plus className="w-4 h-4" />
                {t("communities.createCta")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
