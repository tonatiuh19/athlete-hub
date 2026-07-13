import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Copy,
  Flag,
  MapPin,
  Share2,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { EventListItem } from "@shared/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapEventToFeaturedCard } from "@/utils/mapEventForHome";

const AVATAR_TONES = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-card text-foreground border border-border",
] as const;

function AvatarStack({ count }: { count: number }) {
  const visible = count > 0 ? Math.min(4, count) : 3;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2.5">
        {Array.from({ length: visible }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 border-triboo-black text-[11px] font-bold shadow-md",
              AVATAR_TONES[i % AVATAR_TONES.length],
            )}
            aria-hidden
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
      </div>
      {count > visible ? (
        <span className="ml-3 text-xs font-semibold text-primary-foreground/90">
          +{count - visible}
        </span>
      ) : null}
    </div>
  );
}

const stepIconClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary-foreground/25 bg-primary-foreground/10";

interface HomeInviteCrewProps {
  event: EventListItem | null;
  language: string;
  loading?: boolean;
  communityAthletes?: number;
}

export default function HomeInviteCrew({
  event,
  language,
  loading = false,
  communityAthletes = 0,
}: HomeInviteCrewProps) {
  const { t } = useTranslation();

  const card = useMemo(
    () => (event ? mapEventToFeaturedCard(event, language) : null),
    [event, language],
  );

  const eventUrl = useMemo(() => {
    if (!card?.slug || typeof window === "undefined") return "";
    return `${window.location.origin}/events/${card.slug}`;
  }, [card?.slug]);

  const shareInvite = useCallback(async () => {
    if (!card) return;
    const sharePayload = {
      title: t("home.inviteCrew.shareTitle", { event: card.title }),
      text: t("home.inviteCrew.shareText", { event: card.title }),
      url: eventUrl,
    };

    if (navigator.share && eventUrl) {
      try {
        await navigator.share(sharePayload);
        return;
      } catch {
        /* fall through to copy */
      }
    }

    if (eventUrl) {
      try {
        await navigator.clipboard.writeText(
          `${sharePayload.text}\n${eventUrl}`,
        );
        toast.success(t("home.inviteCrew.linkCopied"));
      } catch {
        toast.error(t("home.inviteCrew.linkCopyFailed"));
      }
    }
  }, [card, eventUrl, t]);

  const steps = [
    {
      icon: UserPlus,
      title: t("home.inviteCrew.step1Title"),
      description: t("home.inviteCrew.step1Desc"),
    },
    {
      icon: Share2,
      title: t("home.inviteCrew.step2Title"),
      description: t("home.inviteCrew.step2Desc"),
    },
    {
      icon: Flag,
      title: t("home.inviteCrew.step3Title"),
      description: t("home.inviteCrew.step3Desc"),
    },
  ];

  return (
    <section
      id="invite-crew"
      className="pt-4 pb-10 md:py-20 px-4 md:px-6 relative overflow-hidden scroll-mt-[4.5rem]"
    >
      <div className="max-w-7xl mx-auto w-full min-w-0 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl bg-triboo-gradient p-6 sm:p-8 md:p-12 shadow-glow-triboo-lg overflow-hidden relative"
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-black/15 blur-2xl"
            aria-hidden
          />

          <div className="relative text-center mb-8 md:mb-10">
            {/* <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary-foreground/90 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.inviteCrew.eyebrow")}
            </span> */}
            <h2 className="text-2xl md:text-4xl font-black text-primary-foreground uppercase tracking-tight mb-3">
              {t("home.inviteCrew.bannerTitle")}
            </h2>
            <p className="text-primary-foreground/85 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              {t("home.inviteCrew.subtitle")}
            </p>
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8 items-stretch">
            {/* Spotlight event */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="min-w-0"
            >
              {loading ? (
                <div className="h-full min-h-[280px] rounded-2xl border border-primary-foreground/20 bg-triboo-black/20 animate-pulse" />
              ) : card ? (
                <Link
                  to={`/events/${card.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-primary-foreground/20 bg-triboo-black/30 backdrop-blur-sm transition-all duration-300 hover:border-primary-foreground/40 hover:bg-triboo-black/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={card.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-triboo-black via-triboo-black/20 to-transparent" />
                    <span className="absolute top-3 left-3 rounded-full border border-primary-foreground/30 bg-triboo-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground backdrop-blur-sm">
                      {t("home.inviteCrew.spotlightLabel")}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60 mb-2">
                      {card.category}
                    </p>
                    <h3 className="text-lg sm:text-xl font-black text-primary-foreground leading-tight mb-3 group-hover:text-primary transition-colors">
                      {card.title}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary-foreground/75 mb-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {card.date}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {card.location}
                      </span>
                    </div>
                    <div className="mt-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-primary-foreground/15">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-primary-foreground/55 mb-1.5">
                          {t("home.inviteCrew.crewOnStartLine")}
                        </p>
                        <AvatarStack count={card.participants} />
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-primary-foreground group-hover:gap-2 transition-all">
                        {t("home.inviteCrew.joinEvent")}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-primary-foreground/25 bg-triboo-black/20 p-8 text-center">
                  <Users className="h-10 w-10 text-primary-foreground/40 mb-3" />
                  <p className="text-sm text-primary-foreground/75 mb-4">
                    {t("home.inviteCrew.noEventFallback")}
                  </p>
                  <Button
                    asChild
                    variant="secondary"
                    className="rounded-xl font-bold bg-primary-foreground text-foreground hover:bg-primary-foreground/90"
                  >
                    <Link to="/events">
                      {t("home.inviteCrew.browseEvents")}
                    </Link>
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Steps + CTAs */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="flex flex-col gap-4 min-w-0"
            >
              {steps.map(({ icon: Icon, title, description }, idx) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + idx * 0.08 }}
                  className="flex gap-4 rounded-xl border border-primary-foreground/20 bg-triboo-black/25 p-4 sm:p-5 backdrop-blur-sm transition-colors hover:border-primary-foreground/35 hover:bg-triboo-black/35"
                >
                  <div className={stepIconClass}>
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground/50 mb-1">
                      {t("home.inviteCrew.stepLabel", { step: idx + 1 })}
                    </p>
                    <h3 className="text-base font-bold text-primary-foreground mb-1">
                      {title}
                    </h3>
                    <p className="text-sm text-primary-foreground/75 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </motion.div>
              ))}

              {communityAthletes > 0 ? (
                <p className="text-center text-xs text-primary-foreground/70 px-2">
                  {t("home.inviteCrew.communityProof", {
                    count: communityAthletes,
                  })}
                </p>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {card ? (
                  <>
                    <Button
                      asChild
                      className="h-12 flex-1 rounded-xl bg-triboo-black text-primary-foreground font-bold border border-primary-foreground/20 hover:bg-triboo-black/80 shadow-lg"
                    >
                      <Link to={`/events/${card.slug}`}>
                        {t("home.inviteCrew.joinEvent")}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void shareInvite()}
                      className="h-12 flex-1 rounded-xl border-0 bg-primary-foreground text-triboo-black font-bold hover:bg-white/90 gap-2 shadow-lg [&_svg]:text-triboo-black"
                    >
                      <Share2 className="h-4 w-4" />
                      {t("home.inviteCrew.inviteFriends")}
                    </Button>
                  </>
                ) : (
                  <Button
                    asChild
                    className="h-12 w-full rounded-xl border-0 bg-primary-foreground text-triboo-black font-bold hover:bg-white/90 shadow-lg"
                  >
                    <Link to="/events">
                      {t("home.inviteCrew.browseEvents")}
                    </Link>
                  </Button>
                )}
              </div>

              {card ? (
                <button
                  type="button"
                  onClick={() => void shareInvite()}
                  className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t("home.inviteCrew.copyLinkHint")}
                </button>
              ) : null}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
