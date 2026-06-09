import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import {
  getClerkOAuthProviders,
  type ClerkOAuthProviderConfig,
  type ClerkOAuthProviderId,
  type ClerkOAuthStrategy,
} from "@/config/clerkOAuthProviders";
import { getAthleteToken, isClerkEnabled } from "@/lib/api";
import { clerkSsoCallbackUrl } from "@/utils/clerkSso";
import { logger } from "@/utils/logger";
import { stashSsoReturnTo } from "@/utils/ssoReturnStorage";
import { markSsoOAuthStarted, ssoTrace } from "@/utils/ssoTrace";
import { useTranslation } from "react-i18next";

interface ClerkOAuthButtonsProps {
  onSuccess?: () => void;
  disabled?: boolean;
  /** After SSO, return here instead of /portal (athlete registration wizard). */
  returnTo?: string;
}

function OAuthButtonGrid({
  providers,
  loading,
  disabled,
  onSelect,
}: {
  providers: ClerkOAuthProviderConfig[];
  loading: ClerkOAuthProviderId | null;
  disabled?: boolean;
  onSelect: (provider: ClerkOAuthProviderConfig) => void;
}) {
  const gridClass =
    providers.length === 1 ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2";

  return (
    <div className={gridClass}>
      {providers.map((provider) => {
        const Icon = provider.Icon;
        return (
          <button
            key={provider.id}
            type="button"
            disabled={!!loading || disabled}
            onClick={() => onSelect(provider)}
            className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card hover:border-cyan/40 hover:bg-cyan/5 text-sm font-medium transition-all"
          >
            {loading === provider.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Icon className="w-4 h-4" />
            )}
            {provider.label}
          </button>
        );
      })}
    </div>
  );
}

function ClerkOAuthButtonsDisabled() {
  const { t } = useTranslation();
  const providers = getClerkOAuthProviders();

  return (
    <div className="space-y-2">
      <p className="text-xs text-center text-muted-foreground">
        {t("common.clerkDisabled")}
      </p>
      <div className="opacity-40 pointer-events-none">
        <OAuthButtonGrid
          providers={providers}
          loading={null}
          onSelect={() => undefined}
        />
      </div>
    </div>
  );
}

function ClerkOAuthButtonsInner({
  onSuccess,
  disabled,
  returnTo,
}: ClerkOAuthButtonsProps) {
  const { isLoaded, signIn } = useSignIn();
  const [loading, setLoading] = useState<ClerkOAuthProviderId | null>(null);
  const providers = getClerkOAuthProviders();

  if (!isLoaded || providers.length === 0) return null;

  // Triboo JWT is the source of truth — Clerk session alone is not enough.
  if (getAthleteToken()) return null;

  const handleOAuth = async (
    provider: ClerkOAuthProviderConfig,
    strategy: ClerkOAuthStrategy,
  ) => {
    if (!signIn || disabled || loading) return;
    setLoading(provider.id);
    try {
      const resolvedReturnTo =
        returnTo ?? `${window.location.pathname}${window.location.search}`;
      stashSsoReturnTo(resolvedReturnTo);
      markSsoOAuthStarted();

      const callbackUrl = clerkSsoCallbackUrl();
      ssoTrace("oauth:start", {
        provider: provider.id,
        strategy,
        redirectUrl: callbackUrl,
        redirectUrlComplete: callbackUrl,
        returnTo: resolvedReturnTo,
      });

      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: callbackUrl,
        redirectUrlComplete: callbackUrl,
      });
      onSuccess?.();
    } catch (err) {
      ssoTrace("oauth:error", { provider: provider.id, strategy, error: String(err) });
      logger.error("Clerk OAuth error", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <OAuthButtonGrid
      providers={providers}
      loading={loading}
      disabled={disabled}
      onSelect={(provider) => void handleOAuth(provider, provider.strategy)}
    />
  );
}

export default function ClerkOAuthButtons(props: ClerkOAuthButtonsProps) {
  if (!isClerkEnabled) return <ClerkOAuthButtonsDisabled />;
  return <ClerkOAuthButtonsInner {...props} />;
}
