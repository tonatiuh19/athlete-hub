import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  CreateTeamRequest,
  JoinTeamRequest,
  TeamDetailResponse,
  TeamRow,
  TeamsListResponse,
} from "@shared/api";

interface AthleteTeamsState {
  teams: TeamRow[];
  teamDetail: TeamDetailResponse | null;
  loading: boolean;
  loadingDetail: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: AthleteTeamsState = {
  teams: [],
  teamDetail: null,
  loading: false,
  loadingDetail: false,
  saving: false,
  error: null,
};

function rejectMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } };
  return err?.response?.data?.error || fallback;
}

export const fetchMyTeams = createAsyncThunk<TeamRow[], void, { rejectValue: string }>(
  "athleteTeams/list",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<TeamsListResponse>("/athlete/teams");
      return data.teams;
    } catch (e: unknown) {
      return rejectWithValue(rejectMessage(e, "Could not load teams"));
    }
  },
);

export const fetchTeamDetail = createAsyncThunk<
  TeamDetailResponse,
  number,
  { rejectValue: string }
>("athleteTeams/detail", async (teamId, { rejectWithValue }) => {
  try {
    const { data } = await api.get<TeamDetailResponse>(`/athlete/teams/${teamId}`);
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load team"));
  }
});

export const createTeam = createAsyncThunk<TeamRow, CreateTeamRequest, { rejectValue: string }>(
  "athleteTeams/create",
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post<{ team: TeamRow }>("/athlete/teams", body);
      return data.team;
    } catch (e: unknown) {
      return rejectWithValue(rejectMessage(e, "Could not create team"));
    }
  },
);

export const joinTeam = createAsyncThunk<TeamRow, JoinTeamRequest, { rejectValue: string }>(
  "athleteTeams/join",
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post<{ team: TeamRow }>("/athlete/teams/join", body);
      return data.team;
    } catch (e: unknown) {
      return rejectWithValue(rejectMessage(e, "Could not join team"));
    }
  },
);

export const leaveTeam = createAsyncThunk<number, number, { rejectValue: string }>(
  "athleteTeams/leave",
  async (teamId, { rejectWithValue }) => {
    try {
      await api.post(`/athlete/teams/${teamId}/leave`);
      return teamId;
    } catch (e: unknown) {
      return rejectWithValue(rejectMessage(e, "Could not leave team"));
    }
  },
);

function upsertTeam(teams: TeamRow[], team: TeamRow): TeamRow[] {
  const idx = teams.findIndex((t) => t.id === team.id);
  if (idx === -1) return [team, ...teams];
  const next = [...teams];
  next[idx] = { ...next[idx], ...team };
  return next;
}

const slice = createSlice({
  name: "athleteTeams",
  initialState,
  reducers: {
    clearTeamDetail(state) {
      state.teamDetail = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMyTeams.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchMyTeams.fulfilled, (s, a) => {
      s.loading = false;
      s.teams = a.payload;
    });
    b.addCase(fetchMyTeams.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload || "Error";
    });

    b.addCase(fetchTeamDetail.pending, (s) => {
      s.loadingDetail = true;
    });
    b.addCase(fetchTeamDetail.fulfilled, (s, a) => {
      s.loadingDetail = false;
      s.teamDetail = a.payload;
    });
    b.addCase(fetchTeamDetail.rejected, (s, a) => {
      s.loadingDetail = false;
      s.error = a.payload || "Error";
    });

    b.addCase(createTeam.pending, (s) => {
      s.saving = true;
      s.error = null;
    });
    b.addCase(createTeam.fulfilled, (s, a) => {
      s.saving = false;
      s.teams = upsertTeam(s.teams, a.payload);
    });
    b.addCase(createTeam.rejected, (s, a) => {
      s.saving = false;
      s.error = a.payload || "Error";
    });

    b.addCase(joinTeam.fulfilled, (s, a) => {
      s.teams = upsertTeam(s.teams, a.payload);
    });
    b.addCase(leaveTeam.fulfilled, (s, a) => {
      s.teams = s.teams.filter((t) => t.id !== a.payload);
      s.teamDetail = null;
    });
  },
});

export const { clearTeamDetail } = slice.actions;
export default slice.reducer;
