import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import MetaHelmet, { DEFAULT_OG_IMAGE } from "@/components/MetaHelmet";
import SiteFooter from "@/components/SiteFooter";
import HomeHero from "@/components/home/HomeHero";
import HomeNavbar from "@/components/home/HomeNavbar";
import HomeInviteCrew from "@/components/home/HomeInviteCrew";
import HomeBlogSection from "@/components/home/HomeBlogSection";
import FeaturedEventsSkeleton from "@/components/home/FeaturedEventsSkeleton";
import SectionHeader from "@/components/home/SectionHeader";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicHome } from "@/store/slices/publicHomeSlice";
import { mapEventToFeaturedCard } from "@/utils/mapEventForHome";
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
} from "lucide-react";

const EventCard = ({
  title,
  location,
  date,
  distance,
  category,
  imageUrl,
  joinLabel,
  slug,
}: {
  title: string;
  location: string;
  date: string;
  distance: string;
  category: string;
  imageUrl: string;
  joinLabel: string;
  slug?: string;
}) => (
  <motion.div
    className="card-sport group overflow-hidden relative h-full flex flex-col"
    whileHover={{ y: -8 }}
    transition={{ duration: 0.3 }}
  >
    <Link
      to={slug ? `/events/${slug}` : "/events"}
      className="absolute inset-0 z-20"
      aria-label={title}
    />
    <div className="relative h-52 md:h-56 bg-gray-800 overflow-hidden shrink-0">
      <img
        src={imageUrl}
        alt=""
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <span className="absolute top-4 right-4 px-3 py-1.5 bg-triboo-gradient text-primary-foreground text-xs font-bold rounded-full backdrop-blur shadow-glow-triboo">
        {category}
      </span>
    </div>

    <div className="p-5 md:p-6 relative z-10 flex flex-col flex-1">
      <h3 className="text-lg font-bold text-white mb-3 group-hover:text-primary transition-colors line-clamp-2">
        {title}
      </h3>

      <div className="space-y-2.5 mb-5 text-gray-400 text-sm">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="line-clamp-1">{location}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Footprints className="w-4 h-4 text-primary shrink-0" />
          <span>{distance}</span>
        </div>
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-gray-700/50 mt-auto">
        <Link
          to={slug ? `/events/${slug}` : "/events"}
          className="relative z-30 text-primary hover:text-white transition-colors flex items-center gap-1 font-semibold text-sm group/link"
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
      <h3 className="text-lg font-bold text-white mb-3 group-hover:text-primary transition-colors">
        {name}
      </h3>
      <div className="space-y-2 text-sm text-gray-400 mb-5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
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
        className="block w-full px-4 py-2.5 text-center bg-primary/10 border border-primary/50 text-primary font-semibold rounded-lg hover:bg-triboo-gradient hover:text-primary-foreground hover:border-transparent transition-all duration-300"
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

  const featuredEvents = useMemo(
    () =>
      (data?.featured_events.length
        ? data.featured_events
        : (data?.upcoming_events ?? [])
      )
        .slice(0, 4)
        .map((ev) => mapEventToFeaturedCard(ev, i18n.language)),
    [data, i18n.language],
  );

  const spotlightEvent = useMemo(() => {
    const pool = data?.upcoming_events.length
      ? data.upcoming_events
      : (data?.featured_events ?? []);
    return pool[0] ?? null;
  }, [data]);

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
    <div className="min-h-screen bg-background overflow-x-clip w-full max-w-full">
      <MetaHelmet
        title={t("home.meta.title")}
        description={t("home.meta.description")}
        image={DEFAULT_OG_IMAGE}
        imageAlt={t("home.meta.imageAlt")}
        path="/"
        alternateLocales
        keywords={[
          "Triboo Sport",
          "sports events",
          "race registration",
          "triathlon",
          "marathon",
          "athlete Triboo",
        ]}
      />
      <HomeNavbar />

      <HomeHero />

      {error ? (
        <div className="max-w-7xl mx-auto w-full min-w-0 px-4 md:px-6 mt-4">
          <PortalErrorAlert
            error={error}
            onRetry={() => dispatch(fetchPublicHome())}
          />
        </div>
      ) : null}

      {/* Featured Events — directly after hero */}
      {loading ? (
        <FeaturedEventsSkeleton />
      ) : featuredEvents.length > 0 ? (
        <section
          id="featured-events"
          className="pt-6 pb-14 md:pt-8 md:pb-20 px-4 md:px-6 scroll-mt-[4.5rem]"
        >
          <div className="max-w-7xl mx-auto w-full min-w-0">
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
                <motion.div
                  key={event.slug}
                  variants={itemVariants}
                  className="h-full"
                >
                  <EventCard
                    title={event.title}
                    location={event.location}
                    date={event.date}
                    distance={event.distance}
                    category={event.category}
                    imageUrl={event.imageUrl}
                    slug={event.slug}
                    joinLabel={t("home.featured.join")}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      ) : null}

      <HomeInviteCrew
        event={spotlightEvent}
        language={i18n.language}
        loading={loading}
        communityAthletes={data?.stats?.active_athletes ?? 0}
      />

      <HomeBlogSection />

      {/* Triboo groups section */}
      {topTeams.length > 0 ? (
        <section
          id="communities"
          className="py-20 md:py-28 px-4 md:px-6 bg-gradient-to-b from-background via-card/30 to-background scroll-mt-[4.5rem]"
        >
          <div className="max-w-7xl mx-auto w-full min-w-0">
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
      {topAthletes.length > 0 || topTeams.length > 0 ? (
        <section
          id="leaderboards"
          className="py-20 md:py-28 px-4 md:px-6 bg-gradient-to-b from-background via-card/40 to-background scroll-mt-[4.5rem]"
        >
          <div className="max-w-7xl mx-auto w-full min-w-0">
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
              <motion.div
                variants={itemVariants}
                className="card-sport group p-6 md:p-8"
              >
                <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                      {t("home.leaderboards.topAthletes")}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {t("home.leaderboards.topAthletesDesc")}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center shrink-0">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                </div>

                <div className="space-y-3">
                  {topAthletes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("home.leaderboards.empty")}
                    </p>
                  ) : (
                    topAthletes.map((athlete) => (
                      <motion.div
                        key={athlete.rank}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: athlete.rank * 0.1 }}
                        viewport={{ once: true }}
                        whileHover={{ x: 6 }}
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-muted/30 to-transparent rounded-lg border border-border hover:border-primary/50 transition-all duration-300"
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
                                  : "bg-primary/30 border border-primary/50"
                          }`}
                        >
                          #{athlete.rank}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white group-hover:text-primary transition-colors">
                            {athlete.first_name} {athlete.last_name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {athlete.xp_total.toLocaleString()} XP ·{" "}
                            {t("home.leaderboards.level", {
                              level: athlete.level,
                            })}
                          </div>
                        </div>
                        <motion.div
                          animate={{ rotate: [0, 10, 0] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: athlete.rank * 0.1,
                          }}
                        >
                          <Flame className="w-5 h-5 text-success" />
                        </motion.div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Top Communities */}
              <motion.div
                variants={itemVariants}
                className="card-sport group p-6 md:p-8"
              >
                <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                      {t("home.leaderboards.topCommunities")}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {t("home.leaderboards.topCommunitiesDesc")}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                </div>

                <div className="space-y-3">
                  {topTeams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("home.leaderboards.emptyTeams")}
                    </p>
                  ) : (
                    topTeams.map((team, idx) => (
                      <motion.div
                        key={team.id}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: (idx + 1) * 0.1 }}
                        viewport={{ once: true }}
                        whileHover={{ x: 6 }}
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-muted/30 to-transparent rounded-lg border border-border hover:border-accent/50 transition-all duration-300"
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
                                  : "bg-accent/30 border border-accent/50"
                          }`}
                        >
                          #{idx + 1}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white group-hover:text-primary transition-colors">
                            {team.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {team.member_count.toLocaleString()}{" "}
                            {t("home.leaderboards.members")}
                          </div>
                        </div>
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: idx * 0.1,
                          }}
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
            className="absolute -top-40 left-1/4 w-96 h-96 bg-primary opacity-10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              y: [0, 50, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute -bottom-40 right-1/4 w-96 h-96 bg-accent opacity-10 rounded-full blur-3xl"
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
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative bg-gradient-to-br from-card/90 to-background border border-primary/30 hover:border-primary/60 rounded-2xl p-8 sm:p-12 md:p-20 text-center backdrop-blur-xl transition-all duration-500">
              {/* <motion.div
                initial={{ scale: 0.8 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mb-8"
              >
                <div className="inline-block p-4 bg-primary/10 rounded-full border border-primary/30 mb-8">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
              </motion.div> */}

              <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
                {t("home.cta.title")}{" "}
                <span className="text-gradient">
                  {t("home.cta.titleHighlight")}
                </span>
              </h2>

              <p className="text-base md:text-lg text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                {t("home.cta.description")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to="/login"
                  className="px-8 py-4 bg-triboo-gradient text-primary-foreground font-bold text-base md:text-lg rounded-lg transition-all duration-300 flex items-center justify-center gap-3 group shadow-glow-triboo hover:shadow-glow-triboo-lg hover:brightness-110"
                >
                  {t("home.cta.startJourney")}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/events"
                  className="px-8 py-4 text-white font-bold text-base md:text-lg border-2 border-primary/50 hover:border-primary hover:bg-primary/10 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {t("home.cta.watchDemo")}
                  <Sparkles className="w-5 h-5" />
                </Link>
              </div>

              {/* <motion.div
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
                      count: data?.stats?.published_events ?? 0,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success rounded-full" />
                  <span>{t("home.cta.premiumSupport")}</span>
                </div>
              </motion.div> */}
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
