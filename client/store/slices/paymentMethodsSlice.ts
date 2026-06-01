import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  AthletePaymentMethodsResponse,
  PaymentMethodSetupIntentResponse,
} from "@shared/api";

interface PaymentMethodsState {
  paymentMethods: AthletePaymentMethodsResponse["paymentMethods"];
  defaultPaymentMethodId: string | null;
  setupClientSecret: string | null;
  loading: boolean;
  loadingSetup: boolean;
  loadingAction: boolean;
  error: string | null;
}

const initialState: PaymentMethodsState = {
  paymentMethods: [],
  defaultPaymentMethodId: null,
  setupClientSecret: null,
  loading: false,
  loadingSetup: false,
  loadingAction: false,
  error: null,
};

export const fetchPaymentMethods = createAsyncThunk<
  AthletePaymentMethodsResponse,
  void,
  { rejectValue: string }
>("paymentMethods/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<AthletePaymentMethodsResponse>(
      "/athlete/payment-methods",
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not load payment methods",
    );
  }
});

export const createSetupIntent = createAsyncThunk<
  PaymentMethodSetupIntentResponse,
  void,
  { rejectValue: string }
>("paymentMethods/createSetupIntent", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post<PaymentMethodSetupIntentResponse>(
      "/athlete/payment-methods/setup-intent",
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not start card setup",
    );
  }
});

export const completeSetupIntent = createAsyncThunk<
  AthletePaymentMethodsResponse,
  { setupIntentId: string; setAsDefault?: boolean },
  { rejectValue: string }
>("paymentMethods/completeSetup", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<AthletePaymentMethodsResponse>(
      "/athlete/payment-methods/complete-setup",
      payload,
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not save card",
    );
  }
});

export const setDefaultPaymentMethod = createAsyncThunk<
  AthletePaymentMethodsResponse,
  { paymentMethodId: string },
  { rejectValue: string }
>("paymentMethods/setDefault", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.patch<AthletePaymentMethodsResponse>(
      "/athlete/payment-methods/default",
      payload,
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not update default card",
    );
  }
});

export const removePaymentMethod = createAsyncThunk<
  AthletePaymentMethodsResponse,
  { paymentMethodId: string },
  { rejectValue: string }
>("paymentMethods/remove", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.delete<AthletePaymentMethodsResponse>(
      `/athlete/payment-methods/${payload.paymentMethodId}`,
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not remove card",
    );
  }
});

const slice = createSlice({
  name: "paymentMethods",
  initialState,
  reducers: {
    clearSetupIntent(state) {
      state.setupClientSecret = null;
    },
    clearPaymentMethodsError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPaymentMethods.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchPaymentMethods.fulfilled, (s, a) => {
      s.loading = false;
      s.paymentMethods = a.payload.paymentMethods;
      s.defaultPaymentMethodId = a.payload.defaultPaymentMethodId;
    });
    b.addCase(fetchPaymentMethods.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload || "Failed to load cards";
    });

    b.addCase(createSetupIntent.pending, (s) => {
      s.loadingSetup = true;
      s.error = null;
    });
    b.addCase(createSetupIntent.fulfilled, (s, a) => {
      s.loadingSetup = false;
      s.setupClientSecret = a.payload.clientSecret;
    });
    b.addCase(createSetupIntent.rejected, (s, a) => {
      s.loadingSetup = false;
      s.error = a.payload || "Failed to start setup";
    });

    const applyMethods = (
      s: PaymentMethodsState,
      a: { payload: AthletePaymentMethodsResponse },
    ) => {
      s.loadingAction = false;
      s.paymentMethods = a.payload.paymentMethods;
      s.defaultPaymentMethodId = a.payload.defaultPaymentMethodId;
      s.setupClientSecret = null;
    };

    b.addCase(completeSetupIntent.pending, (s) => {
      s.loadingAction = true;
      s.error = null;
    });
    b.addCase(completeSetupIntent.fulfilled, applyMethods);
    b.addCase(completeSetupIntent.rejected, (s, a) => {
      s.loadingAction = false;
      s.error = a.payload || "Failed to save card";
    });

    b.addCase(setDefaultPaymentMethod.pending, (s) => {
      s.loadingAction = true;
      s.error = null;
    });
    b.addCase(setDefaultPaymentMethod.fulfilled, applyMethods);
    b.addCase(setDefaultPaymentMethod.rejected, (s, a) => {
      s.loadingAction = false;
      s.error = a.payload || "Failed to set default";
    });

    b.addCase(removePaymentMethod.pending, (s) => {
      s.loadingAction = true;
      s.error = null;
    });
    b.addCase(removePaymentMethod.fulfilled, applyMethods);
    b.addCase(removePaymentMethod.rejected, (s, a) => {
      s.loadingAction = false;
      s.error = a.payload || "Failed to remove card";
    });
  },
});

export const { clearSetupIntent, clearPaymentMethodsError } = slice.actions;
export default slice.reducer;
