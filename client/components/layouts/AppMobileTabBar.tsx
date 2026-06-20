import { useLocation } from "react-router-dom";
import PublicMobileBottomNav from "@/components/layouts/PublicMobileBottomNav";
import { shouldShowPublicMobileTabBar } from "@/utils/mobileTabBar";
import { useAppSelector } from "@/store/hooks";

/**
 * App-level mobile tab bar — stays mounted while browsing public pages so it
 * does not remount when switching Home ↔ Events ↔ Communities ↔ Blog.
 */
export default function AppMobileTabBar() {
  const { pathname } = useLocation();
  const staffToken = useAppSelector((s) => s.staffAuth.token);
  const athleteToken = useAppSelector((s) => s.athleteAuth.token);

  if (
    !shouldShowPublicMobileTabBar(pathname, {
      staffSessionActive: Boolean(staffToken),
      athleteSessionActive: Boolean(athleteToken),
    })
  ) {
    return null;
  }

  return <PublicMobileBottomNav />;
}
