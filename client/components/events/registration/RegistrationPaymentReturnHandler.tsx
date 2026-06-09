import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toast } from "@/hooks/use-toast";
import {
  confirmRegistration,
  openRegistrationResult,
  openRegistrationWizard,
  resumeRegistrationCheckout,
  setPaymentFailure,
} from "@/store/slices/registrationCheckoutSlice";
import type { RegistrationWizardStep } from "@/store/slices/registrationCheckoutSlice";
import type { EventCategory } from "@shared/api";
import type { PersistedRegistrationSession } from "@/utils/registrationSessionStorage";
import {
  clearRegistrationSession,
  loadAnyRegistrationSession,
  loadPendingAuthRegistrationSession,
  loadRegistrationSession,
  saveRegistrationSession,
} from "@/utils/registrationSessionStorage";
import { fetchEventDetail } from "@/store/slices/marketplaceSlice";
import { hasOAuthCallbackParams } from "@/utils/ssoReturnStorage";

const SESSION_KEY = "triboo_registration_checkout";
const RESUME_GUARD_KEY = "triboo_registration_resume_guard";

function stubCategoryFromSession(
  saved: PersistedRegistrationSession,
  categoryName?: string,
): EventCategory {
  return {
    id: saved.categoryId,
    name: categoryName ?? "Registration",
    sold_count: 0,
    price_cents: 0,
    gender_restriction: "all",
    sort_order: 0,
  };
}

function resolveEventSlug(pathname: string): string | null {
  const pathMatch = pathname.match(/\/events\/([^/]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  return loadAnyRegistrationSession()?.eventSlug ?? null;
}

function markResumeHandled(slug: string) {
  try {
    sessionStorage.setItem(RESUME_GUARD_KEY, JSON.stringify({ slug, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

function wasResumeHandledRecently(slug: string): boolean {
  try {
    const raw = sessionStorage.getItem(RESUME_GUARD_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { slug?: string; at?: number };
    return parsed.slug === slug && Date.now() - (parsed.at ?? 0) < 10_000;
  } catch {
    return false;
  }
}

function stripPaymentQueryParams() {
  const params = new URLSearchParams(window.location.search);
  params.delete("payment_intent");
  params.delete("payment_intent_client_secret");
  params.delete("redirect_status");
  const next = params.toString();
  window.history.replaceState(
    {},
    "",
    next ? `${window.location.pathname}?${next}` : window.location.pathname,
  );
}

/** Handles Stripe 3DS return URLs, orphan resume, and OAuth registration reopen globally. */
export default function RegistrationPaymentReturnHandler() {
  const { t } = useTranslation();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { eventDetail } = useAppSelector((s) => s.marketplace);
  const { token } = useAppSelector((s) => s.athleteAuth);
  const { open: wizardOpen } = useAppSelector((s) => s.registrationCheckout);
  const handled3ds = useRef(false);
  const orphanHandled = useRef(false);
  const authResumeHandled = useRef(false);

  const slug = resolveEventSlug(location.pathname);

  useEffect(() => {
    if (!slug) return;
    if (!eventDetail || eventDetail.event.slug !== slug) {
      dispatch(fetchEventDetail(slug));
    }
  }, [dispatch, slug, eventDetail]);

  useEffect(() => {
    if (authResumeHandled.current || wizardOpen || !token || !slug) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_intent")) return;
    if (hasOAuthCallbackParams()) return;

    const saved = loadPendingAuthRegistrationSession(slug);
    if (!saved) return;
    if (!eventDetail?.categories?.length || eventDetail.event.slug !== slug) return;

    const category =
      eventDetail.categories.find((c) => c.id === saved.categoryId) ??
      stubCategoryFromSession(saved);
    authResumeHandled.current = true;
    dispatch(
      openRegistrationWizard({
        slug,
        category,
        initialStep: "auth",
      }),
    );
  }, [dispatch, eventDetail, token, wizardOpen, slug]);

  useEffect(() => {
    if (orphanHandled.current || !slug) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_intent")) return;
    if (wasResumeHandledRecently(slug)) return;

    const session = loadAnyRegistrationSession();
    if (!session || session.eventSlug !== slug || !session.paymentPublicUuid) return;
    if (session.step !== "checkout") return;

    orphanHandled.current = true;
    markResumeHandled(slug);

    void dispatch(
      resumeRegistrationCheckout({
        slug,
        paymentPublicUuid: session.paymentPublicUuid,
        idempotencyKey: session.idempotencyKey,
      }),
    ).then((result) => {
      if (!resumeRegistrationCheckout.fulfilled.match(result)) return;
      if (result.payload.status === "complete" && result.payload.registration) {
        clearRegistrationSession();
        const category =
          eventDetail?.categories.find((c) => c.id === session.categoryId) ??
          stubCategoryFromSession(session, result.payload.registration.category_name);
        dispatch(
          openRegistrationResult({
            slug,
            category,
            confirmResult: {
              success: true,
              registration: result.payload.registration,
            },
          }),
        );
        return;
      }
      if (result.payload.status === "checkout" && result.payload.checkout) {
        const category =
          eventDetail?.categories.find((c) => c.id === session.categoryId) ??
          stubCategoryFromSession(session);
        dispatch(
          openRegistrationWizard({
            slug,
            category,
            initialStep: "checkout",
          }),
        );
      }
    });
  }, [dispatch, eventDetail?.categories, slug]);

  useEffect(() => {
    if (handled3ds.current) return;

    const params = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get("payment_intent");
    const redirectStatus = params.get("redirect_status");
    if (!paymentIntentId || !slug) return;

    handled3ds.current = true;

    if (redirectStatus !== "succeeded") {
      stripPaymentQueryParams();
      dispatch(setPaymentFailure(t("registrationWizard.payment.authenticationFailed")));
      toast({
        variant: "destructive",
        title: t("registrationWizard.payment.authenticationFailed"),
        description: t("registrationWizard.payment.tryAgain"),
      });
      return;
    }

    let savedSession: PersistedRegistrationSession | null = null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedRegistrationSession;
        if (parsed.eventSlug === slug) {
          savedSession = parsed;
        }
      }
    } catch {
      /* ignore */
    }

    if (!savedSession?.paymentPublicUuid) {
      stripPaymentQueryParams();
      toast({
        variant: "destructive",
        title: t("registrationWizard.payment.sessionExpired"),
        description: t("registrationWizard.payment.tryAgain"),
      });
      return;
    }

    void dispatch(
      confirmRegistration({
        slug,
        paymentPublicUuid: savedSession.paymentPublicUuid,
        paymentIntentId,
      }),
    ).then((result) => {
      stripPaymentQueryParams();
      const category =
        eventDetail?.categories.find((c) => c.id === savedSession!.categoryId) ??
        stubCategoryFromSession(
          savedSession!,
          confirmRegistration.fulfilled.match(result)
            ? result.payload.registration?.category_name
            : undefined,
        );

      if (confirmRegistration.fulfilled.match(result)) {
        clearRegistrationSession();
        dispatch(
          openRegistrationResult({
            slug,
            category,
            confirmResult: result.payload,
          }),
        );
        return;
      }

      const message =
        typeof result.payload === "object" && result.payload && "message" in result.payload
          ? String((result.payload as { message: string }).message)
          : t("registrationWizard.payment.failed");
      dispatch(
        openRegistrationResult({
          slug,
          category,
          confirmResult: { success: false, error: message },
        }),
      );
    });
  }, [dispatch, eventDetail?.categories, slug, t]);

  return null;
}

export function usePersistRegistrationSession(args: {
  open: boolean;
  eventSlug: string | null;
  categoryId: number | null;
  idempotencyKey: string;
  step: RegistrationWizardStep;
  paymentPublicUuid?: string;
  waiverAcceptance?: { waiverId: number; signature: string; waiverVersion?: number }[] | null;
  discountCode?: string;
  fieldValues?: Record<string, string | boolean>;
  checkoutPaymentReady?: boolean;
}) {
  useEffect(() => {
    if (!args.open || !args.eventSlug || args.categoryId == null) return;
    // Never persist after success — stale checkout sessions re-trigger resume + confirmation UI.
    if (args.step === "result") return;
    saveRegistrationSession({
      eventSlug: args.eventSlug,
      categoryId: args.categoryId,
      idempotencyKey: args.idempotencyKey,
      step: args.step,
      paymentPublicUuid: args.paymentPublicUuid,
      waiverAcceptance: args.waiverAcceptance ?? undefined,
      discountCode: args.discountCode || undefined,
      fieldValues: args.fieldValues,
      checkoutPaymentReady: args.checkoutPaymentReady || undefined,
    });
  }, [
    args.open,
    args.eventSlug,
    args.categoryId,
    args.idempotencyKey,
    args.step,
    args.paymentPublicUuid,
    args.waiverAcceptance,
    args.discountCode,
    args.fieldValues,
    args.checkoutPaymentReady,
  ]);
}

export function useRestoreRegistrationSession(args: {
  open: boolean;
  eventSlug: string | null;
  categoryId: number | null;
  onRestoreIdempotencyKey: (key: string) => void;
  onRestoreWaiver: (signatures: { waiverId: number; signature: string; waiverVersion?: number }[]) => void;
  onRestoreStep: (step: RegistrationWizardStep) => void;
  onRestoreSession?: (session: PersistedRegistrationSession) => void;
}) {
  const restored = useRef(false);

  useEffect(() => {
    if (!args.open) {
      restored.current = false;
    }
  }, [args.open]);

  useEffect(() => {
    if (!args.open || !args.eventSlug || args.categoryId == null || restored.current) return;
    const saved = loadRegistrationSession(args.eventSlug, args.categoryId);
    if (!saved) return;
    restored.current = true;
    if (saved.idempotencyKey) args.onRestoreIdempotencyKey(saved.idempotencyKey);
    if (saved.waiverAcceptance?.length) args.onRestoreWaiver(saved.waiverAcceptance);
    if (saved.step && saved.step !== "result") args.onRestoreStep(saved.step);
    args.onRestoreSession?.(saved);
  }, [args.open, args.eventSlug, args.categoryId, args]);
}
