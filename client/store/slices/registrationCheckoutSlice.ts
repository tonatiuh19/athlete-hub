import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api from "@/lib/api";
import { shouldInvalidateCheckoutForDiscount } from "@/utils/registrationCheckoutDiscount";
import type {
  ConfirmRegistrationReject,
  DiscountValidateResponse,
  EventCategory,
  PaymentConfigResponse,
  PendingCheckoutItem,
  RegistrationCheckoutResponse,
  RegistrationConfirmResponse,
  RegistrationResumeResponse,
  WaitlistEntry,
  WaiverSignatureInput,
} from "@shared/api";

export type RegistrationWizardStep = "auth" | "waiver" | "checkout" | "result";

interface RegistrationCheckoutState {
  open: boolean;
  step: RegistrationWizardStep;
  eventSlug: string | null;
  category: EventCategory | null;
  waiverAcceptance: WaiverSignatureInput[] | null;
  paymentConfig: PaymentConfigResponse | null;
  checkout: RegistrationCheckoutResponse | null;
  discountPreview: DiscountValidateResponse | null;
  discountCode: string;
  waitlistJoined: WaitlistEntry | null;
  confirmResult: RegistrationConfirmResponse | null;
  paymentFailed: boolean;
  failureMessage: string | null;
  loadingConfig: boolean;
  loadingCheckout: boolean;
  loadingConfirm: boolean;
  loadingResume: boolean;
  loadingDiscount: boolean;
  joiningWaitlist: boolean;
  waitlistMode: boolean;
  waitlistClaimMode: boolean;
  waitlistEntryId: number | null;
  error: string | null;
  pending3dsClientSecret: string | null;
  pendingCheckout: PendingCheckoutItem | null;
  loadingPendingCheckout: boolean;
}

const initialState: RegistrationCheckoutState = {
  open: false,
  step: "auth",
  eventSlug: null,
  category: null,
  waiverAcceptance: null,
  paymentConfig: null,
  checkout: null,
  discountPreview: null,
  discountCode: "",
  waitlistJoined: null,
  confirmResult: null,
  paymentFailed: false,
  failureMessage: null,
  loadingConfig: false,
  loadingCheckout: false,
  loadingConfirm: false,
  loadingResume: false,
  loadingDiscount: false,
  joiningWaitlist: false,
  waitlistMode: false,
  waitlistClaimMode: false,
  waitlistEntryId: null,
  error: null,
  pending3dsClientSecret: null,
  pendingCheckout: null,
  loadingPendingCheckout: false,
};

export const fetchPaymentConfig = createAsyncThunk<PaymentConfigResponse>(
  "registrationCheckout/fetchPaymentConfig",
  async () => {
    const { data } = await api.get<PaymentConfigResponse>("/config/payments");
    return data;
  },
);

export const validateDiscountCode = createAsyncThunk<
  DiscountValidateResponse,
  { slug: string; code: string; categoryId: number },
  { rejectValue: string }
>("registrationCheckout/validateDiscount", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<DiscountValidateResponse>(
      `/events/${payload.slug}/discount/validate`,
      { code: payload.code, categoryId: payload.categoryId },
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Invalid discount code");
  }
});

export const joinEventWaitlist = createAsyncThunk<
  WaitlistEntry,
  { slug: string; categoryId: number },
  { rejectValue: string }
>("registrationCheckout/joinWaitlist", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{ entry: WaitlistEntry }>(
      `/events/${payload.slug}/waitlist`,
      { categoryId: payload.categoryId },
    );
    return data.entry;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Could not join waitlist");
  }
});

export const createRegistrationCheckout = createAsyncThunk<
  RegistrationCheckoutResponse,
  {
    slug: string;
    categoryId: number;
    fieldValues: Record<string, string | boolean>;
    idempotencyKey: string;
    waiverSignatures?: WaiverSignatureInput[];
    /** @deprecated */
    waiverId?: number;
    /** @deprecated */
    waiverSignature?: string;
    discountCode?: string;
    waitlistEntryId?: number;
  },
  { rejectValue: string | { code?: string; message: string } }
>("registrationCheckout/createCheckout", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationCheckoutResponse>(
      `/events/${payload.slug}/register/checkout`,
      {
        categoryId: payload.categoryId,
        fieldValues: payload.fieldValues,
        idempotencyKey: payload.idempotencyKey,
        waiverSignatures: payload.waiverSignatures,
        waiverId: payload.waiverId,
        waiverSignature: payload.waiverSignature,
        discountCode: payload.discountCode,
        waitlistEntryId: payload.waitlistEntryId,
      },
    );
    return data;
  } catch (e: unknown) {
    const err = e as {
      response?: { status?: number; data?: { error?: string; code?: string } };
    };
    if (
      err?.response?.status === 409 &&
      err?.response?.data?.code === "waitlist_available"
    ) {
      return rejectWithValue("WAITLIST_AVAILABLE");
    }
    if (
      err?.response?.status === 409 &&
      err?.response?.data?.code === "already_registered"
    ) {
      return rejectWithValue("ALREADY_REGISTERED");
    }
    const code = err?.response?.data?.code;
    const message = err?.response?.data?.error || "Checkout failed";
    return rejectWithValue({ code, message });
  }
});

export const confirmRegistration = createAsyncThunk<
  RegistrationConfirmResponse,
  {
    slug: string;
    paymentPublicUuid: string;
    paymentIntentId?: string;
    paymentMethodId?: string;
  },
  { rejectValue: ConfirmRegistrationReject }
>("registrationCheckout/confirm", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationConfirmResponse>(
      `/events/${payload.slug}/register/confirm`,
      {
        paymentPublicUuid: payload.paymentPublicUuid,
        paymentIntentId: payload.paymentIntentId,
        paymentMethodId: payload.paymentMethodId,
      },
    );
    return data;
  } catch (e: unknown) {
    const err = e as {
      response?: {
        status?: number;
        data?: {
          error?: string;
          requiresAction?: boolean;
          clientSecret?: string;
        };
      };
    };
    const data = err?.response?.data;
    if (err?.response?.status === 402 && data?.requiresAction && data?.clientSecret) {
      return rejectWithValue({
        message: data.error || "Additional authentication required",
        requiresAction: true,
        clientSecret: data.clientSecret,
      });
    }
    return rejectWithValue({
      message: data?.error || "Payment confirmation failed",
    });
  }
});

export const fetchPendingCheckout = createAsyncThunk<
  PendingCheckoutItem | null,
  string,
  { rejectValue: string }
>("registrationCheckout/fetchPendingCheckout", async (eventSlug, { rejectWithValue }) => {
  try {
    const { data } = await api.get<{ pending: PendingCheckoutItem[] }>(
      `/athlete/pending-checkout?eventSlug=${encodeURIComponent(eventSlug)}`,
    );
    return data.pending[0] ?? null;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Could not load pending checkout");
  }
});

export const resumeRegistrationCheckout = createAsyncThunk<
  RegistrationResumeResponse,
  { slug: string; paymentPublicUuid?: string; idempotencyKey?: string },
  { rejectValue: string }
>("registrationCheckout/resume", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationResumeResponse>(
      `/events/${payload.slug}/register/resume`,
      {
        paymentPublicUuid: payload.paymentPublicUuid,
        idempotencyKey: payload.idempotencyKey,
      },
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Could not resume checkout");
  }
});

const slice = createSlice({
  name: "registrationCheckout",
  initialState,
  reducers: {
    openRegistrationWizard(
      state,
      action: PayloadAction<{
        slug: string;
        category: EventCategory;
        initialStep?: RegistrationWizardStep;
        waitlistMode?: boolean;
        waitlistClaimMode?: boolean;
        waitlistEntryId?: number;
      }>,
    ) {
      state.open = true;
      state.eventSlug = action.payload.slug;
      state.category = action.payload.category;
      state.waitlistMode = action.payload.waitlistMode ?? false;
      state.waitlistClaimMode = action.payload.waitlistClaimMode ?? false;
      state.waitlistEntryId = action.payload.waitlistEntryId ?? null;
      state.step = action.payload.initialStep ?? "auth";
      state.checkout = null;
      state.discountPreview = null;
      state.discountCode = "";
      state.waitlistJoined = null;
      state.confirmResult = null;
      state.waiverAcceptance = null;
      state.paymentFailed = false;
      state.failureMessage = null;
      state.error = null;
      state.pending3dsClientSecret = null;
    },
    closeRegistrationWizard(state) {
      const pendingCheckout = state.pendingCheckout;
      const loadingPendingCheckout = state.loadingPendingCheckout;
      Object.assign(state, initialState);
      state.pendingCheckout = pendingCheckout;
      state.loadingPendingCheckout = loadingPendingCheckout;
    },
    openRegistrationResult(
      state,
      action: PayloadAction<{
        slug: string;
        category: EventCategory;
        confirmResult: RegistrationConfirmResponse;
      }>,
    ) {
      state.open = true;
      state.eventSlug = action.payload.slug;
      state.category = action.payload.category;
      state.step = "result";
      state.confirmResult = action.payload.confirmResult;
      state.paymentFailed = !action.payload.confirmResult.success;
      state.failureMessage = action.payload.confirmResult.error ?? null;
      state.pending3dsClientSecret = null;
    },
    clearPending3ds(state) {
      state.pending3dsClientSecret = null;
    },
    setWizardStep(state, action: PayloadAction<RegistrationWizardStep>) {
      state.step = action.payload;
      state.error = null;
    },
    setWaiverAcceptance(state, action: PayloadAction<WaiverSignatureInput[]>) {
      state.waiverAcceptance = action.payload;
      state.step = "checkout";
      state.error = null;
    },
    setCheckoutError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setDiscountCodeInput(state, action: PayloadAction<string>) {
      state.discountCode = action.payload;
      state.discountPreview = null;
      // Do not invalidate checkout while the user is typing — wait for Apply.
    },
    clearDiscountPreview(state) {
      state.discountPreview = null;
      if (state.checkout?.discountCode || state.checkout?.discountAmountCents) {
        state.checkout = null;
        state.pending3dsClientSecret = null;
      }
    },
    setPaymentFailure(state, action: PayloadAction<string>) {
      state.paymentFailed = true;
      state.failureMessage = action.payload;
      state.step = "result";
    },
    resetCheckoutSession(state) {
      state.checkout = null;
      state.paymentFailed = false;
      state.failureMessage = null;
      state.error = null;
      state.pending3dsClientSecret = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPaymentConfig.pending, (s) => {
      s.loadingConfig = true;
    });
    b.addCase(fetchPaymentConfig.fulfilled, (s, a) => {
      s.loadingConfig = false;
      s.paymentConfig = a.payload;
    });
    b.addCase(fetchPaymentConfig.rejected, (s) => {
      s.loadingConfig = false;
      s.paymentConfig = null;
    });

    b.addCase(validateDiscountCode.pending, (s) => {
      s.loadingDiscount = true;
      s.error = null;
    });
    b.addCase(validateDiscountCode.fulfilled, (s, a) => {
      s.loadingDiscount = false;
      s.discountPreview = a.payload;
      s.discountCode = a.payload.code;
      if (
        shouldInvalidateCheckoutForDiscount(s.checkout, a.payload, a.payload.code)
      ) {
        s.checkout = null;
        s.pending3dsClientSecret = null;
      }
    });
    b.addCase(validateDiscountCode.rejected, (s, a) => {
      s.loadingDiscount = false;
      s.discountPreview = null;
      s.error = a.payload || "Invalid discount code";
    });

    b.addCase(joinEventWaitlist.pending, (s) => {
      s.joiningWaitlist = true;
      s.error = null;
    });
    b.addCase(joinEventWaitlist.fulfilled, (s, a) => {
      s.joiningWaitlist = false;
      s.waitlistJoined = a.payload;
      s.step = "result";
    });
    b.addCase(joinEventWaitlist.rejected, (s, a) => {
      s.joiningWaitlist = false;
      s.error = a.payload || "Waitlist failed";
    });

    b.addCase(createRegistrationCheckout.pending, (s) => {
      s.loadingCheckout = true;
      s.error = null;
    });
    b.addCase(createRegistrationCheckout.fulfilled, (s, a) => {
      s.loadingCheckout = false;
      s.checkout = {
        ...a.payload,
        fieldValues: a.meta.arg.fieldValues,
      };
    });
    b.addCase(createRegistrationCheckout.rejected, (s, a) => {
      s.loadingCheckout = false;
      const payload = a.payload;
      s.error =
        typeof payload === "string"
          ? payload
          : payload?.message ?? "Checkout failed";
    });

    b.addCase(confirmRegistration.pending, (s) => {
      s.loadingConfirm = true;
      s.error = null;
    });
    b.addCase(confirmRegistration.fulfilled, (s, a) => {
      s.loadingConfirm = false;
      s.confirmResult = a.payload;
      s.paymentFailed = !a.payload.success;
      s.failureMessage = a.payload.error || null;
      s.pending3dsClientSecret = null;
      if (a.payload.success) s.pendingCheckout = null;
      s.step = "result";
    });
    b.addCase(confirmRegistration.rejected, (s, a) => {
      s.loadingConfirm = false;
      const payload = a.payload;
      if (payload?.requiresAction && payload.clientSecret) {
        s.pending3dsClientSecret = payload.clientSecret;
        s.error = payload.message;
        return;
      }
      s.paymentFailed = true;
      s.failureMessage = payload?.message || "Payment failed";
      s.step = "result";
    });

    b.addCase(resumeRegistrationCheckout.pending, (s) => {
      s.loadingResume = true;
      s.error = null;
    });
    b.addCase(resumeRegistrationCheckout.fulfilled, (s, a) => {
      s.loadingResume = false;
      if (a.payload.status === "complete" && a.payload.registration) {
        s.confirmResult = { success: true, registration: a.payload.registration };
        s.paymentFailed = false;
        s.pendingCheckout = null;
        s.step = "result";
      } else if (a.payload.status === "checkout" && a.payload.checkout) {
        s.checkout = a.payload.checkout;
        if (a.payload.checkout.discountCode) {
          s.discountCode = a.payload.checkout.discountCode;
        }
        s.step = "checkout";
      } else if (a.payload.error) {
        s.error = a.payload.error;
      }
    });
    b.addCase(resumeRegistrationCheckout.rejected, (s, a) => {
      s.loadingResume = false;
      s.error = a.payload || "Could not resume checkout";
    });

    b.addCase(fetchPendingCheckout.pending, (s) => {
      s.loadingPendingCheckout = true;
    });
    b.addCase(fetchPendingCheckout.fulfilled, (s, a) => {
      s.loadingPendingCheckout = false;
      s.pendingCheckout = a.payload;
    });
    b.addCase(fetchPendingCheckout.rejected, (s) => {
      s.loadingPendingCheckout = false;
      s.pendingCheckout = null;
    });
  },
});

export const {
  openRegistrationWizard,
  closeRegistrationWizard,
  openRegistrationResult,
  clearPending3ds,
  setWizardStep,
  setWaiverAcceptance,
  setCheckoutError,
  setDiscountCodeInput,
  clearDiscountPreview,
  setPaymentFailure,
  resetCheckoutSession,
} = slice.actions;

export default slice.reducer;
