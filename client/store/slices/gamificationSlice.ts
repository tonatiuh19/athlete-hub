import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  AchievementRow,
  AchievementsListResponse,
  GamificationResponse,
} from "@shared/api";

interface GamificationState {
  profile: GamificationResponse | null;
  achievements: AchievementRow[];
  loading: boolean;
  loadingAchievements: boolean;
  error: string | null;
}

const initialState: GamificationState = {
  profile: null,
  achievements: [],
  loading: false,
  loadingAchievements: false,
  error: null,
};

function rejectMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } };
  return err?.response?.data?.error || fallback;
}

export const fetchGamification = createAsyncThunk<
  GamificationResponse,
  void,
  { rejectValue: string }
>("gamification/profile", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<GamificationResponse>("/athlete/gamification");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load gamification"));
  }
});

export const fetchAchievements = createAsyncThunk<
  AchievementRow[],
  void,
  { rejectValue: string }
>("gamification/achievements", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<AchievementsListResponse>("/athlete/achievements");
    return data.achievements;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load achievements"));
  }
});

const slice = createSlice({
  name: "gamification",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchGamification.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchGamification.fulfilled, (s, a) => {
      s.loading = false;
      s.profile = a.payload;
    });
    b.addCase(fetchGamification.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload || "Error";
    });

    b.addCase(fetchAchievements.pending, (s) => {
      s.loadingAchievements = true;
    });
    b.addCase(fetchAchievements.fulfilled, (s, a) => {
      s.loadingAchievements = false;
      s.achievements = a.payload;
    });
    b.addCase(fetchAchievements.rejected, (s, a) => {
      s.loadingAchievements = false;
      s.error = a.payload || "Error";
    });
  },
});

export default slice.reducer;
