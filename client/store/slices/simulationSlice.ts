import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api, { staffAuthHeaders } from "@/lib/api";
import {
  SIMULATION_MAX_ACTIVE_PER_ORG,
  SIMULATION_MAX_REGS_PER_EVENT,
  SIMULATION_TTL_DAYS,
  STRIPE_TEST_CARDS,
} from "@shared/simulation";

export interface SimulationListItem {
  id: number;
  slug: string;
  title: string;
  status: string;
  start_date: string;
  organizer_id: number;
  organizer_name?: string;
  sport_name?: string;
  simulation_access_token: string | null;
  simulation_expires_at: string | null;
  simulation_last_activity_at: string | null;
  cloned_from_event_id: number | null;
  access_url: string | null;
  registration_count: number;
  ttl_days: number;
  max_regs: number;
}

export interface SimulationQuota {
  active?: number;
  max_active: number;
  max_regs_per_event: number;
  ttl_days: number;
}

interface SimulationState {
  detail: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  list: SimulationListItem[];
  quota: SimulationQuota;
  loadingList: boolean;
  listError: string | null;
  mutating: boolean;
  mutateError: string | null;
  cloneCandidates: Array<{ id: number; title: string }>;
}

const initialState: SimulationState = {
  detail: null,
  loading: false,
  error: null,
  list: [],
  quota: {
    max_active: SIMULATION_MAX_ACTIVE_PER_ORG,
    max_regs_per_event: SIMULATION_MAX_REGS_PER_EVENT,
    ttl_days: SIMULATION_TTL_DAYS,
  },
  loadingList: false,
  listError: null,
  mutating: false,
  mutateError: null,
  cloneCandidates: [],
};

export const fetchSimulationEvent = createAsyncThunk(
  "simulation/fetchEvent",
  async (token: string, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/sim/${encodeURIComponent(token)}`);
      return data as Record<string, unknown>;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Simulation not found");
    }
  },
);

export const fetchOrganizerSimulations = createAsyncThunk(
  "simulation/fetchOrganizerList",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<{
        simulations: SimulationListItem[];
        quota: SimulationQuota;
      }>("/organizer/simulations", { headers: staffAuthHeaders });
      return data;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to load simulations");
    }
  },
);

export const fetchAdminSimulations = createAsyncThunk(
  "simulation/fetchAdminList",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<{
        simulations: SimulationListItem[];
        quota: SimulationQuota;
      }>("/admin/simulations", { headers: staffAuthHeaders });
      return data;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to load simulations");
    }
  },
);

export const fetchSimulationCloneCandidates = createAsyncThunk(
  "simulation/fetchCloneCandidates",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<{ events: Array<{ id: number; title: string; status: string }> }>(
        "/organizer/events",
        {
          headers: staffAuthHeaders,
          params: { simulation: "0", limit: 100, sortBy: "title", sortDir: "ASC" },
        },
      );
      return data.events
        .filter((e) => e.status !== "cancelled")
        .map((e) => ({ id: e.id, title: e.title }));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to load events");
    }
  },
);

export const createOrganizerSimulation = createAsyncThunk(
  "simulation/create",
  async (
    body: {
      title: string;
      sportTypeId: number;
      startDate: string;
      cloneFromEventId?: number | null;
    },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.post("/organizer/simulations", body, {
        headers: staffAuthHeaders,
      });
      return data as { access_url: string; token: string; simulation: SimulationListItem };
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to create simulation");
    }
  },
);

export const resetOrganizerSimulation = createAsyncThunk(
  "simulation/reset",
  async (eventId: number, { rejectWithValue }) => {
    try {
      await api.post(
        `/organizer/simulations/${eventId}/reset`,
        {},
        { headers: staffAuthHeaders },
      );
      return eventId;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to reset");
    }
  },
);

export const regenerateOrganizerSimulationLink = createAsyncThunk(
  "simulation/regenerateLink",
  async (eventId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.post<{ token: string; access_url: string }>(
        `/organizer/simulations/${eventId}/regenerate-link`,
        {},
        { headers: staffAuthHeaders },
      );
      return { eventId, ...data };
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to regenerate link");
    }
  },
);

export const resetAdminSimulation = createAsyncThunk(
  "simulation/adminReset",
  async (eventId: number, { rejectWithValue }) => {
    try {
      await api.post(`/admin/simulations/${eventId}/reset`, {}, { headers: staffAuthHeaders });
      return eventId;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to reset");
    }
  },
);

const slice = createSlice({
  name: "simulation",
  initialState,
  reducers: {
    clearSimulationDetail(state) {
      state.detail = null;
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchSimulationEvent.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchSimulationEvent.fulfilled, (s, a) => {
      s.loading = false;
      s.detail = a.payload;
    });
    b.addCase(fetchSimulationEvent.rejected, (s, a) => {
      s.loading = false;
      s.detail = null;
      s.error = String(a.payload || a.error.message || "Error");
    });

    const listPending = (s: SimulationState) => {
      s.loadingList = true;
      s.listError = null;
    };
    const listFulfilled = (
      s: SimulationState,
      a: { payload: { simulations: SimulationListItem[]; quota: SimulationQuota } },
    ) => {
      s.loadingList = false;
      s.list = a.payload.simulations;
      s.quota = a.payload.quota;
    };
    const listRejected = (s: SimulationState, a: { payload?: unknown; error: { message?: string } }) => {
      s.loadingList = false;
      s.listError = String(a.payload || a.error.message || "Error");
    };

    b.addCase(fetchOrganizerSimulations.pending, listPending);
    b.addCase(fetchOrganizerSimulations.fulfilled, listFulfilled);
    b.addCase(fetchOrganizerSimulations.rejected, listRejected);
    b.addCase(fetchAdminSimulations.pending, listPending);
    b.addCase(fetchAdminSimulations.fulfilled, listFulfilled);
    b.addCase(fetchAdminSimulations.rejected, listRejected);

    b.addCase(fetchSimulationCloneCandidates.fulfilled, (s, a) => {
      s.cloneCandidates = a.payload;
    });

    b.addCase(createOrganizerSimulation.pending, (s) => {
      s.mutating = true;
      s.mutateError = null;
    });
    b.addCase(createOrganizerSimulation.fulfilled, (s) => {
      s.mutating = false;
    });
    b.addCase(createOrganizerSimulation.rejected, (s, a) => {
      s.mutating = false;
      s.mutateError = String(a.payload || "Error");
    });
    b.addCase(resetOrganizerSimulation.fulfilled, (s, a) => {
      const row = s.list.find((x) => x.id === a.payload);
      if (row) row.registration_count = 0;
    });
    b.addCase(regenerateOrganizerSimulationLink.fulfilled, (s, a) => {
      const row = s.list.find((x) => x.id === a.payload.eventId);
      if (row) {
        row.simulation_access_token = a.payload.token;
        row.access_url = a.payload.access_url;
      }
    });
    b.addCase(resetAdminSimulation.fulfilled, (s, a) => {
      const row = s.list.find((x) => x.id === a.payload);
      if (row) row.registration_count = 0;
    });
  },
});

export const { clearSimulationDetail } = slice.actions;
export { STRIPE_TEST_CARDS };
export default slice.reducer;
