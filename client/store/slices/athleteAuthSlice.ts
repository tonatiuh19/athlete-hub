import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api, { getAthleteToken, setAthleteToken } from "@/lib/api";
import { getStoredLocale, normalizeLocale } from "@shared/i18n";
import type {
  AthleteAuthSessionResponse,
  AthleteCheckEmailResponse,
  AthleteProfileUpdateRequest,
  AthleteUser,
} from "@shared/api";
import { mapAthleteApiRow } from "@shared/api";
import i18n from "@/i18n";

function athleteAuthRejectMessage(e: unknown, fallback: string): string {
  const err = e as {
    response?: {
      data?: { error?: string; code?: string; retryAfterSec?: number };
    };
  };
  const data = err?.response?.data;
  if (data?.code === "rate_limited") {
    return i18n.t("auth.rateLimited", {
      seconds: data.retryAfterSec ?? 60,
    });
  }
  return data?.error || fallback;
}

interface AthleteAuthState {
  user: AthleteUser | null;
  token: string | null;
  loading: boolean;
  updatingProfile: boolean;
  uploadingAvatar: boolean;
  checkingEmail: boolean;
  signingIn: boolean;
  registering: boolean;
  resettingPassword: boolean;
  syncingClerk: boolean;
  error: string | null;
  passwordResetSent: boolean;
}

const initialState: AthleteAuthState = {
  user: null,
  token: getAthleteToken(),
  loading: false,
  updatingProfile: false,
  uploadingAvatar: false,
  checkingEmail: false,
  signingIn: false,
  registering: false,
  resettingPassword: false,
  syncingClerk: false,
  error: null,
  passwordResetSent: false,
};

export const checkAthleteEmail = createAsyncThunk<
  { exists: boolean; hasPassword: boolean; hasSocialLogin: boolean },
  { email: string },
  { rejectValue: string }
>("athleteAuth/checkEmail", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<AthleteCheckEmailResponse>(
      "/auth/athlete/check-email",
      { email: payload.email.trim().toLowerCase() },
    );
    return {
      exists: data.exists,
      hasPassword: data.hasPassword ?? false,
      hasSocialLogin: data.hasSocialLogin ?? false,
    };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(athleteAuthRejectMessage(e, "Could not verify email"));
  }
});

export const loginAthlete = createAsyncThunk<
  AthleteAuthSessionResponse,
  { email: string; password: string },
  { rejectValue: string }
>("athleteAuth/login", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<AthleteAuthSessionResponse>("/auth/athlete/login", {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      locale: getStoredLocale() || normalizeLocale(undefined),
    });
    setAthleteToken(data.token);
    return data;
  } catch (e: unknown) {
    const err = e as {
      response?: { data?: { error?: string; code?: string } };
    };
    return rejectWithValue(athleteAuthRejectMessage(e, "Invalid email or password"));
  }
});

export const registerAthlete = createAsyncThunk<
  AthleteAuthSessionResponse,
  {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    dateOfBirth: string;
    gender?: string | null;
  },
  { rejectValue: string }
>("athleteAuth/register", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<AthleteAuthSessionResponse>("/auth/athlete/register", {
      email: payload.email.trim().toLowerCase(),
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      password: payload.password,
      dateOfBirth: payload.dateOfBirth,
      gender: payload.gender || null,
      locale: getStoredLocale() || normalizeLocale(undefined),
    });
    setAthleteToken(data.token);
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(athleteAuthRejectMessage(e, "Could not create account"));
  }
});

export const forgotAthletePassword = createAsyncThunk<
  void,
  { email: string },
  { rejectValue: string }
>("athleteAuth/forgotPassword", async (payload, { rejectWithValue }) => {
  try {
    await api.post("/auth/athlete/forgot-password", {
      email: payload.email.trim().toLowerCase(),
      locale: getStoredLocale() || normalizeLocale(undefined),
    });
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(athleteAuthRejectMessage(e, "Could not send reset email"));
  }
});

export const resetAthletePassword = createAsyncThunk<
  AthleteAuthSessionResponse,
  { email: string; code: string; password: string },
  { rejectValue: string }
>("athleteAuth/resetPassword", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post<AthleteAuthSessionResponse>(
      "/auth/athlete/reset-password",
      payload,
    );
    if (data.token) setAthleteToken(data.token);
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(athleteAuthRejectMessage(e, "Invalid or expired reset code"));
  }
});

export const syncAthleteClerk = createAsyncThunk<
  AthleteAuthSessionResponse,
  { sessionToken: string },
  { rejectValue: string }
>("athleteAuth/syncClerk", async ({ sessionToken }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<AthleteAuthSessionResponse>("/auth/clerk/athlete", {
      sessionToken,
      locale: getStoredLocale() || normalizeLocale(undefined),
    });
    setAthleteToken(data.token);
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not complete social sign-in",
    );
  }
});

export const fetchAthleteMe = createAsyncThunk<{ athlete: AthleteUser }>(
  "athleteAuth/me",
  async () => {
    const { data } = await api.get("/athlete/me");
    return {
      athlete: mapAthleteApiRow(data.athlete as Record<string, unknown>),
    };
  },
);

export const updateAthleteProfile = createAsyncThunk<
  { athlete: AthleteUser },
  AthleteProfileUpdateRequest,
  { rejectValue: string }
>("athleteAuth/updateProfile", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.patch("/athlete/me", payload);
    return {
      athlete: mapAthleteApiRow(data.athlete as Record<string, unknown>),
    };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not update profile",
    );
  }
});

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

export const uploadAthleteAvatar = createAsyncThunk<
  { avatar_url: string },
  { image: string },
  { rejectValue: string }
>("athleteAuth/uploadAvatar", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/athlete/avatar", payload);
    return { avatar_url: data.avatar_url as string };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not upload avatar",
    );
  }
});

export const removeAthleteAvatar = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>("athleteAuth/removeAvatar", async (_, { rejectWithValue }) => {
  try {
    await api.delete("/athlete/avatar");
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not remove avatar",
    );
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
    clearPasswordResetSent(state) {
      state.passwordResetSent = false;
    },
    setAthleteUserLocal(state, action: PayloadAction<AthleteUser | null>) {
      state.user = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(checkAthleteEmail.pending, (s) => {
      s.checkingEmail = true;
      s.error = null;
    });
    b.addCase(checkAthleteEmail.fulfilled, (s) => {
      s.checkingEmail = false;
    });
    b.addCase(checkAthleteEmail.rejected, (s, a) => {
      s.checkingEmail = false;
      s.error = a.payload || "Error";
    });

    b.addCase(loginAthlete.pending, (s) => {
      s.signingIn = true;
      s.error = null;
    });
    b.addCase(loginAthlete.fulfilled, (s, a) => {
      s.signingIn = false;
      s.token = a.payload.token;
      s.user = a.payload.athlete;
    });
    b.addCase(loginAthlete.rejected, (s, a) => {
      s.signingIn = false;
      s.error = a.payload || "Error";
    });

    b.addCase(registerAthlete.pending, (s) => {
      s.registering = true;
      s.error = null;
    });
    b.addCase(registerAthlete.fulfilled, (s, a) => {
      s.registering = false;
      s.token = a.payload.token;
      s.user = a.payload.athlete;
    });
    b.addCase(registerAthlete.rejected, (s, a) => {
      s.registering = false;
      s.error = a.payload || "Error";
    });

    b.addCase(forgotAthletePassword.pending, (s) => {
      s.resettingPassword = true;
      s.error = null;
      s.passwordResetSent = false;
    });
    b.addCase(forgotAthletePassword.fulfilled, (s) => {
      s.resettingPassword = false;
      s.passwordResetSent = true;
    });
    b.addCase(forgotAthletePassword.rejected, (s, a) => {
      s.resettingPassword = false;
      s.error = a.payload || "Error";
    });

    b.addCase(resetAthletePassword.pending, (s) => {
      s.registering = true;
      s.error = null;
    });
    b.addCase(resetAthletePassword.fulfilled, (s, a) => {
      s.registering = false;
      if (a.payload.token) {
        s.token = a.payload.token;
        s.user = a.payload.athlete;
      }
    });
    b.addCase(resetAthletePassword.rejected, (s, a) => {
      s.registering = false;
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

    b.addCase(updateAthleteProfile.pending, (s) => {
      s.updatingProfile = true;
      s.error = null;
    });
    b.addCase(updateAthleteProfile.fulfilled, (s, a) => {
      s.updatingProfile = false;
      s.user = a.payload.athlete;
    });
    b.addCase(updateAthleteProfile.rejected, (s, a) => {
      s.updatingProfile = false;
      s.error = a.payload || "Error";
    });

    b.addCase(updateAthleteLanguage.fulfilled, (s, a) => {
      if (s.user) {
        s.user.preferredLanguage = a.payload.preferred_language;
      }
    });

    b.addCase(uploadAthleteAvatar.pending, (s) => {
      s.uploadingAvatar = true;
      s.error = null;
    });
    b.addCase(uploadAthleteAvatar.fulfilled, (s, a) => {
      s.uploadingAvatar = false;
      if (s.user) {
        s.user.avatarUrl = a.payload.avatar_url;
      }
    });
    b.addCase(uploadAthleteAvatar.rejected, (s, a) => {
      s.uploadingAvatar = false;
      s.error = a.payload || "Error";
    });

    b.addCase(removeAthleteAvatar.pending, (s) => {
      s.uploadingAvatar = true;
      s.error = null;
    });
    b.addCase(removeAthleteAvatar.fulfilled, (s) => {
      s.uploadingAvatar = false;
      if (s.user) {
        s.user.avatarUrl = undefined;
      }
    });
    b.addCase(removeAthleteAvatar.rejected, (s, a) => {
      s.uploadingAvatar = false;
      s.error = a.payload || "Error";
    });

    b.addCase(athleteLogout.fulfilled, (s) => {
      s.token = null;
      s.user = null;
    });
  },
});

export const { clearAthleteError, clearPasswordResetSent, setAthleteUserLocal } =
  slice.actions;
export default slice.reducer;
