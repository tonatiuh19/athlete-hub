import type { IconType } from "react-icons";
import { FaFacebook, FaGoogle } from "react-icons/fa";

export type ClerkOAuthProviderId = "google" | "facebook";

export type ClerkOAuthStrategy = "oauth_google" | "oauth_facebook";

export interface ClerkOAuthProviderConfig {
  id: ClerkOAuthProviderId;
  label: string;
  strategy: ClerkOAuthStrategy;
  Icon: IconType;
}

const ALL_PROVIDERS: Record<ClerkOAuthProviderId, ClerkOAuthProviderConfig> = {
  google: {
    id: "google",
    label: "Google",
    strategy: "oauth_google",
    Icon: FaGoogle,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    strategy: "oauth_facebook",
    Icon: FaFacebook,
  },
};

const DEFAULT_PROVIDER_IDS: ClerkOAuthProviderId[] = ["google"];

/** Enabled OAuth buttons — controlled by VITE_CLERK_OAUTH_PROVIDERS (comma-separated). */
export function getClerkOAuthProviders(): ClerkOAuthProviderConfig[] {
  const raw = import.meta.env.VITE_CLERK_OAUTH_PROVIDERS?.trim();
  const ids = (raw ? raw.split(",") : DEFAULT_PROVIDER_IDS)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<ClerkOAuthProviderId>();
  const providers: ClerkOAuthProviderConfig[] = [];

  for (const id of ids) {
    if (id === "apple") continue;
    if (id !== "google" && id !== "facebook") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    providers.push(ALL_PROVIDERS[id]);
  }

  return providers.length > 0 ? providers : [ALL_PROVIDERS.google];
}
