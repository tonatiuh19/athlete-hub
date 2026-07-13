import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Compass,
  Flag,
  Layers,
  MapPin,
  ShieldCheck,
  Sparkles,
  Ticket,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import SectionHeader from "@/components/home/SectionHeader";
import { Button } from "@/components/ui/button";
import { LEGAL_ROUTES } from "@shared/siteLegal";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function ValueCard({
  icon: Icon,
  title,
  body,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay }}
      className="group rounded-2xl border border-border bg-card/60 p-6 md:p-8 h-full transition-all hover:border-primary/40 hover:bg-card/80"
    >
      <div className="rounded-xl bg-primary/10 p-3 w-fit mb-5 group-hover:bg-primary/15 transition-colors">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg md:text-xl font-bold text-foreground mb-3">{title}</h3>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{body}</p>
    </motion.div>
  );
}

function JourneyStep({
  step,
  title,
  body,
  icon: Icon,
  isLast,
}: {
  step: string;
  title: string;
  body: string;
  icon: LucideIcon;
  isLast?: boolean;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="relative flex gap-4 md:gap-6"
    >
      <div className="flex flex-col items-center shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 text-primary font-bold text-sm">
          {step}
        </div>
        {!isLast ? (
          <div className="hidden md:block w-px flex-1 min-h-[3rem] bg-gradient-to-b from-primary/40 to-transparent mt-2" />
        ) : null}
      </div>
      <div className="pb-8 md:pb-10 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-primary shrink-0" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </motion.div>
  );
}

export default function AboutPage() {
  const { t } = useTranslation();

  const missionCards = [
    {
      icon: Users,
      title: t("about.mission.connect.title"),
      body: t("about.mission.connect.body"),
    },
    {
      icon: Flag,
      title: t("about.mission.participate.title"),
      body: t("about.mission.participate.body"),
    },
    {
      icon: TrendingUp,
      title: t("about.mission.pushLimits.title"),
      body: t("about.mission.pushLimits.body"),
    },
  ];

  const journeySteps = [
    {
      icon: Compass,
      title: t("about.journey.step1Title"),
      body: t("about.journey.step1Body"),
    },
    {
      icon: Ticket,
      title: t("about.journey.step2Title"),
      body: t("about.journey.step2Body"),
    },
    {
      icon: Timer,
      title: t("about.journey.step3Title"),
      body: t("about.journey.step3Body"),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-gradient-dark">
      <MetaHelmet
        title={t("about.metaTitle")}
        description={t("about.metaDescription")}
        path="/about"
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-triboo-black" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24 text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-4"
          >
            {t("about.eyebrow")}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="text-3xl sm:text-4xl md:text-6xl font-bold text-foreground tracking-tight leading-[1.1]"
          >
            {t("about.hero.title")}
            <span className="block triboo-shimmer-text mt-2 pb-1">{t("about.hero.titleHighlight")}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="text-muted-foreground text-base md:text-xl mt-6 max-w-2xl mx-auto leading-relaxed"
          >
            {t("about.hero.subtitle")}
          </motion.p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-14 md:py-20 space-y-20 md:space-y-28">
        {/* Manifesto */}
        <motion.blockquote
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-2xl border border-primary/20 bg-card/30 p-8 md:p-12 text-center"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 bg-background p-3">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <p className="text-lg md:text-2xl text-foreground font-medium leading-relaxed md:leading-relaxed italic">
            {t("about.manifesto.quote")}
          </p>
          <p className="text-sm text-muted-foreground mt-6 max-w-xl mx-auto">{t("about.manifesto.attribution")}</p>
        </motion.blockquote>

        {/* Mission pillars */}
        <section>
          <SectionHeader
            title={t("about.mission.title")}
            subtitle={t("about.mission.subtitle")}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {missionCards.map((card, i) => (
              <ValueCard key={card.title} {...card} delay={i * 0.08} />
            ))}
          </div>
        </section>

        {/* Platform role */}
        <section className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-8 md:p-10 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                <Layers className="w-3.5 h-3.5 text-primary" />
                {t("about.platform.badge")}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("about.platform.title")}</h2>
              <p className="text-muted-foreground leading-relaxed">{t("about.platform.body")}</p>
              <p className="text-sm text-muted-foreground/90 leading-relaxed border-l-2 border-primary/40 pl-4">
                {t("about.platform.facilitatorNote")}
              </p>
            </div>
            <div className="relative min-h-[220px] md:min-h-0 bg-gradient-to-br from-primary/10 via-card to-accent/5 flex items-center justify-center p-8">
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/4 left-1/4 h-32 w-32 rounded-full border border-primary/20" />
                <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full border border-accent/20" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-primary/10 blur-xl" />
              </div>
              <div className="relative text-center space-y-3 max-w-xs">
                <MapPin className="w-8 h-8 text-primary mx-auto" />
                <p className="text-sm font-semibold text-foreground">{t("about.platform.regionTitle")}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("about.platform.regionBody")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Audiences */}
        <section>
          <SectionHeader
            title={t("about.audiences.title")}
            subtitle={t("about.audiences.subtitle")}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="rounded-2xl border border-border bg-card/60 p-6 md:p-8 flex flex-col"
            >
              <Users className="w-7 h-7 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">{t("about.audiences.athletesTitle")}</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed flex-1">
                {t("about.audiences.athletesBody")}
              </p>
              <Button asChild className="mt-6 w-fit" variant="default">
                <Link to="/events">
                  {t("about.audiences.athletesCta")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl border border-border bg-card/60 p-6 md:p-8 flex flex-col"
            >
              <Flag className="w-7 h-7 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">{t("about.audiences.organizersTitle")}</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed flex-1">
                {t("about.audiences.organizersBody")}
              </p>
              <Button asChild className="mt-6 w-fit" variant="outline">
                <Link to="/organizers/start">
                  {t("about.audiences.organizersCta")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Journey */}
        <section className="rounded-2xl border border-border bg-card/30 p-6 md:p-10">
          <SectionHeader title={t("about.journey.title")} subtitle={t("about.journey.subtitle")} />
          <div className="md:grid md:grid-cols-3 md:gap-6">
            {journeySteps.map((step, i) => (
              <JourneyStep
                key={step.title}
                step={String(i + 1).padStart(2, "0")}
                {...step}
                isLast={i === journeySteps.length - 1}
              />
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="text-center space-y-6">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold">{t("about.trust.title")}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{t("about.trust.body")}</p>
          <p className="text-sm text-muted-foreground">{t("about.trust.reviewNote")}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm pt-2">
            <Link to="/contact" className="text-primary hover:underline">
              {t("home.footer.contact")}
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <Link to={LEGAL_ROUTES.privacy} className="text-primary hover:underline">
              {t("legal.links.privacy")}
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <Link to={LEGAL_ROUTES.terms} className="text-primary hover:underline">
              {t("legal.links.terms")}
            </Link>
          </div>
        </section>

        {/* Closing CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="relative rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-sm p-8 md:p-14 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("about.cta.title")}{" "}
              <span className="text-gradient">{t("about.cta.titleHighlight")}</span>
            </h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              {t("about.cta.description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="h-12 px-8">
                <Link to="/login">
                  {t("about.cta.primary")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8">
                <Link to="/communities">{t("about.cta.secondary")}</Link>
              </Button>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
