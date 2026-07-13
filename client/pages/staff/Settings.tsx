import { useState } from "react";
import { ShieldCheck, Building2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateStaffLanguage } from "@/store/slices/staffAuthSlice";
import { LOCALE_LABELS, normalizeLocale, type AppLocale } from "@shared/i18n";

export default function StaffSettings() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, role } = useAppSelector((s) => s.staffAuth);
  const [saved, setSaved] = useState(false);
  const current = normalizeLocale(i18n.language);
  const isAdmin = role === "admin";

  const handleLanguageChange = async (locale: AppLocale) => {
    if (!role) return;
    await i18n.changeLanguage(locale);
    await dispatch(updateStaffLanguage({ locale, role }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.settings.title")}
        description={t("staffPortal.settings.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold">{t("staffPortal.settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("staffPortal.settings.subtitle")}
        </p>
      </div>

      <div className="card-sport p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan/10 border border-cyan/25 flex items-center justify-center">
            {isAdmin ? (
              <ShieldCheck className="w-7 h-7 text-primary" />
            ) : (
              <Building2 className="w-7 h-7 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-sm text-muted-foreground capitalize">
              {isAdmin ? t("staffPortal.nav.admin") : t("staffPortal.nav.organizer")} ·{" "}
              {user?.role?.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        {user?.email ? (
          <div className="flex items-center gap-3 text-sm pt-2 border-t border-border">
            <Mail className="w-4 h-4 text-primary shrink-0" />
            <span>{user.email}</span>
          </div>
        ) : null}
      </div>

      <div className="card-sport p-6">
        <label className="block text-sm font-medium mb-3">
          {t("staffPortal.settings.language")}
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
        {saved ? (
          <p className="text-xs text-primary mt-2">{t("staffPortal.settings.languageSaved")}</p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t("staffPortal.settings.accountNote")}
      </p>
    </div>
  );
}
