import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type { GeoCity, GeoState } from "@shared/api";

interface GeoStateSlice {
  states: GeoState[];
  citiesByStateId: Record<number, GeoCity[]>;
  loadingStates: boolean;
  loadingCities: boolean;
  statesError: string | null;
  citiesError: string | null;
}

const initialState: GeoStateSlice = {
  states: [],
  citiesByStateId: {},
  loadingStates: false,
  loadingCities: false,
  statesError: null,
  citiesError: null,
};

export const fetchGeoStates = createAsyncThunk<GeoState[], string | undefined>(
  "geo/states",
  async (country) => {
    const { data } = await api.get("/geo/states", {
      params: { country: country ?? "MX" },
    });
    return data.states as GeoState[];
  },
);

export const fetchGeoCities = createAsyncThunk(
  "geo/cities",
  async ({
    stateId,
    q,
    country = "MX",
  }: {
    stateId?: number;
    q?: string;
    country?: string;
  }) => {
    const { data } = await api.get("/geo/cities", {
      params: {
        country,
        state_id: stateId,
        q: q?.trim() || undefined,
      },
    });
    return {
      stateId: stateId ?? 0,
      cities: data.cities as GeoCity[],
    };
  },
);

const geoSlice = createSlice({
  name: "geo",
  initialState,
  reducers: {
    clearGeoCities(state) {
      state.citiesByStateId = {};
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchGeoStates.pending, (s) => {
      s.loadingStates = true;
      s.statesError = null;
    });
    b.addCase(fetchGeoStates.fulfilled, (s, a) => {
      s.loadingStates = false;
      s.states = a.payload;
    });
    b.addCase(fetchGeoStates.rejected, (s, a) => {
      s.loadingStates = false;
      s.statesError = a.error.message ?? "Failed to load states";
    });
    b.addCase(fetchGeoCities.pending, (s) => {
      s.loadingCities = true;
      s.citiesError = null;
    });
    b.addCase(fetchGeoCities.fulfilled, (s, a) => {
      s.loadingCities = false;
      if (a.payload.stateId) {
        s.citiesByStateId[a.payload.stateId] = a.payload.cities;
        return;
      }
      for (const city of a.payload.cities) {
        const existing = s.citiesByStateId[city.state_id] ?? [];
        if (!existing.some((c) => c.id === city.id)) {
          s.citiesByStateId[city.state_id] = [...existing, city];
        }
      }
    });
    b.addCase(fetchGeoCities.rejected, (s, a) => {
      s.loadingCities = false;
      s.citiesError = a.error.message ?? "Failed to load cities";
    });
  },
});

export const { clearGeoCities } = geoSlice.actions;
export default geoSlice.reducer;
