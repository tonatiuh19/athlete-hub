import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  EventCategory,
  PaymentConfigResponse,
  RegistrationCheckoutResponse,
  RegistrationConfirmResponse,
} from "@shared/api";

export type RegistrationWizardStep = "auth" | "checkout" | "result";

interface RegistrationCheckoutState {
  open: boolean;
  step: RegistrationWizardStep;
  eventSlug: string | null;
  category: EventCategory | null;
  paymentConfig: PaymentConfigResponse | null;
  checkout: RegistrationCheckoutResponse | null;
  confirmResult: RegistrationConfirmResponse | null;
  paymentFailed: boolean;
  failureMessage: string | null;
  loadingConfig: boolean;
  loadingCheckout: boolean;
  loadingConfirm: boolean;
  error: string | null;
}

const initialState: RegistrationCheckoutState = {
  open: false,
  step: "auth",
  eventSlug: null,
  category: null,
  paymentConfig: null,
  checkout: null,
  confirmResult: null,
  paymentFailed: false,
  failureMessage: null,
  loadingConfig: false,
  loadingCheckout: false,
  loadingConfirm: false,
  error: null,
};

export const fetchPaymentConfig = createAsyncThunk<PaymentConfigResponse>(
  "registrationCheckout/fetchPaymentConfig",
  async () => {
    const { data } = await api.get<PaymentConfigResponse>("/config/payments");
    return data;
  },
);

export const createRegistrationCheckout = createAsyncThunk<
  RegistrationCheckoutResponse,
  {
    slug: string;
    categoryId: number;
    fieldValues: Record<string, string | boolean>;
    idempotencyKey: string;
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
      },
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Checkout failed");
  }
});

export const confirmRegistration = createAsyncThunk<
  RegistrationConfirmResponse,
  { slug: string; registrationPublicUuid: string; paymentIntentId?: string },
  { rejectValue: string }
>("registrationCheckout/confirm", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationConfirmResponse>(
      `/events/${payload.slug}/register/confirm`,
      {
        registrationPublicUuid: payload.registrationPublicUuid,
        paymentIntentId: payload.paymentIntentId,
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
      action: PayloadAction<{ slug: string; category: EventCategory }>,
    ) {
      state.open = true;
      state.eventSlug = action.payload.slug;
      state.category = action.payload.category;
      state.step = "auth";
      state.checkout = null;
      state.confirmResult = null;
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
    advanceWizardAfterAuth(state) {
      state.step = "checkout";
      state.error = null;
    },
    setCheckoutError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
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
      s.paymentConfig = { publishableKey: null, mockMode: true, currency: "MXN" };
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
  advanceWizardAfterAuth,
  setCheckoutError,
  setPaymentFailure,
} = slice.actions;

export default slice.reducer;
