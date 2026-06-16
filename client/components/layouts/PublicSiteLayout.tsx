import { Outlet, useLocation } from "react-router-dom";
import HomeNavbar from "@/components/home/HomeNavbar";
import SiteFooter from "@/components/SiteFooter";
import { shouldShowPublicMobileTabBar } from "@/utils/mobileTabBar";
import { cn } from "@/lib/utils";

export default function PublicSiteLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const hasMobileTabBar = shouldShowPublicMobileTabBar(pathname);

  return (
    <div className="flex flex-col bg-gradient-dark overflow-x-clip w-full max-w-full min-h-screen">
      <HomeNavbar />
      <main
        className={cn(
          "flex-1 w-full min-w-0 overflow-x-clip md:pb-0",
          hasMobileTabBar && "pb-28",
          !isHome && "pt-[4.5rem]",
        )}
      >
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
