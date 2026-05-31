import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import type { AppVersionResponse } from "@shared/api";

interface AppConfigState {
  version: string | null;
  loadingVersion: boolean;
  versionError: string | null;
}

const buildVersion = import.meta.env.VITE_APP_VERSION?.trim() || null;

const initialState: AppConfigState = {
  version: buildVersion,
  loadingVersion: false,
  versionError: null,
};

export const fetchAppVersion = createAsyncThunk(
  "appConfig/fetchAppVersion",
  async () => {
    const { data } = await axios.get<AppVersionResponse>("/api/config/app-version");
    return data.version;
  },
);

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppVersion.pending, (state) => {
        state.loadingVersion = true;
        state.versionError = null;
      })
      .addCase(fetchAppVersion.fulfilled, (state, action) => {
        state.loadingVersion = false;
        if (action.payload) {
          state.version = action.payload;
        }
      })
      .addCase(fetchAppVersion.rejected, (state, action) => {
        state.loadingVersion = false;
        state.versionError = action.error.message ?? "Failed to load version";
      });
  },
});

export default appConfigSlice.reducer;
