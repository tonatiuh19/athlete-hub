import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CircleHelp,
  Mail,
  MessageCircle,
  Users,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import FaqAccordion from "@/components/faq/FaqAccordion";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicSiteProfile } from "@/store/slices/publicSiteSlice";
import { FAQ_CATEGORIES, type FaqCategoryId } from "@/constants/faqStructure";
import { LEGAL_ROUTES, legalFieldDisplay } from "@shared/siteLegal";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<FaqCategoryId, typeof CircleHelp> = {
  registration: CircleHelp,
  payments: CircleHelp,
  account: CircleHelp,
  communities: Users,
  organizers: Users,
  support: MessageCircle,
};

export default function HelpPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((s) => s.publicSite);
  const { legalEntity: le, contact: cp } = profile;

  useEffect(() => {
    dispatch(fetchPublicSiteProfile());
  }, [dispatch]);

  const supportEmail = legalFieldDisplay(le.supportEmail);
  const whatsapp = legalFieldDisplay(le.whatsapp);
  const responseTime = legalFieldDisplay(cp.responseTime);

  const categoryNav = useMemo(
    () =>
      FAQ_CATEGORIES.map((cat) => ({
        id: cat.id,
        label: t(`faq.categories.${cat.id}`),
      })),
    [t],
  );

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-gradient-dark">
      <MetaHelmet
        title={t("faq.meta.title")}
        description={t("faq.meta.description")}
        path="/help"
      />

      <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14 animate-slide-up">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
            {t("faq.page.eyebrow")}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
            {t("faq.page.title")}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            {t("faq.page.subtitle")}
          </p>
        </div>

        <nav
          aria-label={t("faq.page.categoryNav")}
          className="mb-10 md:mb-14 flex flex-wrap justify-center gap-2"
        >
          {categoryNav.map((cat) => (
            <a
              key={cat.id}
              href={`#faq-${cat.id}`}
              className="rounded-full border border-border bg-card/50 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            >
              {cat.label}
            </a>
          ))}
        </nav>

        <div className="space-y-12 md:space-y-16">
          {FAQ_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.id];
            return (
              <section
                key={category.id}
                id={`faq-${category.id}`}
                className="scroll-mt-24 animate-slide-up"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="w-5 h-5 text-primary" aria-hidden />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    {t(`faq.categories.${category.id}`)}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-5 md:mb-6 max-w-2xl">
                  {t(`faq.categories.${category.id}Desc`)}
                </p>
                <div
                  className={cn(
                    "rounded-2xl border border-border bg-card/50 px-4 md:px-6",
                  )}
                >
                  <FaqAccordion itemKeys={category.itemKeys} type="multiple" />
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-16 md:mt-20 rounded-2xl border border-primary/30 bg-gradient-to-br from-card/90 to-background p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t("faq.support.title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            {t("faq.support.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-lg shadow-glow-triboo">
              <Link to="/contact">
                {t("faq.support.contactCta")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            {supportEmail ? (
              <Button asChild variant="outline" size="lg" className="rounded-lg">
                <a href={`mailto:${supportEmail}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  {supportEmail}
                </a>
              </Button>
            ) : null}
            {whatsapp ? (
              <Button asChild variant="outline" size="lg" className="rounded-lg">
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t("faq.support.whatsappCta")}
                </a>
              </Button>
            ) : null}
          </div>
          {responseTime ? (
            <p className="mt-6 text-xs text-muted-foreground">{responseTime}</p>
          ) : null}
          <div className="mt-8 pt-6 border-t border-border/60 flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link to="/organizers/start" className="text-primary hover:underline">
              {t("faq.support.organizerLink")}
            </Link>
            <Link to={LEGAL_ROUTES.privacy} className="text-primary hover:underline">
              {t("legal.links.privacy")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
