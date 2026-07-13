import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-dark overflow-x-clip w-full max-w-full flex items-center justify-center px-4">
      <MetaHelmet
        title={t("notFound.message")}
        description={t("notFound.message")}
        noindex
      />
      <div className="absolute top-6 right-6">
        <LanguageSwitcher variant="ghost" />
      </div>
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-7xl md:text-8xl font-bold text-gradient mb-4">
            {t("notFound.title")}
          </h1>
          <p className="text-2xl md:text-3xl text-foreground font-semibold mb-3">
            {t("notFound.message")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            {t("notFound.back")} <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
