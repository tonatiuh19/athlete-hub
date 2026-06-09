import { Outlet } from "react-router-dom";
import HomeNavbar from "@/components/home/HomeNavbar";
import SiteFooter from "@/components/SiteFooter";

export default function PublicEventsLayout() {
  return (
    <div className="flex flex-col bg-gradient-dark overflow-x-clip w-full max-w-full min-h-screen">
      <HomeNavbar />
      <main className="pt-[4.5rem] w-full min-w-0 overflow-x-clip">
        <div className="min-h-below-nav flex flex-col min-w-0 w-full overflow-x-clip">
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
