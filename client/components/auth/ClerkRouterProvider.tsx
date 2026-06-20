import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { clerkSignInUrl, clerkSignUpUrl } from "@/config/clerkUrls";
import { clerkPublishableKey } from "@/lib/api";
import { clerkOAuthRoutingSnapshot } from "@/utils/clerkOAuthRouting";
import { CLERK_SSO_CALLBACK_PATH } from "@/config/clerkUrls";
import { athleteSsoCallbackPathWithCurrentQuery, shouldRedirectClerkAuthRouteToCallback } from "@/utils/athleteSsoUx";
import { ssoTrace } from "@/utils/ssoTrace";
import { logger } from "@/utils/logger";

/**
 * Clerk + React Router integration.
 * signInUrl/signUpUrl must be in-app routes — otherwise Clerk defaults to Account Portal.
 */
export default function ClerkRouterProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    ssoTrace("clerk-provider:mount", clerkOAuthRoutingSnapshot());
  }, []);

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

  const signInUrl = clerkSignInUrl();
  const signUpUrl = clerkSignUpUrl();

  const guardedNavigate = (to: string, replace: boolean) => {
    if (shouldRedirectClerkAuthRouteToCallback(to)) {
      ssoTrace("navigation:redirect-to-callback-instead-of-login", {
        to,
        from: window.location.pathname,
        target: athleteSsoCallbackPathWithCurrentQuery(),
      });
      navigate(athleteSsoCallbackPathWithCurrentQuery(), { replace: true });
      return;
    }
    if (replace) navigate(to, { replace: true });
    else navigate(to);
  };

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl={signInUrl}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      signInFallbackRedirectUrl="/portal"
      signUpFallbackRedirectUrl="/portal"
      routerPush={(to) => guardedNavigate(to, false)}
      routerReplace={(to) => guardedNavigate(to, true)}
    >
      {children}
    </ClerkProvider>
  );
}
