import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppVersionLabel from "@/components/AppVersionLabel";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const SOCIAL_LINKS = [
  { name: "Twitter", url: "#" },
  { name: "Instagram", url: "#" },
  { name: "LinkedIn", url: "#" },
  { name: "Discord", url: "#" },
] as const;

export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-gray-800/50 bg-bg-dark/80 py-12 md:py-16 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-12 mb-10 md:mb-12">
          <div className="lg:col-span-1">
            <Link to="/" className="text-2xl font-bold text-gradient mb-4 inline-block">
              AthleteHub
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">{t("home.footer.tagline")}</p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 md:mb-6 text-sm uppercase tracking-wider">
              {t("home.footer.product")}
            </h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li>
                <Link to="/events" className="hover:text-cyan transition-colors duration-300">
                  {t("home.navEvents")}
                </Link>
              </li>
              <li>
                <Link to="/#communities" className="hover:text-cyan transition-colors duration-300">
                  {t("home.navCommunities")}
                </Link>
              </li>
              <li>
                <Link to="/#challenges" className="hover:text-cyan transition-colors duration-300">
                  {t("home.navChallenges")}
                </Link>
              </li>
              <li>
                <Link to="/#leaderboards" className="hover:text-cyan transition-colors duration-300">
                  {t("home.navLeaderboards")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 md:mb-6 text-sm uppercase tracking-wider">
              {t("home.footer.company")}
            </h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li>
                <a href="#" className="hover:text-cyan transition-colors duration-300">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-cyan transition-colors duration-300">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-cyan transition-colors duration-300">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-cyan transition-colors duration-300">
                  Careers
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 md:mb-6 text-sm uppercase tracking-wider">
              {t("home.footer.legal")}
            </h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li>
                <a href="#" className="hover:text-cyan transition-colors duration-300">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-cyan transition-colors duration-300">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-cyan transition-colors duration-300">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800/50 pt-6 md:pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1">
              <span>
                &copy; {new Date().getFullYear()} AthleteHub. {t("home.rightsReserved")}
              </span>
              <AppVersionLabel className="text-gray-600/60" />
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <LanguageSwitcher
                variant="ghost"
                className="border-gray-700/80 bg-bg-dark/60 text-gray-400 hover:text-cyan"
              />
              <Link
                to="/staff/login"
                className="text-gray-500 hover:text-cyan text-xs transition-colors"
              >
                {t("home.staffAccess")}
              </Link>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  className="text-gray-500 hover:text-cyan text-sm transition-colors duration-300"
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
