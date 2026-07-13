import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CreditCard,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import SectionHeader from "@/components/home/SectionHeader";
import { Button } from "@/components/ui/button";

const SIGNUP_WIZARD_URL = "/organizers/signup?step=owner";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function AdvantageCard({
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
      transition={{ duration: 0.45, delay }}
      className="group rounded-2xl border border-border bg-card/60 p-5 md:p-6 h-full transition-all hover:border-primary/40 hover:bg-card/80"
    >
      <div className="rounded-xl bg-primary/10 p-3 w-fit mb-4 group-hover:bg-primary/15 transition-colors">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </motion.div>
  );
}

export default function OrganizerStart() {
  const { t } = useTranslation();

  const advantages = [
    {
      icon: LayoutDashboard,
      title: t("organizerSignup.start.advantages.console.title"),
      body: t("organizerSignup.start.advantages.console.body"),
    },
    {
      icon: CreditCard,
      title: t("organizerSignup.start.advantages.payments.title"),
      body: t("organizerSignup.start.advantages.payments.body"),
    },
    {
      icon: QrCode,
      title: t("organizerSignup.start.advantages.checkIn.title"),
      body: t("organizerSignup.start.advantages.checkIn.body"),
    },
    {
      icon: ShieldCheck,
      title: t("organizerSignup.start.advantages.trust.title"),
      body: t("organizerSignup.start.advantages.trust.body"),
    },
    {
      icon: Smartphone,
      title: t("organizerSignup.start.advantages.experience.title"),
      body: t("organizerSignup.start.advantages.experience.body"),
    },
    {
      icon: Users,
      title: t("organizerSignup.start.advantages.focus.title"),
      body: t("organizerSignup.start.advantages.focus.body"),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-gradient-dark">
      <MetaHelmet
        title={t("organizerSignup.start.metaTitle")}
        description={t("organizerSignup.start.metaDescription")}
        path="/organizers/start"
      />

      {/* Hero + CTA */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-triboo-black" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10" />
        <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 py-12 md:py-20 text-center animate-slide-up">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-4">
            {t("organizerSignup.start.eyebrow")}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight text-foreground">
            {t("organizerSignup.start.title")}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mt-5">
            {t("organizerSignup.start.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-8">
            <Button asChild size="lg" className="h-12 px-8 text-base w-full sm:w-auto shadow-glow-triboo">
              <Link to={SIGNUP_WIZARD_URL}>
                {t("organizerSignup.start.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 w-full sm:w-auto">
              <Link to="/staff/login">{t("organizerSignup.start.signIn")}</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-5 flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            {t("organizerSignup.start.reviewNote")}
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-14 md:py-20 space-y-16 md:space-y-20">
        {/* Advantages */}
        <section>
          <SectionHeader
            title={t("organizerSignup.start.advantages.title")}
            subtitle={t("organizerSignup.start.advantages.subtitle")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {advantages.map((item, i) => (
              <AdvantageCard key={item.title} {...item} delay={i * 0.06} />
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="rounded-2xl border border-border bg-card/40 p-6 md:p-8 space-y-5">
          <div>
            <div className="w-12 h-1 bg-triboo-gradient rounded-full mb-4" />
            <h2 className="text-xl md:text-2xl font-bold">{t("organizerSignup.start.howTitle")}</h2>
          </div>
          <ol className="space-y-4">
            {(
              [
                t("organizerSignup.start.howStep1"),
                t("organizerSignup.start.howStep2"),
                t("organizerSignup.start.howStep3"),
              ] as const
            ).map((stepText, i) => (
              <li key={stepText} className="flex gap-4 text-sm md:text-base">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-bold">
                  {i + 1}
                </span>
                <span className="text-muted-foreground leading-relaxed pt-1">{stepText}</span>
              </li>
            ))}
          </ol>
          <div className="pt-2">
            <Button asChild size="lg" className="h-11 w-full sm:w-auto">
              <Link to={SIGNUP_WIZARD_URL}>
                {t("organizerSignup.start.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <p className="text-center text-sm text-muted-foreground pb-4">
          {t("organizerSignup.helpPrompt")}{" "}
          <Link to="/contact" className="text-primary hover:underline">
            {t("home.footer.contact")}
          </Link>
          {" · "}
          <a href="mailto:soporte@triboosport.com" className="text-primary hover:underline">
            {t("organizerSignup.helpEmail")}
          </a>
        </p>
      </div>
    </div>
  );
}
