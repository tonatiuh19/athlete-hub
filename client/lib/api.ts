import axios, { type AxiosRequestHeaders } from "axios";
import { normalizeLocale, LOCALE_HTML_LANG } from "@shared/i18n";

const api = axios.create({ baseURL: "/api" });

const ATHLETE_TOKEN_KEY = "athlete_hub_athlete_token";
const STAFF_TOKEN_KEY = "athlete_hub_staff_token";

export function getAthleteToken() {
  return localStorage.getItem(ATHLETE_TOKEN_KEY);
}
export function setAthleteToken(t: string | null) {
  if (t) localStorage.setItem(ATHLETE_TOKEN_KEY, t);
  else localStorage.removeItem(ATHLETE_TOKEN_KEY);
}

export function getStaffToken() {
  return localStorage.getItem(STAFF_TOKEN_KEY);
}
export function setStaffToken(t: string | null) {
  if (t) localStorage.setItem(STAFF_TOKEN_KEY, t);
  else localStorage.removeItem(STAFF_TOKEN_KEY);
}

/** Force axios to attach the athlete JWT (never staff) for portal / checkout calls */
export const athleteAuthHeaders = { "X-Auth-Realm": "athlete" } as const;

/** Force axios to attach the staff JWT for console / admin / organizer calls */
export const staffAuthHeaders = { "X-Auth-Realm": "staff" } as const;

function isStaffRoute(url: string) {
  return (
    url.startsWith("/admin") ||
    url.startsWith("/organizer") ||
    url.startsWith("/auth/admin") ||
    url.startsWith("/auth/organizer") ||
    url.startsWith("/auth/staff")
  );
}

api.interceptors.request.use((config) => {
  const url = config.url || "";
  const realm = config.headers?.["X-Auth-Realm"];
  let token: string | null;
  if (realm === "staff") {
    token = getStaffToken();
  } else if (realm === "athlete") {
    token = getAthleteToken();
  } else {
    token = isStaffRoute(url) ? getStaffToken() : getAthleteToken();
  }
  if (token) {
    if (!config.headers) config.headers = {} as AxiosRequestHeaders;
    config.headers.Authorization = `Bearer ${token}`;
  }
  const locale = normalizeLocale(
    typeof localStorage !== "undefined"
      ? localStorage.getItem("athlete_hub_locale") || undefined
      : undefined,
  );
  if (!config.headers) config.headers = {} as AxiosRequestHeaders;
  config.headers["Accept-Language"] = LOCALE_HTML_LANG[locale];
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const url: string = err?.config?.url || "";
      const realm = err?.config?.headers?.["X-Auth-Realm"];
      const staffContext = realm === "staff" || (!realm && isStaffRoute(url));
      if (staffContext) {
        setStaffToken(null);
        if (!window.location.pathname.startsWith("/staff/login")) {
          window.location.href = "/staff/login";
        }
      } else {
        setAthleteToken(null);
        const path = window.location.pathname;
        const onPublicAuthFlow =
          path.startsWith("/events") ||
          path.startsWith("/login") ||
          path.startsWith("/sso-callback");
        if (!onPublicAuthFlow) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(err);
  },
);

export default api;

export const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.CLERK_PUBLISHABLE_KEY ||
  "";
export const isClerkEnabled = Boolean(clerkPublishableKey);
