import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  EventDetailResponse,
  EventListItem,
  EventsSort,
  FilterCity,
  SearchSuggestResponse,
  SportType,
} from "@shared/api";
import {
  buildMarketplaceQueryParams,
  normalizeMarketplaceFilters,
} from "@/utils/eventsBrowseFilters";

export type EventsViewMode = "grid" | "map" | "split" | "calendar";

export interface MarketplaceFilters {
  q: string;
  sport: string;
  city: string;
  geoCityId: string;
  featured: boolean;
  dateFrom: string;
  dateTo: string;
  minPrice: string;
  maxPrice: string;
  sort: EventsSort;
}

const defaultFilters: MarketplaceFilters = {
  q: "",
  sport: "",
  city: "",
  geoCityId: "",
  featured: false,
  dateFrom: "",
  dateTo: "",
  minPrice: "",
  maxPrice: "",
  sort: "date_asc",
};

interface MarketplaceState {
  events: EventListItem[];
  total: number;
  sportTypes: SportType[];
  cities: FilterCity[];
  filters: MarketplaceFilters;
  viewMode: EventsViewMode;
  selectedEventSlug: string | null;
  loadingEvents: boolean;
  loadingMeta: boolean;
  eventDetail: EventDetailResponse | null;
  loadingDetail: boolean;
  detailError: string | null;
  error: string | null;
  searchSuggestions: SearchSuggestResponse | null;
  searchSuggestionsLoading: boolean;
}

const initialState: MarketplaceState = {
  events: [],
  total: 0,
  sportTypes: [],
  cities: [],
  filters: defaultFilters,
  viewMode: "split",
  selectedEventSlug: null,
  loadingEvents: false,
  loadingMeta: false,
  eventDetail: null,
  loadingDetail: false,
  detailError: null,
  error: null,
  searchSuggestions: null,
  searchSuggestionsLoading: false,
};

export { buildMarketplaceQueryParams };

export const fetchSportTypes = createAsyncThunk("marketplace/sportTypes", async () => {
  const { data } = await api.get("/sport-types");
  return data.sportTypes as SportType[];
});

export const fetchFilterCities = createAsyncThunk("marketplace/cities", async () => {
  const { data } = await api.get("/events/filters/cities");
  return data.cities as FilterCity[];
});

export const fetchMarketplaceEvents = createAsyncThunk(
  "marketplace/events",
  async (filters: MarketplaceFilters, { signal }) => {
    const { data } = await api.get("/events", {
      params: buildMarketplaceQueryParams(filters),
      signal,
    });
    return {
      events: data.events as EventListItem[],
      total: data.total as number,
    };
  },
);

export const trackSponsorEvent = createAsyncThunk(
  "marketplace/trackSponsor",
  async ({
    slug,
    sponsorId,
    type,
  }: {
    slug: string;
    sponsorId: number;
    type: "impression" | "click";
  }) => {
    await api.post(`/events/${slug}/sponsors/track`, { sponsorId, type });
  },
);

export const fetchEventDetail = createAsyncThunk(
  "marketplace/eventDetail",
  async (slug: string) => {
    const { data } = await api.get(`/events/${slug}`);
    return data as EventDetailResponse;
  },
);

export const fetchSearchSuggestions = createAsyncThunk(
  "marketplace/searchSuggest",
  async (q: string, { signal }) => {
    const { data } = await api.get<SearchSuggestResponse>("/search/suggest", {
      params: { q: q.trim() },
      signal,
    });
    return data;
  },
);

const marketplaceSlice = createSlice({
  name: "marketplace",
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<MarketplaceFilters>>) {
      state.filters = normalizeMarketplaceFilters({
        ...state.filters,
        ...action.payload,
      });
    },
    resetFilters(state) {
      state.filters = { ...defaultFilters };
      state.selectedEventSlug = null;
    },
    setViewMode(state, action: PayloadAction<EventsViewMode>) {
      state.viewMode = action.payload;
    },
    setSelectedEventSlug(state, action: PayloadAction<string | null>) {
      state.selectedEventSlug = action.payload;
    },
    clearEventDetail(state) {
      state.eventDetail = null;
      state.detailError = null;
    },
    hydrateEventDetail(state, action: PayloadAction<EventDetailResponse>) {
      state.eventDetail = action.payload;
      state.detailError = null;
      state.loadingDetail = false;
    },
    clearSearchSuggestions(state) {
      state.searchSuggestions = null;
      state.searchSuggestionsLoading = false;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchSportTypes.pending, (s) => {
      s.loadingMeta = true;
    });
    b.addCase(fetchSportTypes.fulfilled, (s, a) => {
      s.loadingMeta = false;
      s.sportTypes = a.payload;
    });
    b.addCase(fetchFilterCities.fulfilled, (s, a) => {
      s.cities = a.payload;
    });

    b.addCase(fetchMarketplaceEvents.pending, (s) => {
      s.loadingEvents = true;
      s.error = null;
    });
    b.addCase(fetchMarketplaceEvents.fulfilled, (s, a) => {
      s.loadingEvents = false;
      s.events = a.payload.events;
      s.total = a.payload.total;
      const stillSelected = a.payload.events.some(
        (ev) => ev.slug === s.selectedEventSlug,
      );
      if (!stillSelected) {
        s.selectedEventSlug = a.payload.events[0]?.slug ?? null;
      }
    });
    b.addCase(fetchMarketplaceEvents.rejected, (s, a) => {
      if (a.meta.aborted) return;
      s.loadingEvents = false;
      s.error = a.error.message || "Failed to load events";
    });

    b.addCase(fetchEventDetail.pending, (s) => {
      s.loadingDetail = true;
      s.detailError = null;
    });
    b.addCase(fetchEventDetail.fulfilled, (s, a) => {
      s.loadingDetail = false;
      s.eventDetail = a.payload;
    });
    b.addCase(fetchEventDetail.rejected, (s, a) => {
      s.loadingDetail = false;
      s.detailError = a.error.message || "Event not found";
      s.eventDetail = null;
    });

    b.addCase(fetchSearchSuggestions.pending, (s) => {
      s.searchSuggestionsLoading = true;
    });
    b.addCase(fetchSearchSuggestions.fulfilled, (s, a) => {
      s.searchSuggestionsLoading = false;
      s.searchSuggestions = a.payload;
    });
    b.addCase(fetchSearchSuggestions.rejected, (s, a) => {
      if (a.meta.aborted) return;
      s.searchSuggestionsLoading = false;
      s.searchSuggestions = null;
    });
  },
});

export const {
  setFilters,
  resetFilters,
  setViewMode,
  setSelectedEventSlug,
  clearEventDetail,
  hydrateEventDetail,
  clearSearchSuggestions,
} = marketplaceSlice.actions;

export default marketplaceSlice.reducer;
