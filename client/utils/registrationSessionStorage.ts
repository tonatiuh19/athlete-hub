import type { EventCategory, WaiverSignatureInput } from "@shared/api";
import type { RegistrationWizardStep } from "@/store/slices/registrationCheckoutSlice";

const KEY = "triboo_registration_checkout";

export type PersistedRegistrationSession = {
  eventSlug: string;
  categoryId: number;
  idempotencyKey: string;
  paymentPublicUuid?: string;
  step?: RegistrationWizardStep;
  waiverAcceptance?: WaiverSignatureInput[];
  discountCode?: string;
  fieldValues?: Record<string, string | boolean>;
  /** User passed registration details and is on the payment sub-step. */
  checkoutPaymentReady?: boolean;
  savedAt: number;
};

export function loadRegistrationSession(
  slug: string,
  categoryId: number,
): PersistedRegistrationSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedRegistrationSession;
    if (data.eventSlug !== slug || data.categoryId !== categoryId) return null;
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Pending auth step after OAuth return — wizard was open but page reloaded. */
export function loadPendingAuthRegistrationSession(
  slug: string,
): PersistedRegistrationSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedRegistrationSession;
    if (data.eventSlug !== slug || data.step !== "auth") return null;
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveRegistrationSession(session: Omit<PersistedRegistrationSession, "savedAt">) {
  try {
    const payload: PersistedRegistrationSession = { ...session, savedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

export function clearRegistrationSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function loadAnyRegistrationSession(): PersistedRegistrationSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedRegistrationSession;
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function hasPendingRegistrationAuth(slug: string): boolean {
  return Boolean(loadPendingAuthRegistrationSession(slug));
}

const IN_PROGRESS_STEPS: RegistrationWizardStep[] = ["auth", "waiver", "checkout"];

/** True while the athlete still needs to finish the wizard (not after success). */
export function isInProgressRegistrationSession(
  session: PersistedRegistrationSession | null,
): session is PersistedRegistrationSession {
  if (!session) return false;
  return IN_PROGRESS_STEPS.includes(session.step ?? "auth");
}

/** Prefer event page when a registration wizard was open before OAuth. */
export function findPendingRegistrationReturnPath(
  returnTo?: string | null,
): string | null {
  if (returnTo?.startsWith("/events/")) {
    const slug = returnTo.match(/^\/events\/([^/]+)/)?.[1];
    if (slug && hasPendingRegistrationAuth(slug)) {
      return returnTo;
    }
  }
  const saved = loadAnyRegistrationSession();
  if (saved?.step === "auth") {
    return `/events/${saved.eventSlug}`;
  }
  return null;
}

/** Only resume an in-progress registration — never send athletes back after success. */
export function registrationReturnPathAfterProfile(): string | null {
  const saved = loadAnyRegistrationSession();
  if (!isInProgressRegistrationSession(saved)) return null;
  return `/events/${saved.eventSlug}`;
}

export function categorySessionKey(category: EventCategory) {
  return { categoryId: category.id };
}
