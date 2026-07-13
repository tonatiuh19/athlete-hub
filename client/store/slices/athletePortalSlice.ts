import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  AthleteResultItem,
  AthleteResultVisualization,
  AthleteWaitlistResponse,
  EventListItem,
  EventWaiverPublic,
  GuestClaimRegistrationResponse,
  RegistrationItem,
  RegistrationTransferRequest,
  RegistrationTransferResponse,
  WaitlistEntry,
  WaiverSignatureInput,
} from "@shared/api";

interface AthletePortalState {
  registrations: RegistrationItem[];
  waitlistEntries: WaitlistEntry[];
  upcomingEvents: EventListItem[];
  results: AthleteResultItem[];
  loadingRegistrations: boolean;
  loadingWaitlist: boolean;
  loadingEvents: boolean;
  loadingResults: boolean;
  transferringRegistration: boolean;
  resigningWaiver: boolean;
  registrationsError: string | null;
  waitlistError: string | null;
  transferError: string | null;
  resultVisualization: AthleteResultVisualization | null;
  loadingResultViz: boolean;
  resultVizError: string | null;
  eventsError: string | null;
  resultsError: string | null;
}

const initialState: AthletePortalState = {
  registrations: [],
  waitlistEntries: [],
  upcomingEvents: [],
  results: [],
  loadingRegistrations: false,
  loadingWaitlist: false,
  loadingEvents: false,
  loadingResults: false,
  transferringRegistration: false,
  resigningWaiver: false,
  registrationsError: null,
  waitlistError: null,
  transferError: null,
  resultVisualization: null,
  loadingResultViz: false,
  resultVizError: null,
  eventsError: null,
  resultsError: null,
};

function rejectMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } };
  return err?.response?.data?.error || fallback;
}

export const fetchAthleteRegistrations = createAsyncThunk<
  RegistrationItem[],
  void,
  { rejectValue: string }
>("athletePortal/registrations", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/athlete/registrations");
    return data.registrations as RegistrationItem[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load registrations"));
  }
});

export const fetchMarketplaceEvents = createAsyncThunk<
  EventListItem[],
  void,
  { rejectValue: string }
>("athletePortal/events", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/events", { params: { limit: 6 } });
    return data.events as EventListItem[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load events"));
  }
});

export const fetchAthleteResults = createAsyncThunk<
  AthleteResultItem[],
  void,
  { rejectValue: string }
>("athletePortal/results", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/athlete/results");
    return data.results as AthleteResultItem[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load results"));
  }
});

export const fetchResultVisualization = createAsyncThunk<
  AthleteResultVisualization,
  { resultId: number },
  { rejectValue: string }
>("athletePortal/resultViz", async ({ resultId }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/athlete/results/${resultId}/visualization`);
    return data as AthleteResultVisualization;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load visualization"));
  }
});

export const fetchAthleteWaitlist = createAsyncThunk<
  WaitlistEntry[],
  void,
  { rejectValue: string }
>("athletePortal/waitlist", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<AthleteWaitlistResponse>("/athlete/waitlist");
    return data.entries;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load waitlist"));
  }
});

export const claimGuestRegistration = createAsyncThunk<
  GuestClaimRegistrationResponse,
  { claimToken: string },
  { rejectValue: string }
>("athletePortal/claimGuest", async ({ claimToken }, { rejectWithValue, dispatch }) => {
  try {
    const { data } = await api.post<GuestClaimRegistrationResponse>(
      "/athlete/registrations/claim-guest",
      { claimToken },
    );
    void dispatch(fetchAthleteRegistrations());
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not claim registration"));
  }
});

export const transferRegistration = createAsyncThunk<
  RegistrationTransferResponse,
  { publicUuid: string; body: RegistrationTransferRequest },
  { rejectValue: string }
>("athletePortal/transfer", async ({ publicUuid, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<RegistrationTransferResponse>(
      `/athlete/registrations/${publicUuid}/transfer`,
      body,
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not transfer registration"));
  }
});

export const fetchRegistrationWaivers = createAsyncThunk<
  { waivers: EventWaiverPublic[]; requiresResign: boolean },
  string,
  { rejectValue: string }
>("athletePortal/fetchRegistrationWaivers", async (publicUuid, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/athlete/registrations/${publicUuid}/waivers`);
    return data as { waivers: EventWaiverPublic[]; requiresResign: boolean };
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load waivers"));
  }
});

export const resignRegistrationWaivers = createAsyncThunk<
  { ok: boolean },
  { publicUuid: string; signatures: WaiverSignatureInput[] },
  { rejectValue: string }
>("athletePortal/resignWaivers", async ({ publicUuid, signatures }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/athlete/registrations/${publicUuid}/waivers/resign`, {
      waiverSignatures: signatures,
    });
    return data as { ok: boolean };
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update waiver"));
  }
});

const slice = createSlice({
  name: "athletePortal",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchAthleteRegistrations.pending, (s) => {
      s.loadingRegistrations = true;
      s.registrationsError = null;
    });
    b.addCase(fetchAthleteRegistrations.fulfilled, (s, a) => {
      s.loadingRegistrations = false;
      s.registrations = a.payload;
    });
    b.addCase(fetchAthleteRegistrations.rejected, (s, a) => {
      s.loadingRegistrations = false;
      s.registrationsError = a.payload || "Error loading registrations";
    });

    b.addCase(fetchMarketplaceEvents.pending, (s) => {
      s.loadingEvents = true;
      s.eventsError = null;
    });
    b.addCase(fetchMarketplaceEvents.fulfilled, (s, a) => {
      s.loadingEvents = false;
      s.upcomingEvents = a.payload;
    });
    b.addCase(fetchMarketplaceEvents.rejected, (s, a) => {
      s.loadingEvents = false;
      s.eventsError = a.payload || "Error loading events";
    });

    b.addCase(fetchAthleteResults.pending, (s) => {
      s.loadingResults = true;
      s.resultsError = null;
    });
    b.addCase(fetchAthleteResults.fulfilled, (s, a) => {
      s.loadingResults = false;
      s.results = a.payload;
    });
    b.addCase(fetchAthleteResults.rejected, (s, a) => {
      s.loadingResults = false;
      s.resultsError = a.payload || "Error loading results";
    });

    b.addCase(fetchAthleteWaitlist.pending, (s) => {
      s.loadingWaitlist = true;
      s.waitlistError = null;
    });
    b.addCase(fetchAthleteWaitlist.fulfilled, (s, a) => {
      s.loadingWaitlist = false;
      s.waitlistEntries = a.payload;
    });
    b.addCase(fetchAthleteWaitlist.rejected, (s, a) => {
      s.loadingWaitlist = false;
      s.waitlistError = a.payload || "Error loading waitlist";
    });

    b.addCase(transferRegistration.pending, (s) => {
      s.transferringRegistration = true;
      s.transferError = null;
    });
    b.addCase(transferRegistration.fulfilled, (s) => {
      s.transferringRegistration = false;
    });
    b.addCase(transferRegistration.rejected, (s, a) => {
      s.transferringRegistration = false;
      s.transferError = a.payload || "Error transferring registration";
    });

    b.addCase(resignRegistrationWaivers.pending, (s) => {
      s.resigningWaiver = true;
    });
    b.addCase(resignRegistrationWaivers.fulfilled, (s) => {
      s.resigningWaiver = false;
    });
    b.addCase(resignRegistrationWaivers.rejected, (s) => {
      s.resigningWaiver = false;
    });

    b.addCase(fetchResultVisualization.pending, (s) => {
      s.loadingResultViz = true;
      s.resultVizError = null;
    });
    b.addCase(fetchResultVisualization.fulfilled, (s, a) => {
      s.loadingResultViz = false;
      s.resultVisualization = a.payload;
    });
    b.addCase(fetchResultVisualization.rejected, (s, a) => {
      s.loadingResultViz = false;
      s.resultVizError = a.payload || "Error loading visualization";
    });
  },
});

export default slice.reducer;
