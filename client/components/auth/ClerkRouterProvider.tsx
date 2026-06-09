import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { clerkPublishableKey } from "@/lib/api";
import { logger } from "@/utils/logger";

/**
 * Clerk + React Router integration.
 * signInUrl/signUpUrl must be in-app routes — otherwise Clerk defaults to Account Portal.
 */
export default function ClerkRouterProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!import.meta.env.PROD || !clerkPublishableKey) return;
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal && clerkPublishableKey.startsWith("pk_test_")) {
      logger.warn(
        "[clerk] Production site is using a Clerk TEST publishable key — switch to pk_live_ in Vercel env",
      );
    }
  }, []);

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/"
      signInUrl="/login"
      signUpUrl="/login"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}
