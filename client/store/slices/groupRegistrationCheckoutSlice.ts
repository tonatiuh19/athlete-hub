import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api, { athleteAuthHeaders } from "@/lib/api";
import type {
  ConfirmRegistrationReject,
  EventCategory,
  GroupCheckoutLineItemInput,
  PaymentConfigResponse,
  RegistrationCheckoutResponse,
  RegistrationConfirmResponse,
  WaiverSignatureInput,
} from "@shared/api";

export type GroupWizardStep =
  | "auth"
  | "quantity"
  | "participant"
  | "review"
  | "checkout"
  | "result";

export interface GroupParticipantDraft extends GroupCheckoutLineItemInput {
  category?: EventCategory;
  /** Explicit for Immer draft typing across package boundary */
  managedByPurchaser?: boolean;
}

interface GroupRegistrationCheckoutState {
  open: boolean;
  step: GroupWizardStep;
  eventSlug: string | null;
  participantCount: number;
  includeSelf: boolean;
  currentParticipantIndex: number;
  participants: GroupParticipantDraft[];
  checkout: RegistrationCheckoutResponse | null;
  confirmResult: RegistrationConfirmResponse | null;
  discountCode: string;
  paymentConfig: PaymentConfigResponse | null;
  paymentFailed: boolean;
  failureMessage: string | null;
  loadingCheckout: boolean;
  loadingConfirm: boolean;
  error: string | null;
  pending3dsClientSecret: string | null;
}

const initialState: GroupRegistrationCheckoutState = {
  open: false,
  step: "auth",
  eventSlug: null,
  participantCount: 2,
  includeSelf: true,
  currentParticipantIndex: 0,
  participants: [],
  checkout: null,
  confirmResult: null,
  discountCode: "",
  paymentConfig: null,
  paymentFailed: false,
  failureMessage: null,
  loadingCheckout: false,
  loadingConfirm: false,
  error: null,
  pending3dsClientSecret: null,
};

const athleteRequest = { headers: athleteAuthHeaders };

export const createGroupRegistrationCheckout = createAsyncThunk<
  RegistrationCheckoutResponse,
  {
    slug: string;
    lineItems: GroupCheckoutLineItemInput[];
    idempotencyKey: string;
    discountCode?: string;
  },
  { rejectValue: string | { code?: string; message: string } }
>("groupRegistration/createCheckout", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationCheckoutResponse>(
      `/events/${payload.slug}/register/checkout`,
      {
        lineItems: payload.lineItems,
        fieldValues: {},
        idempotencyKey: payload.idempotencyKey,
        discountCode: payload.discountCode,
      },
      athleteRequest,
    );
    return data;
  } catch (e: unknown) {
    const err = e as {
      response?: { status?: number; data?: { error?: string; code?: string } };
    };
    const code = err?.response?.data?.code;
    const message = err?.response?.data?.error || "Checkout failed";
    return rejectWithValue({ code, message });
  }
});

export const confirmGroupRegistration = createAsyncThunk<
  RegistrationConfirmResponse,
  {
    slug: string;
    paymentPublicUuid: string;
    paymentIntentId?: string;
    paymentMethodId?: string;
  },
  { rejectValue: ConfirmRegistrationReject }
>("groupRegistration/confirm", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationConfirmResponse>(
      `/events/${payload.slug}/register/confirm`,
      {
        paymentPublicUuid: payload.paymentPublicUuid,
        paymentIntentId: payload.paymentIntentId,
        paymentMethodId: payload.paymentMethodId,
      },
      athleteRequest,
    );
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: ConfirmRegistrationReject } };
    return rejectWithValue(
      err?.response?.data ?? { message: "Confirmation failed" },
    );
  }
});

const slice = createSlice({
  name: "groupRegistration",
  initialState,
  reducers: {
    openGroupRegistrationWizard(state, action: PayloadAction<{ slug: string }>) {
      Object.assign(state, initialState);
      state.open = true;
      state.eventSlug = action.payload.slug;
      state.step = "auth";
    },
    closeGroupRegistrationWizard(state) {
      Object.assign(state, initialState);
    },
    setGroupWizardStep(state, action: PayloadAction<GroupWizardStep>) {
      state.step = action.payload;
      state.error = null;
    },
    setGroupParticipantCount(state, action: PayloadAction<number>) {
      state.participantCount = Math.max(1, Math.min(20, action.payload));
    },
    setGroupIncludeSelf(state, action: PayloadAction<boolean>) {
      state.includeSelf = action.payload;
    },
    initGroupParticipants(state) {
      const count = state.participantCount;
      const drafts: GroupParticipantDraft[] = [];
      for (let i = 0; i < count; i++) {
        const isSelf = state.includeSelf && i === 0;
        drafts.push({
          lineId: crypto.randomUUID(),
          participantType: isSelf ? "self" : "guest",
          categoryId: 0,
          fieldValues: {},
          selectedExtras: [],
          extraFieldAnswers: [],
        });
      }
      state.participants = drafts;
      state.currentParticipantIndex = 0;
    },
    setCurrentParticipantIndex(state, action: PayloadAction<number>) {
      state.currentParticipantIndex = action.payload;
    },
    updateCurrentParticipant(
      state,
      action: PayloadAction<Partial<GroupParticipantDraft>>,
    ) {
      const idx = state.currentParticipantIndex;
      if (!state.participants[idx]) return;
      state.participants[idx] = { ...state.participants[idx], ...action.payload };
      state.checkout = null;
    },
    setGroupDiscountCode(state, action: PayloadAction<string>) {
      state.discountCode = action.payload;
      state.checkout = null;
    },
    setGroupWaiverForCurrent(
      state,
      action: PayloadAction<WaiverSignatureInput[]>,
    ) {
      const idx = state.currentParticipantIndex;
      if (state.participants[idx]) {
        state.participants[idx].waiverSignatures = action.payload;
      }
    },
    setGroupCheckoutError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearGroupPending3ds(state) {
      state.pending3dsClientSecret = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(createGroupRegistrationCheckout.pending, (s) => {
      s.loadingCheckout = true;
      s.error = null;
    });
    b.addCase(createGroupRegistrationCheckout.fulfilled, (s, a) => {
      s.loadingCheckout = false;
      s.checkout = a.payload;
      s.step = "checkout";
    });
    b.addCase(createGroupRegistrationCheckout.rejected, (s, a) => {
      s.loadingCheckout = false;
      const p = a.payload;
      s.error = typeof p === "string" ? p : p?.message ?? "Checkout failed";
    });
    b.addCase(confirmGroupRegistration.pending, (s) => {
      s.loadingConfirm = true;
      s.error = null;
    });
    b.addCase(confirmGroupRegistration.fulfilled, (s, a) => {
      s.loadingConfirm = false;
      s.confirmResult = a.payload;
      s.step = "result";
      s.paymentFailed = !a.payload.success;
      s.failureMessage = a.payload.error ?? null;
      s.pending3dsClientSecret = a.payload.requiresAction
        ? a.payload.clientSecret ?? null
        : null;
    });
    b.addCase(confirmGroupRegistration.rejected, (s, a) => {
      s.loadingConfirm = false;
      const p = a.payload;
      s.paymentFailed = true;
      s.failureMessage = p?.message ?? "Payment failed";
      if (p?.requiresAction && p.clientSecret) {
        s.pending3dsClientSecret = p.clientSecret;
      }
    });
  },
});

export const {
  openGroupRegistrationWizard,
  closeGroupRegistrationWizard,
  setGroupWizardStep,
  setGroupParticipantCount,
  setGroupIncludeSelf,
  initGroupParticipants,
  setCurrentParticipantIndex,
  updateCurrentParticipant,
  setGroupDiscountCode,
  setGroupWaiverForCurrent,
  setGroupCheckoutError,
  clearGroupPending3ds,
} = slice.actions;

export default slice.reducer;
