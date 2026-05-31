import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api, { getAthleteToken, setAthleteToken } from "@/lib/api";
import { getStoredLocale, normalizeLocale } from "@shared/i18n";
import type { AthleteUser } from "@shared/api";
import i18n from "@/i18n";

interface AthleteAuthState {
  user: AthleteUser | null;
  token: string | null;
  loading: boolean;
  requestingOtp: boolean;
  verifyingOtp: boolean;
  syncingClerk: boolean;
  error: string | null;
  otpSentTo: string | null;
  otpChannel: "email" | "sms";
}

const initialState: AthleteAuthState = {
  user: null,
  token: getAthleteToken(),
  loading: false,
  requestingOtp: false,
  verifyingOtp: false,
  syncingClerk: false,
  error: null,
  otpSentTo: null,
  otpChannel: "email",
};

export const requestAthleteOtp = createAsyncThunk<
  { destination: string; channel: "email" | "sms" },
  { email?: string; phone?: string; channel?: "email" | "sms"; purpose?: string },
  { rejectValue: string }
>("athleteAuth/requestOtp", async (payload, { rejectWithValue }) => {
  try {
    const channel = payload.channel || (payload.phone ? "sms" : "email");
    await api.post("/auth/athlete/request-otp", {
      ...payload,
      channel,
      locale: getStoredLocale() || normalizeLocale(undefined),
    });
    return {
      destination: payload.email || payload.phone || "",
      channel,
    };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "No pudimos enviar el código. Intenta de nuevo.",
    );
  }
});

export const verifyAthleteOtp = createAsyncThunk<
  { token: string; athlete: AthleteUser },
  { email?: string; phone?: string; code: string; channel?: "email" | "sms" },
  { rejectValue: string }
>("athleteAuth/verifyOtp", async (payload, { rejectWithValue }) => {
  try {
    const channel = payload.channel || (payload.phone ? "sms" : "email");
    const { data } = await api.post("/auth/athlete/verify-otp", { ...payload, channel });
    setAthleteToken(data.token);
    return { token: data.token, athlete: data.athlete };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Código inválido o expirado");
  }
});

export const syncAthleteClerk = createAsyncThunk<
  { token: string; athlete: AthleteUser },
  { sessionToken: string },
  { rejectValue: string }
>("athleteAuth/syncClerk", async ({ sessionToken }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/auth/clerk/athlete", { sessionToken });
    setAthleteToken(data.token);
    return { token: data.token, athlete: data.athlete };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Error al vincular cuenta social");
  }
});

export const fetchAthleteMe = createAsyncThunk<{ athlete: AthleteUser }>(
  "athleteAuth/me",
  async () => {
    const { data } = await api.get("/athlete/me");
    const a = data.athlete as Record<string, unknown>;
    return {
      athlete: {
        id: a.id as number,
        email: a.email as string | undefined,
        phone: a.phone as string | undefined,
        firstName: (a.first_name ?? a.firstName) as string,
        lastName: (a.last_name ?? a.lastName) as string,
        avatarUrl: (a.avatar_url ?? a.avatarUrl) as string | undefined,
        preferredLanguage: (a.preferred_language ??
          a.preferredLanguage) as string | undefined,
      },
    };
  },
);

export const updateAthleteLanguage = createAsyncThunk<
  { preferred_language: string },
  string,
  { rejectValue: string }
>("athleteAuth/updateLanguage", async (locale, { rejectWithValue }) => {
  try {
    const { data } = await api.patch("/athlete/preferences", {
      preferred_language: normalizeLocale(locale),
    });
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Error");
  }
});

export const athleteLogout = createAsyncThunk("athleteAuth/logout", async () => {
  try {
    await api.post("/auth/logout", {}, { headers: { "X-Auth-Realm": "athlete" } });
  } catch {
    /* ignore */
  }
  setAthleteToken(null);
});

const slice = createSlice({
  name: "athleteAuth",
  initialState,
  reducers: {
    clearAthleteError(state) {
      state.error = null;
    },
    setAthleteUserLocal(state, action: PayloadAction<AthleteUser | null>) {
      state.user = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(requestAthleteOtp.pending, (s) => {
      s.requestingOtp = true;
      s.error = null;
    });
    b.addCase(requestAthleteOtp.fulfilled, (s, a) => {
      s.requestingOtp = false;
      s.otpSentTo = a.payload.destination;
      s.otpChannel = a.payload.channel;
    });
    b.addCase(requestAthleteOtp.rejected, (s, a) => {
      s.requestingOtp = false;
      s.error = a.payload || "Error";
    });

    b.addCase(verifyAthleteOtp.pending, (s) => {
      s.verifyingOtp = true;
      s.error = null;
    });
    b.addCase(verifyAthleteOtp.fulfilled, (s, a) => {
      s.verifyingOtp = false;
      s.token = a.payload.token;
      s.user = a.payload.athlete;
    });
    b.addCase(verifyAthleteOtp.rejected, (s, a) => {
      s.verifyingOtp = false;
      s.error = a.payload || "Error";
    });

    b.addCase(syncAthleteClerk.pending, (s) => {
      s.syncingClerk = true;
      s.error = null;
    });
    b.addCase(syncAthleteClerk.fulfilled, (s, a) => {
      s.syncingClerk = false;
      s.token = a.payload.token;
      s.user = a.payload.athlete;
    });
    b.addCase(syncAthleteClerk.rejected, (s, a) => {
      s.syncingClerk = false;
      s.error = a.payload || "Error";
    });

    b.addCase(fetchAthleteMe.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchAthleteMe.fulfilled, (s, a) => {
      s.loading = false;
      s.user = a.payload.athlete;
      if (a.payload.athlete.preferredLanguage) {
        void i18n.changeLanguage(
          normalizeLocale(a.payload.athlete.preferredLanguage),
        );
      }
    });
    b.addCase(fetchAthleteMe.rejected, (s) => {
      s.loading = false;
      s.token = null;
      s.user = null;
      setAthleteToken(null);
    });

    b.addCase(athleteLogout.fulfilled, (s) => {
      s.token = null;
      s.user = null;
      s.otpSentTo = null;
    });
  },
});

export const { clearAthleteError, setAthleteUserLocal } = slice.actions;
export default slice.reducer;
