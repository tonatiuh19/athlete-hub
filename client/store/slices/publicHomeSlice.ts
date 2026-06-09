import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type { PublicHomeDataResponse } from "@shared/api";
import { extractApiErrorMessage } from "@/utils/apiError";

interface PublicHomeState {
  data: PublicHomeDataResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: PublicHomeState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchPublicHome = createAsyncThunk<
  PublicHomeDataResponse,
  void,
  { rejectValue: string }
>("publicHome/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PublicHomeDataResponse>("/public/home");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(
      extractApiErrorMessage(e, "Could not load home data"),
    );
  }
});

const slice = createSlice({
  name: "publicHome",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchPublicHome.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchPublicHome.fulfilled, (s, a) => {
      s.loading = false;
      s.data = a.payload;
    });
    b.addCase(fetchPublicHome.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload || "Error";
    });
  },
});

export default slice.reducer;
