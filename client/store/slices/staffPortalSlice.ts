import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";

interface StaffDashboardStats {
  athletes?: number;
  organizers?: number;
  published_events?: number;
  confirmed_registrations?: number;
  total_revenue_cents?: number;
}

interface StaffEventRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  start_date: string;
  registration_count: number;
  sport_name?: string;
}

interface StaffPortalState {
  dashboardStats: StaffDashboardStats | null;
  events: StaffEventRow[];
  loadingDashboard: boolean;
  loadingEvents: boolean;
}

const initialState: StaffPortalState = {
  dashboardStats: null,
  events: [],
  loadingDashboard: false,
  loadingEvents: false,
};

export const fetchStaffDashboard = createAsyncThunk(
  "staffPortal/dashboard",
  async () => {
    const { data } = await api.get("/admin/dashboard");
    return data.stats as StaffDashboardStats;
  },
);

export const fetchOrganizerEvents = createAsyncThunk(
  "staffPortal/organizerEvents",
  async () => {
    const { data } = await api.get("/organizer/events");
    return data.events as StaffEventRow[];
  },
);

const slice = createSlice({
  name: "staffPortal",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchStaffDashboard.pending, (s) => {
      s.loadingDashboard = true;
    });
    b.addCase(fetchStaffDashboard.fulfilled, (s, a) => {
      s.loadingDashboard = false;
      s.dashboardStats = a.payload;
    });
    b.addCase(fetchStaffDashboard.rejected, (s) => {
      s.loadingDashboard = false;
    });

    b.addCase(fetchOrganizerEvents.pending, (s) => {
      s.loadingEvents = true;
    });
    b.addCase(fetchOrganizerEvents.fulfilled, (s, a) => {
      s.loadingEvents = false;
      s.events = a.payload;
    });
    b.addCase(fetchOrganizerEvents.rejected, (s) => {
      s.loadingEvents = false;
    });
  },
});

export default slice.reducer;
