import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api, { getStaffToken, setStaffToken } from "@/lib/api";
import { getStoredLocale, normalizeLocale } from "@shared/i18n";
import type { StaffRole, StaffUser } from "@shared/api";

const STAFF_ROLE_KEY = "athlete_hub_staff_role";

function getStoredStaffRole(): StaffRole | null {
  const r = localStorage.getItem(STAFF_ROLE_KEY);
  return r === "admin" || r === "organizer" ? r : null;
}

function setStoredStaffRole(r: StaffRole | null) {
  if (r) localStorage.setItem(STAFF_ROLE_KEY, r);
  else localStorage.removeItem(STAFF_ROLE_KEY);
}

interface StaffAuthState {
  user: StaffUser | null;
  role: StaffRole | null;
  token: string | null;
  loading: boolean;
  requestingOtp: boolean;
  verifyingOtp: boolean;
  syncingClerk: boolean;
  error: string | null;
  otpSentTo: string | null;
}

const initialState: StaffAuthState = {
  user: null,
  role: getStoredStaffRole(),
  token: getStaffToken(),
  loading: false,
  requestingOtp: false,
  verifyingOtp: false,
  syncingClerk: false,
  error: null,
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
        ? { type: "admin", ...data.admin }
        : { type: "organizer", ...data.member };
    return { token: data.token, user, role };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Invalid code");
  }
});

export const syncStaffClerk = createAsyncThunk<
  { token: string; user: StaffUser; role: StaffRole },
  { sessionToken: string },
  { rejectValue: string }
>("staffAuth/syncClerk", async ({ sessionToken }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/auth/clerk/staff", { sessionToken });
    setStaffToken(data.token);
    return { token: data.token, user: data.user, role: data.role };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Social login failed");
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
    const user: StaffUser =
      role === "admin"
        ? {
            type: "admin",
            id: data.admin.id,
            email: data.admin.email,
            firstName: data.admin.firstName ?? data.admin.first_name,
            lastName: data.admin.lastName ?? data.admin.last_name,
            role: data.admin.role,
          }
        : {
            type: "organizer",
            id: data.member.id,
            email: data.member.email,
            firstName: data.member.firstName ?? data.member.first_name,
            lastName: data.member.lastName ?? data.member.last_name,
            role: data.member.role,
            organizerId: data.member.organizerId ?? data.member.organizer_id,
          };
    return { user, role };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return rejectWithValue(err?.response?.data?.error || "Unauthorized");
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

    b.addCase(syncStaffClerk.pending, (s) => {
      s.syncingClerk = true;
      s.error = null;
    });
    b.addCase(syncStaffClerk.fulfilled, (s, a) => {
      s.syncingClerk = false;
      s.token = a.payload.token;
      s.user = a.payload.user;
      s.role = a.payload.role;
      setStoredStaffRole(a.payload.role);
    });
    b.addCase(syncStaffClerk.rejected, (s, a) => {
      s.syncingClerk = false;
      s.error = a.payload || "Error";
    });

    b.addCase(fetchStaffMe.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchStaffMe.fulfilled, (s, a) => {
      s.loading = false;
      s.user = a.payload.user;
      s.role = a.payload.role;
    });
    b.addCase(fetchStaffMe.rejected, (s) => {
      s.loading = false;
      s.token = null;
      s.user = null;
      s.role = null;
      setStaffToken(null);
      setStoredStaffRole(null);
    });

    b.addCase(staffLogout.fulfilled, (s) => {
      s.token = null;
      s.user = null;
      s.role = null;
      s.otpSentTo = null;
      setStoredStaffRole(null);
    });
  },
});

export const { clearStaffError } = slice.actions;
export default slice.reducer;
