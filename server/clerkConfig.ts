const LOCALHOST_PARTIES = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "localhost:8080",
  "127.0.0.1:8080",
  "localhost",
];

function addUrlParties(parties: Set<string>, value: string | null | undefined): void {
  const trimmed = value?.trim();
  if (!trimmed) return;

  parties.add(trimmed);

  try {
    const withProto = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    parties.add(url.origin);
    parties.add(url.host);
    parties.add(url.hostname);

    if (url.hostname.startsWith("www.")) {
      const bare = url.hostname.slice(4);
      parties.add(bare);
      parties.add(`https://${bare}`);
    } else if (
      !url.hostname.includes("localhost") &&
      !url.hostname.includes("127.0.0.1")
    ) {
      parties.add(`www.${url.hostname}`);
      parties.add(`https://www.${url.hostname}`);
    }
  } catch {
    /* ignore invalid URL fragments */
  }
}

/** Canonical public app URL for redirects, Clerk JWT azp, and emails. */
export function resolvePublicAppUrl(): string {
  const candidates = [
    process.env.PUBLIC_APP_URL,
    process.env.VITE_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  }

  return "http://localhost:8080";
}

/** Origins allowed in Clerk session JWT `azp` during backend verification. */
export function clerkAuthorizedParties(options?: { isProd?: boolean }): string[] {
  const isProd = options?.isProd ?? process.env.NODE_ENV === "production";
  const parties = new Set<string>();

  addUrlParties(parties, resolvePublicAppUrl());

  const extra = process.env.CLERK_AUTHORIZED_PARTIES?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of extra ?? []) {
    addUrlParties(parties, part);
  }

  if (!isProd) {
    for (const part of LOCALHOST_PARTIES) {
      parties.add(part);
    }
  }

  return [...parties].filter(Boolean);
}

type HeaderValue = string | string[] | undefined;

function firstHeaderValue(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}

/** Request-derived origins for Clerk JWT `azp` when PUBLIC_APP_URL does not match the live host. */
export function clerkRequestOriginsFromHeaders(
  headers: Record<string, HeaderValue>,
): string[] {
  const parties = new Set<string>();

  const origin = firstHeaderValue(headers.origin);
  if (origin) addUrlParties(parties, origin);

  const referer = firstHeaderValue(headers.referer);
  if (referer) {
    try {
      addUrlParties(parties, new URL(referer).origin);
    } catch {
      /* ignore malformed referer */
    }
  }

  const forwardedHost = firstHeaderValue(headers["x-forwarded-host"]);
  const host = forwardedHost || firstHeaderValue(headers.host);
  if (host) {
    const proto =
      firstHeaderValue(headers["x-forwarded-proto"])?.split(",")[0]?.trim() ||
      "https";
    addUrlParties(parties, `${proto}://${host}`);
  }

  return [...parties].filter(Boolean);
}

export function mergeClerkAuthorizedParties(
  base: string[],
  extra: string[],
): string[] {
  return [...new Set([...base, ...extra])].filter(Boolean);
}

export function getClerkConfigDiagnostics() {
  const secret = process.env.CLERK_SECRET_KEY?.trim() || "";
  const publicAppUrl = resolvePublicAppUrl();
  const isProd = process.env.NODE_ENV === "production";

  const warnings: string[] = [];
  if (isProd && secret.startsWith("sk_test_")) {
    warnings.push("CLERK_SECRET_KEY is a test (development) key in production");
  }
  if (isProd && /localhost|127\.0\.0\.1/i.test(publicAppUrl)) {
    warnings.push(
      "PUBLIC_APP_URL resolves to localhost in production — Clerk SSO token verification will fail",
    );
  }
  if (!secret) {
    warnings.push("CLERK_SECRET_KEY is not set — social sign-in disabled");
  }

  return {
    clerkConfigured: Boolean(secret),
    clerkKeyMode: secret.startsWith("sk_test_")
      ? "test"
      : secret.startsWith("sk_live_")
        ? "live"
        : secret
          ? "unknown"
          : null,
    publicAppUrl,
    authorizedParties: clerkAuthorizedParties({ isProd }),
    warnings,
  };
}
