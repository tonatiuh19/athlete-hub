import { useCallback, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { clerkSignInPath } from "@/config/clerkUrls";
import { isClerkEnabled } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { performAthleteLogout } from "@/utils/athleteSessionLogout";
import { ssoTrace } from "@/utils/ssoTrace";

/** Clear Clerk session in-app — never navigate to the hosted Account Portal. */
async function signOutClerkInApp(clerk: ReturnType<typeof useClerk>): Promise<void> {
  const sessionId = clerk.session?.id;
  ssoTrace("logout:clerk-signout", { sessionId: sessionId ?? null });
  if (sessionId) {
    await clerk.signOut({ sessionId, redirectUrl: null });
    return;
  }
  await clerk.signOut({ redirectUrl: null });
}

export function useAthleteLogout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const clerk = useClerk();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await performAthleteLogout({
        dispatch,
        clerkSignOut:
          isClerkEnabled && clerk.loaded
            ? () => signOutClerkInApp(clerk)
            : null,
      });
      navigate(clerkSignInPath(), { replace: true });
    } catch {
      setLoggingOut(false);
    }
  }, [clerk, dispatch, loggingOut, navigate]);

  return { logout, loggingOut };
}
