import { useEffect } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { syncAthleteClerk } from "@/store/slices/athleteAuthSlice";
import { syncStaffClerk } from "@/store/slices/staffAuthSlice";
import { isClerkEnabled } from "@/lib/api";
import MetaHelmet from "@/components/MetaHelmet";

function SsoCallbackInner() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const mode = params.get("mode") === "staff" ? "staff" : "athlete";
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      const sessionToken = await getToken();
      if (!sessionToken) return;
      if (mode === "athlete") {
        const result = await dispatch(syncAthleteClerk({ sessionToken }));
        if (syncAthleteClerk.fulfilled.match(result)) {
          navigate("/portal", { replace: true });
        }
      } else {
        const result = await dispatch(syncStaffClerk({ sessionToken }));
        if (syncStaffClerk.fulfilled.match(result)) {
          navigate("/staff", { replace: true });
        }
      }
    })();
  }, [isLoaded, isSignedIn, getToken, dispatch, mode, navigate, params]);

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
