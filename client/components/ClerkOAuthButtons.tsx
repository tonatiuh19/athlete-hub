import { useState } from "react";
import { useAuth, useSignIn } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { FaApple, FaGoogle } from "react-icons/fa";
import { isClerkEnabled } from "@/lib/api";
import { logger } from "@/utils/logger";
import { useTranslation } from "react-i18next";

type OAuthProvider = "google" | "apple";

interface ClerkOAuthButtonsProps {
  mode: "athlete" | "staff";
  onSuccess?: () => void;
  disabled?: boolean;
}

const PROVIDERS: {
  id: OAuthProvider;
  label: string;
  icon: React.ReactNode;
  strategy: string;
}[] = [
  {
    id: "google",
    label: "Google",
    icon: <FaGoogle className="w-4 h-4" />,
    strategy: "oauth_google",
  },
  {
    id: "apple",
    label: "Apple",
    icon: <FaApple className="w-4 h-4" />,
    strategy: "oauth_apple",
  },
];

function ClerkOAuthButtonsDisabled() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-xs text-center text-muted-foreground">
        {t("common.clerkDisabled")}
      </p>
      <div className="grid grid-cols-2 gap-2 opacity-40 pointer-events-none">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm"
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClerkOAuthButtonsInner({
  mode,
  onSuccess,
  disabled,
}: ClerkOAuthButtonsProps) {
  const { isLoaded, signIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = useState<OAuthProvider | null>(null);

  if (!isLoaded) return null;

  const handleOAuth = async (provider: OAuthProvider, strategy: string) => {
    if (!signIn || disabled) return;
    setLoading(provider);
    try {
      await signIn.authenticateWithRedirect({
        strategy: strategy as "oauth_google" | "oauth_apple",
        redirectUrl: `/sso-callback?mode=${mode}`,
        redirectUrlComplete: mode === "athlete" ? "/portal" : "/staff",
      });
      onSuccess?.();
    } catch (err) {
      logger.error("Clerk OAuth error", err);
    } finally {
      setLoading(null);
    }
  };

  if (isSignedIn) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={!!loading || disabled}
          onClick={() => handleOAuth(p.id, p.strategy)}
          className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card hover:border-cyan/40 hover:bg-cyan/5 text-sm font-medium transition-all"
        >
          {loading === p.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            p.icon
          )}
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function ClerkOAuthButtons(props: ClerkOAuthButtonsProps) {
  if (!isClerkEnabled) return <ClerkOAuthButtonsDisabled />;
  return <ClerkOAuthButtonsInner {...props} />;
}
