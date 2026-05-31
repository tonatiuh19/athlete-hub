import { useState } from "react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import { User, Mail } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateAthleteLanguage } from "@/store/slices/athleteAuthSlice";
import { LOCALE_LABELS, normalizeLocale, type AppLocale } from "@shared/i18n";

export default function AthleteProfile() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.athleteAuth);
  const [saved, setSaved] = useState(false);
  const current = normalizeLocale(i18n.language);

  const handleLanguageChange = async (locale: AppLocale) => {
    await i18n.changeLanguage(locale);
    await dispatch(updateAthleteLanguage(locale));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <MetaHelmet
        title={t("athletePortal.profile.title")}
        description={t("athletePortal.profile.sportProfile")}
      />
      <h1 className="text-2xl font-bold">{t("athletePortal.profile.title")}</h1>
      <div className="card-sport p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan to-blue-electric flex items-center justify-center text-2xl font-bold text-navy-deep">
            {user?.firstName?.[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("athletePortal.profile.role")}
            </p>
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t border-border">
          {user?.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-cyan" />
              {user.email}
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            {t("athletePortal.profile.sportProfile")}
          </div>
        </div>
      </div>

      <div className="card-sport p-6">
        <label className="block text-sm font-medium mb-3">
          {t("athletePortal.profile.language")}
        </label>
        <div className="flex gap-2">
          {(["es", "en"] as AppLocale[]).map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => handleLanguageChange(locale)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                current === locale
                  ? "bg-cyan text-navy-deep border-cyan"
                  : "border-border text-muted-foreground hover:border-cyan/40"
              }`}
            >
              {LOCALE_LABELS[locale]}
            </button>
          ))}
        </div>
        {saved && (
          <p className="text-xs text-cyan mt-2">{t("athletePortal.profile.languageSaved")}</p>
        )}
      </div>
    </div>
  );
}
