import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  DiscountValidateResponse,
  EventCategory,
  PaymentConfigResponse,
  RegistrationCheckoutResponse,
  RegistrationConfirmResponse,
  WaitlistEntry,
} from "@shared/api";

export type RegistrationWizardStep = "auth" | "waiver" | "checkout" | "result";

interface RegistrationCheckoutState {
  open: boolean;
  step: RegistrationWizardStep;
  eventSlug: string | null;
  category: EventCategory | null;
  waiverAcceptance: { waiverId: number; waiverSignature: string } | null;
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
  loadingDiscount: boolean;
  joiningWaitlist: boolean;
  waitlistMode: boolean;
  waitlistClaimMode: boolean;
  waitlistEntryId: number | null;
  error: string | null;
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
  loadingDiscount: false,
  joiningWaitlist: false,
  waitlistMode: false,
  waitlistClaimMode: false,
  waitlistEntryId: null,
  error: null,
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
    waiverId?: number;
    waiverSignature?: string;
    discountCode?: string;
    waitlistEntryId?: number;
  },
  { rejectValue: string }
>("registrationCheckout/createCheckout", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationCheckoutResponse>(
      `/events/${payload.slug}/register/checkout`,
      {
        categoryId: payload.categoryId,
        fieldValues: payload.fieldValues,
        idempotencyKey: payload.idempotencyKey,
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
    return rejectWithValue(err?.response?.data?.error || "Checkout failed");
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
  { rejectValue: string }
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
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Payment confirmation failed");
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
    },
    closeRegistrationWizard(state) {
      Object.assign(state, initialState);
    },
    setWizardStep(state, action: PayloadAction<RegistrationWizardStep>) {
      state.step = action.payload;
      state.error = null;
    },
    setWaiverAcceptance(
      state,
      action: PayloadAction<{ waiverId: number; waiverSignature: string }>,
    ) {
      state.waiverAcceptance = action.payload;
      state.step = "checkout";
      state.error = null;
    },
    advanceWizardAfterAuth(state) {
      state.step = "checkout";
      state.error = null;
    },
    setCheckoutError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setDiscountCodeInput(state, action: PayloadAction<string>) {
      state.discountCode = action.payload;
      state.discountPreview = null;
    },
    clearDiscountPreview(state) {
      state.discountPreview = null;
    },
    setPaymentFailure(state, action: PayloadAction<string>) {
      state.paymentFailed = true;
      state.failureMessage = action.payload;
      state.step = "result";
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
      s.checkout = a.payload;
    });
    b.addCase(createRegistrationCheckout.rejected, (s, a) => {
      s.loadingCheckout = false;
      s.error = a.payload || "Checkout failed";
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
      s.step = "result";
    });
    b.addCase(confirmRegistration.rejected, (s, a) => {
      s.loadingConfirm = false;
      s.paymentFailed = true;
      s.failureMessage = a.payload || "Payment failed";
      s.step = "result";
    });
  },
});

export const {
  openRegistrationWizard,
  closeRegistrationWizard,
  setWizardStep,
  setWaiverAcceptance,
  advanceWizardAfterAuth,
  setCheckoutError,
  setDiscountCodeInput,
  clearDiscountPreview,
  setPaymentFailure,
} = slice.actions;

export default slice.reducer;
