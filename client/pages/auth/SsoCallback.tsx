import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth, useClerk, useSession, useSignIn, useSignUp } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import TribooLogo from "@/components/brand/TribooLogo";
import AuthFlowLoadingPanel, {
  type AuthFlowLoadingStep,
} from "@/components/auth/AuthFlowLoadingPanel";
import { resumeClerkAthleteSession, clerkResumeError, clerkResumePath } from "@/utils/clerkAthleteSync";
import { extractApiErrorMessage } from "@/utils/apiError";
import { clerkSignInUrl } from "@/config/clerkUrls";
import { clerkSsoCallbackUrl } from "@/utils/clerkSso";
import {
  clerkOAuthCallbackParams,
  clerkOAuthRoutingSnapshot,
} from "@/utils/clerkOAuthRouting";
import { logger } from "@/utils/logger";
import { useAppDispatch } from "@/store/hooks";
import { isClerkEnabled } from "@/lib/api";
import { resolveSsoReturnTo } from "@/utils/ssoReturnStorage";
import {
  clearSsoOAuthStarted,
  installSsoNavigationProbe,
  serializeClerkError,
  ssoClerkSnapshot,
  ssoTrace,
  ssoTraceSignIn,
  ssoTraceSignUp,
  ssoUrlSnapshot,
} from "@/utils/ssoTrace";
import MetaHelmet from "@/components/MetaHelmet";

const CALLBACK_WAIT_MS = 25_000;

function SsoCallbackInner() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const returnTo = useMemo(
    () => resolveSsoReturnTo(params.get("returnTo")),
    [params],
  );
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const clerk = useClerk();
  const oauthCallbackParams = useMemo(() => clerkOAuthCallbackParams(), []);
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { session } = useSession();
  const { signIn, setActive: setActiveFromSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveFromSignUp, isLoaded: signUpLoaded } = useSignUp();
  const callbackHandledRef = useRef(false);
  const syncStartedRef = useRef(false);
  const [clerkCallbackReady, setClerkCallbackReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(t("auth.sso.completing"));
  const [step, setStep] = useState<AuthFlowLoadingStep>("verify");

  const hasClerkSession = Boolean(session?.id || isSignedIn || clerk.session?.id);

  const snapshot = () => ({
    url: ssoUrlSnapshot(),
    returnTo,
    routing: clerkOAuthRoutingSnapshot(),
    clerk: ssoClerkSnapshot({
      clerkLoaded: clerk.loaded,
      authLoaded: isLoaded,
      isSignedIn,
      userId,
      sessionId: session?.id,
      clerkSessionId: clerk.session?.id,
    }),
    signIn: signInLoaded ? ssoTraceSignIn(signIn) : { signIn: "loading" },
    signUp: signUpLoaded ? ssoTraceSignUp(signUp) : { signUp: "loading" },
  });

  useEffect(() => {
    installSsoNavigationProbe();
    ssoTrace("page:mount", snapshot());
    if (window.location.hostname.endsWith(".accounts.dev")) {
      ssoTrace("page:accounts-dev-detected", {
        hint: "Clerk Account Portal — callback missing signInUrl/signUpUrl or Dashboard Paths wrong",
        ...snapshot(),
      });
    }
  }, []);

  // Step 1: Complete Clerk OAuth redirect (must pass signInUrl/signUpUrl or Clerk uses Account Portal).
  useEffect(() => {
    if (!clerk.loaded || !signInLoaded || !signUpLoaded || callbackHandledRef.current) return;
    callbackHandledRef.current = true;

    setStep("verify");
    setStatusMessage(t("auth.sso.verifyingRedirect"));

    void (async () => {
      ssoTrace("callback:start", snapshot());

      try {
        await clerk.handleRedirectCallback(oauthCallbackParams);
        ssoTrace("callback:handleRedirectCallback:done", snapshot());
      } catch (err) {
        ssoTrace("callback:handleRedirectCallback:error", {
          error: serializeClerkError(err),
          ...snapshot(),
        });
        logger.warn("[sso-callback] handleRedirectCallback", err);
      }

      try {
        if (signIn?.status === "complete" && signIn.createdSessionId && setActiveFromSignIn) {
          await setActiveFromSignIn({ session: signIn.createdSessionId });
        } else if (
          signUp?.status === "complete" &&
          signUp.createdSessionId &&
          setActiveFromSignUp
        ) {
          await setActiveFromSignUp({ session: signUp.createdSessionId });
        } else if ((signUp as { isTransferable?: boolean }).isTransferable && signIn) {
          await signIn.create({ transfer: true });
          if (signIn.status === "complete" && signIn.createdSessionId && setActiveFromSignIn) {
            await setActiveFromSignIn({ session: signIn.createdSessionId });
          }
        } else if ((signIn as { isTransferable?: boolean }).isTransferable && signUp) {
          await signUp.create({ transfer: true });
          if (signUp.status === "complete" && signUp.createdSessionId && setActiveFromSignUp) {
            await setActiveFromSignUp({ session: signUp.createdSessionId });
          }
        } else {
          const signInExisting = (signIn as { existingSession?: { sessionId?: string } })
            ?.existingSession;
          const signUpExisting = (signUp as { existingSession?: { sessionId?: string } })
            ?.existingSession;
          if (signInExisting?.sessionId && setActiveFromSignIn) {
            await setActiveFromSignIn({ session: signInExisting.sessionId });
          } else if (signUpExisting?.sessionId && setActiveFromSignUp) {
            await setActiveFromSignUp({ session: signUpExisting.sessionId });
          }
        }
        ssoTrace("callback:session-activation:done", snapshot());
      } catch (err) {
        ssoTrace("callback:session-activation:error", {
          error: serializeClerkError(err),
          ...snapshot(),
        });
        logger.error("[sso-callback] session activation failed", err);
      } finally {
        setClerkCallbackReady(true);
        ssoTrace("callback:ready-for-triboo-sync", snapshot());
      }
    })();
  }, [
    clerk,
    oauthCallbackParams,
    setActiveFromSignIn,
    setActiveFromSignUp,
    signIn,
    signInLoaded,
    signUp,
    signUpLoaded,
    t,
  ]);

  // Step 2: Exchange Clerk session for Triboo JWT — only after Clerk callback finishes.
  useEffect(() => {
    if (!isLoaded || syncStartedRef.current || error) return;
    if (!clerkCallbackReady || !hasClerkSession) return;

    syncStartedRef.current = true;

    void (async () => {
      try {
        setStep("sync");
        setStatusMessage(t("auth.sso.syncingAccount"));
        ssoTrace("sync:start", snapshot());

        const resumed = await resumeClerkAthleteSession({
          dispatch,
          getToken,
          returnTo,
        });
        if (resumed.ok) {
          const path = clerkResumePath(resumed);
          if (!path) {
            clearSsoOAuthStarted();
            setError(t("auth.sso.failed"));
            return;
          }
          ssoTrace("sync:success", { path });
          setStep("ready");
          setStatusMessage(t("auth.sso.almostThere"));
          await new Promise((r) => setTimeout(r, 300));
          clearSsoOAuthStarted();
          navigate(path, { replace: true });
          return;
        }

        clearSsoOAuthStarted();
        setError(clerkResumeError(resumed) || t("auth.sso.failed"));
      } catch (err) {
        ssoTrace("sync:error", { error: serializeClerkError(err), ...snapshot() });
        logger.error("[sso-callback] sync failed", err);
        clearSsoOAuthStarted();
        setError(t("auth.sso.failed"));
      }
    })();
  }, [clerkCallbackReady, dispatch, error, getToken, hasClerkSession, isLoaded, navigate, returnTo, t]);

  useEffect(() => {
    if (!isLoaded || hasClerkSession || error || !clerkCallbackReady) return;

    const timer = window.setTimeout(() => {
      if (!syncStartedRef.current) {
        ssoTrace("callback:timeout", snapshot());
        setError(t("auth.sso.failed"));
      }
    }, CALLBACK_WAIT_MS);

    return () => window.clearTimeout(timer);
  }, [clerkCallbackReady, error, hasClerkSession, isLoaded, t]);

  if (error) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <MetaHelmet title={t("auth.sso.failed")} noindex />
        <TribooLogo surface="dark" className="h-10 mb-2" />
        <p className="text-destructive text-sm max-w-sm">{extractApiErrorMessage(error)}</p>
        {import.meta.env.DEV ? (
          <p className="text-xs text-muted-foreground max-w-sm">
            Dev: filter Console by <code className="text-cyan">[sso]</code>. Clerk Dashboard → Paths →
            Sign-in URL must be{" "}
            <code className="text-cyan">{clerkSignInUrl()}</code>
          </p>
        ) : null}
        <Link to="/login" className="text-sm text-cyan hover:underline">
          {t("auth.sso.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <MetaHelmet title={t("auth.sso.completing")} noindex />
      <div id="clerk-captcha" />
      <AuthFlowLoadingPanel statusMessage={statusMessage} step={step} />
    </>
  );
}

export default function SsoCallback() {
  if (!isClerkEnabled) {
    return <Navigate to="/login" replace />;
  }
  return <SsoCallbackInner />;
}
