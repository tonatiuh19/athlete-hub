import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type { SitePublicProfile, SitePublicProfileResponse } from "@shared/api";
import { DEFAULT_SITE_PUBLIC_PROFILE } from "@shared/siteLegal";

interface SiteAdminState {
  profile: SitePublicProfile;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  loaded: boolean;
}

const initialState: SiteAdminState = {
  profile: DEFAULT_SITE_PUBLIC_PROFILE,
  loading: false,
  saving: false,
  error: null,
  saveError: null,
  loaded: false,
};

export const fetchAdminSiteProfile = createAsyncThunk<
  SitePublicProfile,
  void,
  { rejectValue: string }
>("siteAdmin/fetchProfile", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<SitePublicProfileResponse>("/admin/site-profile");
    return data.profile;
  } catch {
    return rejectWithValue("staffPortal.siteSettings.errors.loadFailed");
  }
});

export const updateAdminSiteProfile = createAsyncThunk<
  SitePublicProfile,
  SitePublicProfile,
  { rejectValue: string }
>("siteAdmin/updateProfile", async (profile, { rejectWithValue }) => {
  try {
    const { data } = await api.patch<{ ok: boolean; profile: SitePublicProfile }>(
      "/admin/site-profile",
      profile,
    );
    return data.profile;
  } catch {
    return rejectWithValue("staffPortal.siteSettings.errors.saveFailed");
  }
});

const siteAdminSlice = createSlice({
  name: "siteAdmin",
  initialState,
  reducers: {
    clearSiteAdminErrors(state) {
      state.error = null;
      state.saveError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchAdminSiteProfile.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchAdminSiteProfile.fulfilled, (s, a) => {
      s.loading = false;
      s.loaded = true;
      s.profile = a.payload;
    });
    b.addCase(fetchAdminSiteProfile.rejected, (s, a) => {
      s.loading = false;
      s.loaded = true;
      s.error = a.payload ?? "staffPortal.siteSettings.errors.loadFailed";
    });
    b.addCase(updateAdminSiteProfile.pending, (s) => {
      s.saving = true;
      s.saveError = null;
    });
    b.addCase(updateAdminSiteProfile.fulfilled, (s, a) => {
      s.saving = false;
      s.profile = a.payload;
    });
    b.addCase(updateAdminSiteProfile.rejected, (s, a) => {
      s.saving = false;
      s.saveError = a.payload ?? "staffPortal.siteSettings.errors.saveFailed";
    });
  },
});

export const { clearSiteAdminErrors } = siteAdminSlice.actions;
export default siteAdminSlice.reducer;
