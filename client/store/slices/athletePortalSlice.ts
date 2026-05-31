import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type { EventListItem, RegistrationItem } from "@shared/api";

interface AthletePortalState {
  registrations: RegistrationItem[];
  upcomingEvents: EventListItem[];
  loadingRegistrations: boolean;
  loadingEvents: boolean;
  error: string | null;
}

const initialState: AthletePortalState = {
  registrations: [],
  upcomingEvents: [],
  loadingRegistrations: false,
  loadingEvents: false,
  error: null,
};

export const fetchAthleteRegistrations = createAsyncThunk(
  "athletePortal/registrations",
  async () => {
    const { data } = await api.get("/athlete/registrations");
    return data.registrations as RegistrationItem[];
  },
);

export const fetchMarketplaceEvents = createAsyncThunk(
  "athletePortal/events",
  async () => {
    const { data } = await api.get("/events", { params: { limit: 6 } });
    return data.events as EventListItem[];
  },
);

const slice = createSlice({
  name: "athletePortal",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchAthleteRegistrations.pending, (s) => {
      s.loadingRegistrations = true;
      s.error = null;
    });
    b.addCase(fetchAthleteRegistrations.fulfilled, (s, a) => {
      s.loadingRegistrations = false;
      s.registrations = a.payload;
    });
    b.addCase(fetchAthleteRegistrations.rejected, (s, a) => {
      s.loadingRegistrations = false;
      s.error = a.error.message || "Error loading registrations";
    });

    b.addCase(fetchMarketplaceEvents.pending, (s) => {
      s.loadingEvents = true;
    });
    b.addCase(fetchMarketplaceEvents.fulfilled, (s, a) => {
      s.loadingEvents = false;
      s.upcomingEvents = a.payload;
    });
    b.addCase(fetchMarketplaceEvents.rejected, (s) => {
      s.loadingEvents = false;
    });
  },
});

export default slice.reducer;
