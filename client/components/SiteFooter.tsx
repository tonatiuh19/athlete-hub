import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TribooLogo from "@/components/brand/TribooLogo";
import AppVersionLabel from "@/components/AppVersionLabel";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

const SOCIAL_LINKS = [
  { name: "Instagram", url: "#" },
  { name: "Facebook", url: "#" },
  { name: "YouTube", url: "#" },
] as const;

export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-card py-12 md:py-16 px-4 md:px-6 mb-24 md:mb-0">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 md:gap-12 mb-10 md:mb-12">
          <div className="lg:col-span-1 space-y-4">
            <TribooLogo surface="auto" className="h-10 w-full max-w-[200px]" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("home.footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 md:mb-6 text-sm uppercase tracking-wider">
              {t("home.footer.explore")}
            </h4>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li>
                <Link to="/events" className="hover:text-primary transition-colors duration-300">
                  {t("home.navEvents")}
                </Link>
              </li>
              <li>
                <Link to="/communities" className="hover:text-primary transition-colors duration-300">
                  {t("home.navCommunities")}
                </Link>
              </li>
              <li>
                <Link to="/#leaderboards" className="hover:text-primary transition-colors duration-300">
                  {t("home.navLeaderboards")}
                </Link>
              </li>
              <li>
                <Link to="/organizers/start" className="hover:text-primary transition-colors duration-300">
                  {t("home.hostEvent")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 md:mb-6 text-sm uppercase tracking-wider">
              {t("home.footer.company")}
            </h4>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li>
                <Link to="/about" className="hover:text-primary transition-colors duration-300">
                  {t("home.footer.about")}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-primary transition-colors duration-300">
                  {t("home.footer.blog")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 md:mb-6 text-sm uppercase tracking-wider">
              {t("home.footer.support")}
            </h4>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li>
                <Link to="/help" className="hover:text-primary transition-colors duration-300">
                  {t("home.footer.help")}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary transition-colors duration-300">
                  {t("home.footer.contact")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 md:mb-6 text-sm uppercase tracking-wider">
              {t("home.footer.legal")}
            </h4>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li>
                <Link to="/legal/privacy" className="hover:text-primary transition-colors duration-300">
                  {t("home.footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/legal/terms" className="hover:text-primary transition-colors duration-300">
                  {t("home.footer.terms")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">
              {t("home.footer.newsletter")}
            </h4>
            <p className="text-muted-foreground text-sm mb-3">{t("home.footer.newsletterHint")}</p>
            <div className="flex rounded-lg border border-border overflow-hidden bg-card">
              <input
                type="email"
                placeholder={t("home.footer.emailPlaceholder")}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
              />
              <button
                type="button"
                className="px-4 bg-triboo-gradient text-primary-foreground font-bold text-sm hover:brightness-110 transition-all"
              >
                →
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 md:pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1">
              <span>
                &copy; {new Date().getFullYear()} Triboo Sport. {t("home.rightsReserved")}
              </span>
              <AppVersionLabel className="text-muted-foreground/60" />
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <ThemeToggle variant="ghost" />
              <LanguageSwitcher
                variant="ghost"
                className="border-border bg-card/60 text-muted-foreground hover:text-primary"
              />
              <Link
                to="/help"
                className="text-muted-foreground hover:text-primary text-xs transition-colors"
              >
                {t("home.footer.help")}
              </Link>
              <Link
                to="/staff/login"
                className="text-muted-foreground hover:text-primary text-xs transition-colors"
              >
                {t("home.staffAccess")}
              </Link>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  className="text-muted-foreground hover:text-primary text-sm transition-colors duration-300"
                >
                  {social.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
