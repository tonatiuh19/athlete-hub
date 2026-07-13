import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type { SitePublicProfile, SitePublicProfileResponse } from "@shared/api";
import { DEFAULT_SITE_PUBLIC_PROFILE } from "@shared/siteLegal";
import { updateAdminSiteProfile } from "./siteAdminSlice";

interface PublicSiteState {
  profile: SitePublicProfile;
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

const initialState: PublicSiteState = {
  profile: DEFAULT_SITE_PUBLIC_PROFILE,
  loading: false,
  error: null,
  loaded: false,
};

export const fetchPublicSiteProfile = createAsyncThunk<
  SitePublicProfile,
  void
>("publicSite/fetchProfile", async () => {
  try {
    const { data } = await api.get<SitePublicProfileResponse>("/public/site-profile");
    return data.profile;
  } catch {
    // Server also falls back to defaults; keep UI usable offline or before migration.
    return DEFAULT_SITE_PUBLIC_PROFILE;
  }
}, {
  condition: (_, { getState }) => {
    const { loading, loaded } = (getState() as { publicSite: PublicSiteState }).publicSite;
    return !loading && !loaded;
  },
});

const publicSiteSlice = createSlice({
  name: "publicSite",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchPublicSiteProfile.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchPublicSiteProfile.fulfilled, (s, a) => {
      s.loading = false;
      s.loaded = true;
      s.error = null;
      s.profile = a.payload;
    });
    b.addCase(fetchPublicSiteProfile.rejected, (s) => {
      s.loading = false;
      s.loaded = true;
    });
    b.addCase(updateAdminSiteProfile.fulfilled, (s, a) => {
      s.profile = a.payload;
    });
  },
});

export default publicSiteSlice.reducer;
