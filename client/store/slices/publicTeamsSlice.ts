import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  PublicTeamDetailResponse,
  PublicTeamListItem,
  PublicTeamsListResponse,
} from "@shared/api";
import { extractApiErrorMessage } from "@/utils/apiError";

export type PublicTeamsSort = "members" | "newest";

interface PublicTeamsState {
  teams: PublicTeamListItem[];
  total: number;
  page: number;
  limit: number;
  query: string;
  sort: PublicTeamsSort;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  detail: PublicTeamDetailResponse | null;
  loadingDetail: boolean;
  detailError: string | null;
}

const initialState: PublicTeamsState = {
  teams: [],
  total: 0,
  page: 1,
  limit: 12,
  query: "",
  sort: "members",
  loading: false,
  loadingMore: false,
  error: null,
  detail: null,
  loadingDetail: false,
  detailError: null,
};

export const fetchPublicTeams = createAsyncThunk<
  PublicTeamsListResponse,
  { q?: string; page?: number; sort?: PublicTeamsSort; append?: boolean },
  { rejectValue: string }
>("publicTeams/fetch", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PublicTeamsListResponse>("/public/teams", {
      params: {
        q: params.q?.trim() || undefined,
        page: params.page ?? 1,
        sort: params.sort ?? "members",
        limit: 12,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not load communities"));
  }
});

export const fetchPublicTeamDetail = createAsyncThunk<
  PublicTeamDetailResponse,
  string,
  { rejectValue: string }
>("publicTeams/detail", async (slug, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PublicTeamDetailResponse>(`/public/teams/${slug}`);
    return data;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not load community"));
  }
});

const slice = createSlice({
  name: "publicTeams",
  initialState,
  reducers: {
    setPublicTeamsQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
    setPublicTeamsSort(state, action: PayloadAction<PublicTeamsSort>) {
      state.sort = action.payload;
    },
    clearPublicTeamDetail(state) {
      state.detail = null;
      state.detailError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPublicTeams.pending, (s, a) => {
      const append = a.meta.arg.append;
      if (append) {
        s.loadingMore = true;
      } else {
        s.loading = true;
      }
      s.error = null;
      if (!append) {
        s.query = a.meta.arg.q ?? "";
        s.sort = a.meta.arg.sort ?? "members";
      }
    });
    b.addCase(fetchPublicTeams.fulfilled, (s, a) => {
      s.loading = false;
      s.loadingMore = false;
      s.page = a.payload.page;
      s.limit = a.payload.limit;
      s.total = a.payload.total;
      if (a.meta.arg.append) {
        const existing = new Set(s.teams.map((t) => t.id));
        for (const team of a.payload.teams) {
          if (!existing.has(team.id)) s.teams.push(team);
        }
      } else {
        s.teams = a.payload.teams;
      }
    });
    b.addCase(fetchPublicTeams.rejected, (s, a) => {
      s.loading = false;
      s.loadingMore = false;
      s.error = a.payload || "Error";
    });

    b.addCase(fetchPublicTeamDetail.pending, (s) => {
      s.loadingDetail = true;
      s.detailError = null;
    });
    b.addCase(fetchPublicTeamDetail.fulfilled, (s, a) => {
      s.loadingDetail = false;
      s.detail = a.payload;
    });
    b.addCase(fetchPublicTeamDetail.rejected, (s, a) => {
      s.loadingDetail = false;
      s.detailError = a.payload || "Error";
    });
  },
});

export const { setPublicTeamsQuery, setPublicTeamsSort, clearPublicTeamDetail } =
  slice.actions;
export default slice.reducer;
