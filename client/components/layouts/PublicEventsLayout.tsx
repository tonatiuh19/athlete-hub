import { Link, Outlet } from "react-router-dom";
import AppVersionLabel from "@/components/AppVersionLabel";
import HomeNavbar from "@/components/home/HomeNavbar";

export default function PublicEventsLayout() {
  return (
    <div className="min-h-screen bg-gradient-dark overflow-x-clip max-w-[100vw]">
      <HomeNavbar />
      <main className="pt-[4.5rem]">
        <Outlet />
      </main>
      <footer className="border-t border-gray-800/50 py-8 px-4 text-center text-xs text-gray-500">
        <Link to="/" className="hover:text-cyan transition-colors">
          AthleteHub
        </Link>
        <div className="mt-2 flex justify-center">
          <AppVersionLabel />
        </div>
      </footer>
    </div>
  );
}
