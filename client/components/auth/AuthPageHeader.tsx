import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import TribooLogo from "@/components/brand/TribooLogo";

/** Sticky header on athlete/staff login form column */
export default function AuthPageHeader() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60 shrink-0">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <TribooLogo
          surface="dark"
          className="h-9 sm:h-10 min-w-0 max-w-[min(220px,58vw)]"
        />
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary shrink-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("common.back")}
        </Link>
      </div>
    </header>
  );
}
