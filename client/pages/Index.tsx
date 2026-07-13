import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import MetaHelmet, { DEFAULT_OG_IMAGE } from "@/components/MetaHelmet";
import HomeHero from "@/components/home/HomeHero";
import HomeSportTypesSection from "@/components/home/HomeSportTypesSection";
import HomeEventsMapSection from "@/components/home/HomeEventsMapSection";
import HomeInviteCrew from "@/components/home/HomeInviteCrew";
import HomeBlogSection from "@/components/home/HomeBlogSection";
import HomeFaqSection from "@/components/home/HomeFaqSection";
import HomeFeaturedEventsMobile from "@/components/home/HomeFeaturedEventsMobile";
import FeaturedEventsSkeleton from "@/components/home/FeaturedEventsSkeleton";
import EventCardImage from "@/components/events/EventCardImage";
import SportKindIcon from "@/components/events/SportKindIcon";
import SectionHeader from "@/components/home/SectionHeader";
import CommunityCard from "@/components/communities/CommunityCard";
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
  Sparkles,
  TrendingUp,
} from "lucide-react";

const EventCard = ({
  title,
  location,
  date,
  distance,
  category,
  sportSlug,
  imageUrl,
  joinLabel,
  slug,
}: {
  title: string;
  location: string;
  date: string;
  distance: string;
  category: string;
  sportSlug: string;
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
    <div className="relative h-52 md:h-56 bg-muted overflow-hidden shrink-0">
      <EventCardImage
        src={imageUrl}
        sportSlug={sportSlug}
        sportName={category}
        displaySize="featured"
        className="h-full w-full"
        imgClassName="group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
      <span className="absolute top-4 right-4 px-3 py-1.5 bg-triboo-gradient text-primary-foreground text-xs font-bold rounded-full backdrop-blur shadow-glow-triboo">
        {category}
      </span>
    </div>

    <div className="p-5 md:p-6 relative z-10 flex flex-col flex-1">
      <h3 className="text-lg font-bold text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-2">
        {title}
      </h3>

      <div className="space-y-2.5 mb-5 text-muted-foreground text-sm">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="line-clamp-1">{location}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <SportKindIcon
            sportSlug={sportSlug}
            sportName={category}
            className="w-4 h-4 text-primary"
          />
          <span>{distance}</span>
        </div>
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-border mt-auto">
        <Link
          to={slug ? `/events/${slug}` : "/events"}
          className="relative z-30 text-primary hover:text-primary transition-colors flex items-center gap-1 font-semibold text-sm group/link"
        >
          {joinLabel}
          <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>
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

  const homeEventsRaw = useMemo(
    () => data?.events ?? data?.upcoming_events ?? [],
    [data],
  );

  const homeEvents = useMemo(
    () => homeEventsRaw.map((ev) => mapEventToFeaturedCard(ev, i18n.language)),
    [homeEventsRaw, i18n.language],
  );

  const spotlightEvent = useMemo(() => {
    const pool = data?.events ?? data?.upcoming_events ?? [];
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
      <HomeHero />

      <HomeSportTypesSection />

      {error ? (
        <div className="max-w-7xl mx-auto w-full min-w-0 px-4 md:px-6 mt-4">
          <PortalErrorAlert
            error={error}
            onRetry={() => dispatch(fetchPublicHome())}
          />
        </div>
      ) : null}

      {/* Events — directly after hero */}
      {loading ? (
        <FeaturedEventsSkeleton />
      ) : homeEvents.length > 0 ? (
        <>
          <HomeFeaturedEventsMobile events={homeEvents} />
          <section className="hidden md:block pt-3 pb-14 md:pt-0 md:pb-20 px-4 md:px-6 scroll-mt-[4.5rem]">
            <div className="max-w-7xl mx-auto w-full min-w-0">
              <SectionHeader
                title={t("home.events.title")}
                subtitle={t("home.events.subtitle")}
              />

              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {homeEvents.map((event) => (
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
                      sportSlug={event.sportSlug}
                      imageUrl={event.imageUrl}
                      slug={event.slug}
                      joinLabel={t("home.events.join")}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        </>
      ) : null}

      {!loading && homeEventsRaw.length > 0 ? (
        <HomeEventsMapSection events={homeEventsRaw} />
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
              actionHref="/communities"
            />

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {topTeams.map((team, index) => (
                <motion.div key={team.id} variants={itemVariants}>
                  <CommunityCard
                    team={{
                      name: team.name,
                      slug: team.slug,
                      member_count: team.member_count,
                      avatar_url: team.avatar_url,
                      description: null,
                    }}
                    rank={index + 1}
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
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                      {t("home.leaderboards.topAthletes")}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
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
                          className={`flex-shrink-0 w-10 h-10 font-bold rounded-full flex items-center justify-center text-foreground text-sm ${
                            athlete.rank === 1
                              ? "bg-gradient-to-br from-yellow-500 to-orange-500"
                              : athlete.rank === 2
                                ? "bg-gradient-to-br from-muted to-muted-foreground"
                                : athlete.rank === 3
                                  ? "bg-gradient-to-br from-orange-500 to-amber-500"
                                  : "bg-primary/30 border border-primary/50"
                          }`}
                        >
                          #{athlete.rank}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {athlete.first_name} {athlete.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
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
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                      {t("home.leaderboards.topCommunities")}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
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
                          className={`flex-shrink-0 w-10 h-10 font-bold rounded-full flex items-center justify-center text-foreground text-sm ${
                            idx === 0
                              ? "bg-gradient-to-br from-yellow-500 to-orange-500"
                              : idx === 1
                                ? "bg-gradient-to-br from-muted to-muted-foreground"
                                : idx === 2
                                  ? "bg-gradient-to-br from-orange-500 to-amber-500"
                                  : "bg-accent/30 border border-accent/50"
                          }`}
                        >
                          #{idx + 1}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {team.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
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

      <HomeFaqSection />

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

              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5 leading-tight">
                {t("home.cta.title")}{" "}
                <span className="text-gradient">
                  {t("home.cta.titleHighlight")}
                </span>
              </h2>

              <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
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
                  className="px-8 py-4 text-foreground font-bold text-base md:text-lg border-2 border-primary/50 hover:border-primary hover:bg-primary/10 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
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
                className="mt-10 pt-6 border-t border-border/50 flex flex-col sm:flex-row justify-center gap-6 text-sm text-muted-foreground"
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
    </div>
  );
}
