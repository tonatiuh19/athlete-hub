import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import SiteFooter from "@/components/SiteFooter";
import HomeHero from "@/components/home/HomeHero";
import HomeNavbar from "@/components/home/HomeNavbar";
import SectionHeader from "@/components/home/SectionHeader";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicHome } from "@/store/slices/publicHomeSlice";
import { mapEventToFeaturedCard, mapEventToHeroEvent } from "@/utils/mapEventForHome";
import {
  MapPin,
  Users,
  Trophy,
  Flame,
  ArrowRight,
  Calendar,
  Footprints,
  Sparkles,
  TrendingUp,
  Star,
} from "lucide-react";

const formatStatDisplay = (value: number, suffix = ""): string => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted =
      millions >= 10
        ? Math.round(millions).toString()
        : millions.toFixed(1).replace(/\.0$/, "");
    return `${formatted}M${suffix}`;
  }
  if (value >= 10_000) {
    const thousands = value / 1_000;
    const formatted =
      thousands >= 100
        ? Math.round(thousands).toString()
        : thousands.toFixed(1).replace(/\.0$/, "");
    return `${formatted}K${suffix}`;
  }
  return `${value.toLocaleString()}${suffix}`;
};

const AnimatedCounter = ({
  end,
  duration = 2,
  suffix,
}: {
  end: number;
  duration?: number;
  suffix?: string;
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      setCount(Math.floor(end * progress));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{formatStatDisplay(count, suffix)}</span>;
};

const StatCard = ({
  label,
  value,
  icon: Icon,
  suffix,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  suffix?: string;
}) => (
  <motion.div
    className="group flex h-full min-h-[140px] sm:min-h-[156px] flex-col items-center justify-between rounded-xl border border-gray-700/60 bg-surface-dark/80 p-4 sm:p-5 text-center backdrop-blur-sm transition-all duration-300 hover:border-cyan/50 hover:shadow-glow-cyan"
    whileHover={{ y: -4 }}
  >
    <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan/20 bg-cyan/10 transition-transform group-hover:scale-105 sm:mb-4 sm:h-11 sm:w-11 sm:rounded-xl">
      <Icon className="h-5 w-5 text-cyan sm:h-6 sm:w-6" />
    </div>
    <div className="stat-number flex w-full flex-1 items-center justify-center px-1">
      <AnimatedCounter end={value} suffix={suffix} />
    </div>
    <p className="stat-label mt-2 w-full px-1">{label}</p>
  </motion.div>
);

const EventCard = ({
  title,
  location,
  date,
  distance,
  participants,
  category,
  imageUrl,
  joinLabel,
  athletesLabel,
  slug,
}: {
  title: string;
  location: string;
  date: string;
  distance: string;
  participants: number;
  category: string;
  imageUrl: string;
  joinLabel: string;
  athletesLabel: string;
  slug?: string;
}) => (
  <motion.div
    className="card-sport group overflow-hidden relative h-full flex flex-col"
    whileHover={{ y: -8 }}
    transition={{ duration: 0.3 }}
  >
    <Link to={slug ? `/events/${slug}` : "/events"} className="absolute inset-0 z-20" aria-label={title} />
    <div className="relative h-52 md:h-56 bg-gray-800 overflow-hidden shrink-0">
      <img
        src={imageUrl}
        alt=""
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <span className="absolute top-4 right-4 px-3 py-1.5 bg-cyan/90 text-navy-deep text-xs font-bold rounded-full backdrop-blur">
        {category}
      </span>
    </div>

    <div className="p-5 md:p-6 relative z-10 flex flex-col flex-1">
      <h3 className="text-lg font-bold text-white mb-3 group-hover:text-cyan transition-colors line-clamp-2">
        {title}
      </h3>

      <div className="space-y-2.5 mb-5 text-gray-400 text-sm">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-cyan shrink-0" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-cyan shrink-0" />
          <span className="line-clamp-1">{location}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Footprints className="w-4 h-4 text-cyan shrink-0" />
          <span>{distance}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-700/50 mt-auto">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <span className="text-sm text-gray-400">
            {participants.toLocaleString()} {athletesLabel}
          </span>
        </div>
        <Link
          to={slug ? `/events/${slug}` : "/events"}
          className="relative z-30 text-cyan hover:text-cyan-light transition-colors flex items-center gap-1 font-semibold text-sm group/link"
        >
          {joinLabel}
          <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  </motion.div>
);

const CommunityCard = ({
  name,
  members,
  activity,
  imageUrl,
  membersLabel,
  streakLabel,
  joinLabel,
}: {
  name: string;
  members: number;
  activity: string;
  imageUrl: string;
  membersLabel: string;
  streakLabel: string;
  joinLabel: string;
}) => (
  <motion.div
    className="card-sport group overflow-hidden"
    whileHover={{ y: -8 }}
    transition={{ duration: 0.3 }}
  >
    <div className="relative h-44 bg-gray-800 overflow-hidden">
      <img
        src={imageUrl}
        alt=""
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
    </div>
    <div className="p-5 relative z-10">
      <h3 className="text-lg font-bold text-white mb-3 group-hover:text-cyan transition-colors">{name}</h3>
      <div className="space-y-2 text-sm text-gray-400 mb-5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan" />
          <span>
            {members.toLocaleString()} {membersLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <span>
            {activity} {streakLabel}
          </span>
        </div>
      </div>
      <Link
        to="/login"
        className="block w-full px-4 py-2.5 text-center bg-cyan/10 border border-cyan/50 text-cyan font-semibold rounded-lg hover:bg-cyan hover:text-navy-deep hover:border-cyan transition-all duration-300"
      >
        {joinLabel}
      </Link>
    </div>
  </motion.div>
);

export default function Index() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((s) => s.publicHome);

  useEffect(() => {
    dispatch(fetchPublicHome());
  }, [dispatch]);

  const heroEvents = useMemo(
    () =>
      (data?.upcoming_events.length
        ? data.upcoming_events
        : data?.featured_events ?? []
      )
        .slice(0, 3)
        .map((ev, idx) => mapEventToHeroEvent(ev, idx, i18n.language)),
    [data, i18n.language],
  );

  const featuredEvents = useMemo(
    () =>
      (data?.featured_events.length
        ? data.featured_events
        : data?.upcoming_events ?? []
      )
        .slice(0, 4)
        .map((ev) => mapEventToFeaturedCard(ev, i18n.language)),
    [data, i18n.language],
  );

  const stats = data?.stats;
  const topAthletes = data?.top_athletes ?? [];
  const topTeams = data?.top_teams ?? [];

  const containerVariants = {
    hidden: { opacity: 0 } as const,
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    } as const,
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 } as const,
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    } as const,
  };

  return (
    <div className="min-h-screen bg-gradient-dark overflow-x-clip max-w-[100vw]">
      <MetaHelmet
        title={t("home.meta.title")}
        description={t("home.meta.description")}
        path="/"
        alternateLocales
        keywords={["sports events", "race registration", "triathlon", "marathon", "athlete community"]}
      />
      <HomeNavbar />

      <HomeHero
        heroEvents={heroEvents}
        loading={loading}
        activeAthletes={stats?.active_athletes ?? 0}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-4">
        <PortalErrorAlert error={error} onRetry={() => dispatch(fetchPublicHome())} />
      </div>

      {/* Platform statistics (live from database) */}
      {stats ? (
      <section id="stats" className="py-20 md:py-28 px-4 md:px-6 relative overflow-hidden bg-surface-dark/30 scroll-mt-[4.5rem]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan/5 to-transparent opacity-40" />
        <div className="max-w-7xl mx-auto relative z-10">
          <SectionHeader
            title={t("home.stats.title")}
            subtitle={t("home.stats.subtitle")}
          />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto grid max-w-6xl grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5"
          >
            <motion.div variants={itemVariants} className="h-full">
              <StatCard label={t("home.stats.activeEvents")} value={stats.published_events} icon={Calendar} />
            </motion.div>
            <motion.div variants={itemVariants} className="h-full">
              <StatCard label={t("home.stats.registeredAthletes")} value={stats.active_athletes} icon={Users} />
            </motion.div>
            <motion.div variants={itemVariants} className="h-full">
              <StatCard label={t("home.stats.confirmedRegistrations")} value={stats.confirmed_registrations} icon={Trophy} />
            </motion.div>
            <motion.div variants={itemVariants} className="h-full">
              <StatCard label={t("home.stats.achievementsEarned")} value={stats.achievements_earned} icon={Star} />
            </motion.div>
            <motion.div variants={itemVariants} className="col-span-2 h-full sm:col-span-1">
              <StatCard label={t("home.stats.activeCommunities")} value={stats.public_teams} icon={Users} />
            </motion.div>
          </motion.div>
        </div>
      </section>
      ) : null}

      {/* Featured Events Section */}
      {featuredEvents.length > 0 ? (
      <section id="featured-events" className="py-20 md:py-28 px-4 md:px-6 scroll-mt-[4.5rem]">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t("home.featured.title")}
            subtitle={t("home.featured.subtitle")}
            actionLabel={t("home.featured.viewAll")}
            actionHref="/events"
          />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {featuredEvents.map((event) => (
              <motion.div key={event.slug} variants={itemVariants} className="h-full">
                <EventCard
                  {...event}
                  joinLabel={t("home.featured.join")}
                  athletesLabel={t("home.featured.athletes")}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      ) : null}

      {/* Tribes & Communities Section */}
      {topTeams.length > 0 ? (
      <section
        id="communities"
        className="py-20 md:py-28 px-4 md:px-6 bg-gradient-to-b from-surface-dark/20 via-surface-dark/50 to-bg-dark scroll-mt-[4.5rem]"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t("home.communities.title")}
            subtitle={t("home.communities.subtitle")}
            actionLabel={t("home.communities.joinTribe")}
            actionHref="/login"
          />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {topTeams.map((team) => (
              <motion.div key={team.id} variants={itemVariants}>
                <CommunityCard
                  name={team.name}
                  members={team.member_count}
                  activity="—"
                  imageUrl={
                    team.avatar_url ||
                    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80&auto=format&fit=crop"
                  }
                  membersLabel={t("home.communities.members")}
                  streakLabel={t("home.communities.streak")}
                  joinLabel={t("home.communities.joinTribe")}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      ) : null}

      {/* Rankings Section */}
      {(topAthletes.length > 0 || topTeams.length > 0) ? (
      <section
        id="leaderboards"
        className="py-20 md:py-28 px-4 md:px-6 bg-gradient-to-b from-bg-dark via-surface-dark/50 to-bg-dark scroll-mt-[4.5rem]"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t("home.leaderboards.title")}
            subtitle={t("home.leaderboards.subtitle")}
          />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-10"
          >
            {/* Top Athletes */}
            <motion.div variants={itemVariants} className="card-sport group p-6 md:p-8">
              <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{t("home.leaderboards.topAthletes")}</h3>
                  <p className="text-gray-400 text-sm mt-1">{t("home.leaderboards.topAthletesDesc")}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cyan/20 border border-cyan/50 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-cyan" />
                </div>
              </div>

              <div className="space-y-3">
                {topAthletes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("home.leaderboards.empty")}</p>
                ) : (
                topAthletes.map((athlete) => (
                  <motion.div
                    key={athlete.rank}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: athlete.rank * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ x: 6 }}
                    className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-800/30 to-transparent rounded-lg border border-gray-700/50 hover:border-cyan/50 transition-all duration-300"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`flex-shrink-0 w-10 h-10 font-bold rounded-full flex items-center justify-center text-white text-sm ${
                        athlete.rank === 1
                          ? "bg-gradient-to-br from-yellow-500 to-orange-500"
                          : athlete.rank === 2
                          ? "bg-gradient-to-br from-gray-400 to-gray-500"
                          : athlete.rank === 3
                          ? "bg-gradient-to-br from-orange-500 to-amber-500"
                          : "bg-cyan/30 border border-cyan/50"
                      }`}
                    >
                      #{athlete.rank}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white group-hover:text-cyan transition-colors">
                        {athlete.first_name} {athlete.last_name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {athlete.xp_total.toLocaleString()} XP · {t("home.leaderboards.level", { level: athlete.level })}
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: [0, 10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: athlete.rank * 0.1 }}
                    >
                      <Flame className="w-5 h-5 text-success" />
                    </motion.div>
                  </motion.div>
                ))
                )}
              </div>
            </motion.div>

            {/* Top Communities */}
            <motion.div variants={itemVariants} className="card-sport group p-6 md:p-8">
              <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{t("home.leaderboards.topCommunities")}</h3>
                  <p className="text-gray-400 text-sm mt-1">{t("home.leaderboards.topCommunitiesDesc")}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-electric/20 border border-blue-electric/50 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-blue-electric" />
                </div>
              </div>

              <div className="space-y-3">
                {topTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("home.leaderboards.emptyTeams")}</p>
                ) : (
                topTeams.map((team, idx) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: (idx + 1) * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ x: 6 }}
                    className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-800/30 to-transparent rounded-lg border border-gray-700/50 hover:border-blue-electric/50 transition-all duration-300"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`flex-shrink-0 w-10 h-10 font-bold rounded-full flex items-center justify-center text-white text-sm ${
                        idx === 0
                          ? "bg-gradient-to-br from-yellow-500 to-orange-500"
                          : idx === 1
                          ? "bg-gradient-to-br from-gray-400 to-gray-500"
                          : idx === 2
                          ? "bg-gradient-to-br from-orange-500 to-amber-500"
                          : "bg-blue-electric/30 border border-blue-electric/50"
                      }`}
                    >
                      #{idx + 1}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white group-hover:text-cyan transition-colors">
                        {team.name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {team.member_count.toLocaleString()} {t("home.leaderboards.members")}
                      </div>
                    </div>
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.1 }}
                    >
                      <TrendingUp className="w-5 h-5 text-success" />
                    </motion.div>
                  </motion.div>
                ))
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
      ) : null}

      {/* Premium CTA Section */}
      <section className="py-24 md:py-32 px-4 md:px-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{
              y: [0, -50, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 left-1/4 w-96 h-96 bg-cyan opacity-10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              y: [0, 50, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-40 right-1/4 w-96 h-96 bg-blue-electric opacity-10 rounded-full blur-3xl"
          />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative overflow-hidden"
          >
            {/* Gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-blue-electric/20 to-cyan/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative bg-gradient-to-br from-surface-dark/80 to-bg-dark border border-cyan/30 hover:border-cyan/60 rounded-2xl p-8 sm:p-12 md:p-20 text-center backdrop-blur-xl transition-all duration-500">
              <motion.div
                initial={{ scale: 0.8 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mb-8"
              >
                <div className="inline-block p-4 bg-cyan/10 rounded-full border border-cyan/30 mb-8">
                  <Sparkles className="w-8 h-8 text-cyan" />
                </div>
              </motion.div>

              <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
                {t("home.cta.title")}{" "}
                <span className="text-gradient">{t("home.cta.titleHighlight")}</span>?
              </h2>

              <p className="text-base md:text-lg text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                {t("home.cta.description")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to="/login"
                  className="px-8 py-4 bg-gradient-to-r from-cyan via-blue-electric to-cyan text-navy-deep font-bold text-base md:text-lg rounded-lg transition-all duration-300 flex items-center justify-center gap-3 group shadow-glow-cyan hover:shadow-glow-cyan-lg"
                >
                  {t("home.cta.startJourney")}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/events"
                  className="px-8 py-4 text-white font-bold text-base md:text-lg border-2 border-cyan/50 hover:border-cyan hover:bg-cyan/10 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {t("home.cta.watchDemo")}
                  <Sparkles className="w-5 h-5" />
                </Link>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-10 pt-6 border-t border-gray-800/50 flex flex-col sm:flex-row justify-center gap-6 text-sm text-gray-400"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success rounded-full" />
                  <span>{t("home.cta.noCard")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success rounded-full" />
                  <span>
                    {t("home.cta.instantAccess", {
                      count: stats?.published_events ?? 0,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success rounded-full" />
                  <span>{t("home.cta.premiumSupport")}</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
