import { Outlet } from "react-router-dom";
import HomeNavbar from "@/components/home/HomeNavbar";
import SiteFooter from "@/components/SiteFooter";

export default function PublicEventsLayout() {
  return (
    <div className="flex flex-col bg-gradient-dark overflow-x-clip max-w-[100vw]">
      <HomeNavbar />
      <main className="pt-[4.5rem] w-full">
        <div className="min-h-below-nav flex flex-col">
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
