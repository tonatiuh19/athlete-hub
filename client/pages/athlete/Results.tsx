import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";

export default function AthleteResults() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <MetaHelmet
        title={t("athletePortal.results.title")}
        description={t("athletePortal.results.subtitle")}
      />
      <div className="w-16 h-16 rounded-2xl bg-cyan/10 flex items-center justify-center mx-auto mb-4">
        <Trophy className="w-8 h-8 text-cyan" />
      </div>
      <h1 className="text-2xl font-bold mb-2">{t("athletePortal.results.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("athletePortal.results.subtitle")}</p>
    </div>
  );
}
