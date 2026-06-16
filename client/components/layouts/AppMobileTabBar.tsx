import { useLocation } from "react-router-dom";
import PublicMobileBottomNav from "@/components/layouts/PublicMobileBottomNav";
import { shouldShowPublicMobileTabBar } from "@/utils/mobileTabBar";

/**
 * App-level mobile tab bar — stays mounted while browsing public pages so it
 * does not remount when switching Home ↔ Events ↔ Communities ↔ Blog.
 */
export default function AppMobileTabBar() {
  const { pathname } = useLocation();

  if (!shouldShowPublicMobileTabBar(pathname)) {
    return null;
  }

  return <PublicMobileBottomNav />;
}
