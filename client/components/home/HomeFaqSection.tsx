import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/home/SectionHeader";
import FaqAccordion from "@/components/faq/FaqAccordion";
import { HOME_FAQ_KEYS } from "@/constants/faqStructure";

export default function HomeFaqSection() {
  const { t } = useTranslation();

  return (
    <section
      id="faq"
      className="py-20 md:py-28 px-4 md:px-6 bg-gradient-to-b from-background via-card/25 to-background scroll-mt-[4.5rem]"
    >
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <SectionHeader
          title={t("faq.home.title")}
          subtitle={t("faq.home.subtitle")}
          actionLabel={t("faq.home.viewAll")}
          actionHref="/help"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-4"
          >
            <div className="rounded-2xl border border-border bg-card/60 p-6 md:p-8 sticky top-24">
              <div className="inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 mb-5">
                <CircleHelp className="w-6 h-6 text-primary" aria-hidden />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                {t("faq.home.cardTitle")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {t("faq.home.cardBody")}
              </p>
              <Link
                to="/help"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-foreground transition-colors group"
              >
                {t("faq.home.viewAll")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  {t("faq.home.stillStuck")}
                </p>
                <Link
                  to="/contact"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("faq.home.contactCta")}
                </Link>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-8 rounded-2xl border border-border bg-card/40 px-4 md:px-6"
          >
            <FaqAccordion itemKeys={HOME_FAQ_KEYS} defaultOpenFirst />
          </motion.div>
        </div>

        <div className="mt-8 flex justify-center md:hidden">
          <Link
            to="/help"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-primary/40 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors"
          >
            {t("faq.home.viewAll")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
