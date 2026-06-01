import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api, { getStaffToken, setStaffToken } from "@/lib/api";
import { getStoredLocale, normalizeLocale } from "@shared/i18n";
import type { StaffProfileUpdateRequest, StaffRole, StaffUser } from "@shared/api";
import i18n from "@/i18n";

const STAFF_ROLE_KEY = "athlete_hub_staff_role";

function getStoredStaffRole(): StaffRole | null {
  const r = localStorage.getItem(STAFF_ROLE_KEY);
  return r === "admin" || r === "organizer" ? r : null;
}

function setStoredStaffRole(r: StaffRole | null) {
  if (r) localStorage.setItem(STAFF_ROLE_KEY, r);
  else localStorage.removeItem(STAFF_ROLE_KEY);
}

function mapStaffUser(role: StaffRole, data: Record<string, unknown>): StaffUser {
  const source = role === "admin" ? (data.admin as Record<string, unknown>) : (data.member as Record<string, unknown>);
  const base = {
    id: source.id as number,
    email: source.email as string,
    firstName: (source.firstName ?? source.first_name) as string,
    lastName: (source.lastName ?? source.last_name) as string,
    role: source.role as string,
    phone: (source.phone as string | null | undefined) ?? null,
    avatarUrl: (source.avatarUrl ?? source.avatar_url ?? null) as string | null,
    preferredLanguage: (source.preferredLanguage ?? source.preferred_language) as string | undefined,
    lastLoginAt: (source.lastLoginAt ?? source.last_login_at ?? null) as string | null,
    createdAt: (source.createdAt ?? source.created_at) as string | undefined,
  };
  if (role === "admin") {
    return { type: "admin", ...base };
  }
  return {
    type: "organizer",
    ...base,
    organizerId: (source.organizerId ?? source.organizer_id) as number,
    organizerName: (source.organizerName ?? source.organizer_name) as string | undefined,
  };
}

interface StaffAuthState {
  user: StaffUser | null;
  role: StaffRole | null;
  token: string | null;
  loading: boolean;
  requestingOtp: boolean;
  verifyingOtp: boolean;
  updatingProfile: boolean;
  uploadingAvatar: boolean;
  error: string | null;
  profileError: string | null;
  otpSentTo: string | null;
}

const initialState: StaffAuthState = {
  user: null,
  role: getStoredStaffRole(),
  token: getStaffToken(),
  loading: false,
  requestingOtp: false,
  verifyingOtp: false,
  updatingProfile: false,
  uploadingAvatar: false,
  error: null,
  profileError: null,
  otpSentTo: null,
};

export const requestStaffOtp = createAsyncThunk<
  { email: string; role: StaffRole },
  { email: string },
  { rejectValue: string }
>("staffAuth/requestOtp", async ({ email }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/auth/staff/request-otp", {
      email,
      locale: getStoredLocale() || normalizeLocale(undefined),
    });
    return { email, role: data.role as StaffRole };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(
      err?.response?.data?.error || "Could not send verification code.",
    );
  }
});

export const verifyStaffOtp = createAsyncThunk<
  { token: string; user: StaffUser; role: StaffRole },
  { email: string; code: string },
  { rejectValue: string }
>("staffAuth/verifyOtp", async ({ email, code }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/auth/staff/verify-otp", { email, code });
    setStaffToken(data.token);
    const role = data.role as StaffRole;
    const user: StaffUser =
      role === "admin"
        ? {
            type: "admin",
            id: data.admin.id,
            email: data.admin.email,
            firstName: data.admin.firstName,
            lastName: data.admin.lastName,
            role: data.admin.role,
          }
        : {
            type: "organizer",
            id: data.member.id,
            email: data.member.email,
            firstName: data.member.firstName,
            lastName: data.member.lastName,
            role: data.member.role,
            organizerId: data.member.organizerId,
          };
    return { token: data.token, user, role };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Invalid code");
  }
});

export const fetchStaffMe = createAsyncThunk<
  { user: StaffUser; role: StaffRole },
  StaffRole,
  { rejectValue: string }
>("staffAuth/me", async (role, { rejectWithValue }) => {
  try {
    const path = role === "admin" ? "/auth/admin/me" : "/auth/organizer/me";
    const { data } = await api.get(path);
    return { user: mapStaffUser(role, data as Record<string, unknown>), role };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Unauthorized");
  }
});

export const updateStaffProfile = createAsyncThunk<
  StaffUser,
  StaffProfileUpdateRequest & { role: StaffRole },
  { rejectValue: string }
>("staffAuth/updateProfile", async ({ role, ...body }, { rejectWithValue }) => {
  try {
    const path = role === "admin" ? "/auth/admin/me" : "/auth/organizer/me";
    const { data } = await api.patch(path, body);
    return mapStaffUser(role, data as Record<string, unknown>);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Could not update profile");
  }
});

export const updateStaffLanguage = createAsyncThunk<
  { preferred_language: string; role: StaffRole },
  { locale: string; role: StaffRole },
  { rejectValue: string }
>("staffAuth/updateLanguage", async ({ locale, role }, { rejectWithValue }) => {
  try {
    const normalized = normalizeLocale(locale);
    const path = role === "admin" ? "/auth/admin/me" : "/auth/organizer/me";
    await api.patch(path, { preferred_language: normalized });
    return { preferred_language: normalized, role };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Error");
  }
});

export const uploadStaffAvatar = createAsyncThunk<
  string,
  { image: string; role: StaffRole },
  { rejectValue: string }
>("staffAuth/uploadAvatar", async ({ image, role }, { rejectWithValue }) => {
  try {
    const path = role === "admin" ? "/auth/admin/avatar" : "/auth/organizer/avatar";
    const { data } = await api.post(path, { image });
    return (data.avatarUrl ?? data.avatar_url) as string;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Could not upload photo");
  }
});

export const removeStaffAvatar = createAsyncThunk<
  null,
  StaffRole,
  { rejectValue: string }
>("staffAuth/removeAvatar", async (role, { rejectWithValue }) => {
  try {
    const path = role === "admin" ? "/auth/admin/avatar" : "/auth/organizer/avatar";
    await api.delete(path);
    return null;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Could not remove photo");
  }
});

export const staffLogout = createAsyncThunk("staffAuth/logout", async () => {
  try {
    await api.post("/auth/logout", {}, { headers: { "X-Auth-Realm": "staff" } });
  } catch {
    /* ignore */
  }
  setStaffToken(null);
});

const slice = createSlice({
  name: "staffAuth",
  initialState,
  reducers: {
    clearStaffError(state) {
      state.error = null;
      state.profileError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(requestStaffOtp.pending, (s) => {
      s.requestingOtp = true;
      s.error = null;
    });
    b.addCase(requestStaffOtp.fulfilled, (s, a) => {
      s.requestingOtp = false;
      s.otpSentTo = a.payload.email;
      s.role = a.payload.role;
      setStoredStaffRole(a.payload.role);
    });
    b.addCase(requestStaffOtp.rejected, (s, a) => {
      s.requestingOtp = false;
      s.error = a.payload || "Error";
    });

    b.addCase(verifyStaffOtp.pending, (s) => {
      s.verifyingOtp = true;
      s.error = null;
    });
    b.addCase(verifyStaffOtp.fulfilled, (s, a) => {
      s.verifyingOtp = false;
      s.token = a.payload.token;
      s.user = a.payload.user;
      s.role = a.payload.role;
      setStoredStaffRole(a.payload.role);
    });
    b.addCase(verifyStaffOtp.rejected, (s, a) => {
      s.verifyingOtp = false;
      s.error = a.payload || "Error";
    });

    b.addCase(fetchStaffMe.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchStaffMe.fulfilled, (s, a) => {
      s.loading = false;
      s.user = a.payload.user;
      s.role = a.payload.role;
      if (a.payload.user.preferredLanguage) {
        void i18n.changeLanguage(normalizeLocale(a.payload.user.preferredLanguage));
      }
    });
    b.addCase(fetchStaffMe.rejected, (s) => {
      s.loading = false;
      s.token = null;
      s.user = null;
      s.role = null;
      setStaffToken(null);
      setStoredStaffRole(null);
    });

    b.addCase(updateStaffProfile.pending, (s) => {
      s.updatingProfile = true;
      s.profileError = null;
    });
    b.addCase(updateStaffProfile.fulfilled, (s, a) => {
      s.updatingProfile = false;
      s.user = a.payload;
      if (a.payload.preferredLanguage) {
        void i18n.changeLanguage(normalizeLocale(a.payload.preferredLanguage));
      }
    });
    b.addCase(updateStaffProfile.rejected, (s, a) => {
      s.updatingProfile = false;
      s.profileError = a.payload || "Error";
    });

    b.addCase(uploadStaffAvatar.pending, (s) => {
      s.uploadingAvatar = true;
      s.profileError = null;
    });
    b.addCase(uploadStaffAvatar.fulfilled, (s, a) => {
      s.uploadingAvatar = false;
      if (s.user) s.user.avatarUrl = a.payload;
    });
    b.addCase(uploadStaffAvatar.rejected, (s, a) => {
      s.uploadingAvatar = false;
      s.profileError = a.payload || "Error";
    });

    b.addCase(removeStaffAvatar.fulfilled, (s) => {
      s.uploadingAvatar = false;
      if (s.user) s.user.avatarUrl = null;
    });

    b.addCase(staffLogout.fulfilled, (s) => {
      s.token = null;
      s.user = null;
      s.role = null;
      s.otpSentTo = null;
      setStoredStaffRole(null);
    });

    b.addCase(updateStaffLanguage.fulfilled, (s, a) => {
      if (s.user) {
        s.user.preferredLanguage = a.payload.preferred_language;
      }
    });
  },
});

export const { clearStaffError } = slice.actions;
export default slice.reducer;
