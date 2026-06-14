import { Outlet, useLocation } from "react-router-dom";
import HomeNavbar from "@/components/home/HomeNavbar";
import SiteFooter from "@/components/SiteFooter";
import PublicMobileBottomNav from "@/components/layouts/PublicMobileBottomNav";
import { cn } from "@/lib/utils";

export default function PublicSiteLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className="flex flex-col bg-gradient-dark overflow-x-clip w-full max-w-full min-h-screen">
      <HomeNavbar />
      <main
        className={cn(
          "flex-1 w-full min-w-0 overflow-x-clip pb-28 md:pb-0",
          !isHome && "pt-[4.5rem]",
        )}
      >
        <Outlet />
      </main>
      <SiteFooter />
      <PublicMobileBottomNav />
    </div>
  );
}
