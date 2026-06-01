import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { syncAthleteClerk } from "@/store/slices/athleteAuthSlice";
import { isClerkEnabled } from "@/lib/api";
import MetaHelmet from "@/components/MetaHelmet";

function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function SsoCallbackInner() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get("returnTo"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || error) return;
    (async () => {
      const sessionToken = await getToken();
      if (!sessionToken) {
        setError(t("auth.sso.failed"));
        return;
      }
      const result = await dispatch(syncAthleteClerk({ sessionToken }));
      if (syncAthleteClerk.fulfilled.match(result)) {
        navigate(returnTo || "/portal", { replace: true });
        return;
      }
      setError(result.payload || t("auth.sso.failed"));
    })();
  }, [isLoaded, isSignedIn, getToken, dispatch, navigate, returnTo, error, t]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <MetaHelmet title={t("auth.sso.failed")} noindex />
        <p className="text-destructive text-sm max-w-sm">{error}</p>
        <Link to="/login" className="text-sm text-cyan hover:underline">
          {t("auth.sso.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <MetaHelmet title={t("auth.sso.completing")} noindex />
      <AuthenticateWithRedirectCallback />
      <Loader2 className="w-8 h-8 animate-spin text-cyan" />
      <p className="text-muted-foreground text-sm">{t("auth.sso.completing")}</p>
    </div>
  );
}

export default function SsoCallback() {
  if (!isClerkEnabled) {
    return <Navigate to="/login" replace />;
  }
  return <SsoCallbackInner />;
}
