import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  AdminAnalyticsResponse,
  AdminAthleteDetailResponse,
  AdminAthleteRow,
  AnalyticsTimeSeries,
  CheckInResponse,
  EventSponsor,
  EventSponsorInput,
  EventRegistrationFieldInput,
  EventRegistrationFieldRow,
  EventWaiverInput,
  EventWaiverRow,
  OrganizerAnalyticsResponse,
  OrganizerMemberRow,
  OrganizerRegistrationRow,
  PaginatedAdminAthletesResponse,
  PaginatedRegistrationsResponse,
  PaginationInfo,
  RegistrationLookupResponse,
  StaffDashboardStats,
  StaffDiscountCodeInput,
  StaffDiscountCodePatch,
  StaffDiscountCodeRow,
  StaffEventCategory,
  StaffEventCategoryInput,
  StaffEventCategoryPatch,
  StaffEventCoursePayload,
  StaffEventDetailResponse,
  StaffEventHubSummary,
  StaffEventResultRow,
  StaffEventRow,
  StaffEventUpsertRequest,
  StaffResultInput,
  PaginatedAdminPaymentsResponse,
  AdminPaymentRow,
  AdminPaymentDetail,
  AdminPaymentDetailResponse,
  StaffRegistrationDetailResponse,
  StaffManualRegistrationRequest,
  StaffRole,
  StaffScheduleWaveInput,
  StaffScheduleWaveRow,
  BulkBibImportResponse,
  BulkBibRow,
  BulkMessageResponse,
  EventMediaResponse,
  StaffMediaAssetRow,
  AdminEventCreateRequest,
  AdminOrganizerRow,
  AdminOrganizerDetailResponse,
  AdminOrganizerLinkedEvent,
  AdminOrganizerCreateRequest,
  AdminOrganizerUpdateRequest,
  AdminStaffRow,
  AdminStaffCreateRequest,
  AdminStaffUpdateRequest,
  PaginatedAdminOrganizersResponse,
  PaginatedAdminStaffResponse,
  StaffWaitlistEntry,
  ResultSplitRow,
  SponsorAnalyticsResponse,
} from "@shared/api";

interface StaffPortalState {
  dashboardStats: StaffDashboardStats | null;
  analytics: AdminAnalyticsResponse | null;
  analyticsTimeSeries: AnalyticsTimeSeries | null;
  organizerAnalytics: OrganizerAnalyticsResponse | null;
  events: StaffEventRow[];
  athletes: AdminAthleteRow[];
  athletesPagination: PaginationInfo | null;
  registrations: OrganizerRegistrationRow[];
  registrationsPagination: PaginationInfo | null;
  eventDetail: StaffEventDetailResponse | null;
  eventHubSummary: StaffEventHubSummary | null;
  eventHubRegistrations: OrganizerRegistrationRow[];
  eventHubRegistrationsPagination: PaginationInfo | null;
  eventSponsors: EventSponsor[];
  registrationFields: EventRegistrationFieldRow[];
  eventWaivers: EventWaiverRow[];
  scheduleWaves: StaffScheduleWaveRow[];
  eventCourse: StaffEventCoursePayload | null;
  discountCodes: StaffDiscountCodeRow[];
  eventResults: StaffEventResultRow[];
  athleteDetail: AdminAthleteDetailResponse | null;
  lookupRegistration: RegistrationLookupResponse["registration"] | null;
  teamMembers: OrganizerMemberRow[];
  loadingDashboard: boolean;
  loadingAnalytics: boolean;
  loadingEvents: boolean;
  loadingAthletes: boolean;
  loadingRegistrations: boolean;
  loadingEventDetail: boolean;
  loadingEventHubSummary: boolean;
  loadingEventHubRegistrations: boolean;
  savingEvent: boolean;
  publishingEvent: boolean;
  savingCategory: boolean;
  savingSponsors: boolean;
  savingFields: boolean;
  savingWaiver: boolean;
  loadingWaves: boolean;
  savingWaves: boolean;
  loadingCourse: boolean;
  savingCourse: boolean;
  loadingDiscountCodes: boolean;
  savingDiscountCode: boolean;
  cancellingRegistration: boolean;
  loadingResults: boolean;
  savingResults: boolean;
  publishingResults: boolean;
  assigningBib: boolean;
  loadingAthleteDetail: boolean;
  updatingAthleteStatus: boolean;
  lookingUp: boolean;
  checkingIn: boolean;
  loadingTeam: boolean;
  invitingMember: boolean;
  eventMedia: StaffMediaAssetRow[];
  loadingEventMedia: boolean;
  savingEventMedia: boolean;
  eventMediaError: string | null;
  sendingBulkMessage: boolean;
  bulkMessageResult: BulkMessageResponse | null;
  bulkMessageError: string | null;
  importingBulkBibs: boolean;
  bulkBibResult: BulkBibImportResponse | null;
  bulkBibError: string | null;
  waitlistEntries: StaffWaitlistEntry[];
  loadingWaitlist: boolean;
  offeringWaitlist: boolean;
  waitlistError: string | null;
  resultSplits: ResultSplitRow[];
  loadingSplits: boolean;
  savingSplits: boolean;
  splitsError: string | null;
  adminOrganizers: AdminOrganizerRow[];
  loadingAdminOrganizers: boolean;
  adminOrganizersError: string | null;
  staffOrganizers: AdminOrganizerRow[];
  staffOrganizersPagination: PaginationInfo | null;
  loadingStaffOrganizers: boolean;
  staffOrganizersError: string | null;
  savingStaffOrganizer: boolean;
  staffOrganizerSaveError: string | null;
  staffOrganizerDetail: AdminOrganizerDetailResponse | null;
  loadingStaffOrganizerDetail: boolean;
  staffOrganizerDetailError: string | null;
  invitingStaffOrganizerMember: boolean;
  staffOrganizerMemberError: string | null;
  staffAdmins: AdminStaffRow[];
  staffAdminsPagination: PaginationInfo | null;
  loadingStaffAdmins: boolean;
  staffAdminsError: string | null;
  savingStaffAdmin: boolean;
  staffAdminSaveError: string | null;
  staffRegistrationDetail: StaffRegistrationDetailResponse | null;
  loadingStaffRegistrationDetail: boolean;
  staffRegistrationDetailError: string | null;
  creatingStaffRegistration: boolean;
  createStaffRegistrationError: string | null;
  staffPayments: AdminPaymentRow[];
  staffPaymentsPagination: PaginationInfo | null;
  loadingStaffPayments: boolean;
  staffPaymentsError: string | null;
  refundingPayment: boolean;
  refundPaymentError: string | null;
  staffPaymentDetail: AdminPaymentDetail | null;
  loadingStaffPaymentDetail: boolean;
  staffPaymentDetailError: string | null;
  sponsorAnalytics: SponsorAnalyticsResponse | null;
  loadingSponsorAnalytics: boolean;
  sponsorAnalyticsError: string | null;
  dashboardError: string | null;
  analyticsError: string | null;
  eventsError: string | null;
  athletesError: string | null;
  registrationsError: string | null;
  eventDetailError: string | null;
  eventHubSummaryError: string | null;
  eventHubRegistrationsError: string | null;
  saveEventError: string | null;
  publishError: string | null;
  categoryError: string | null;
  sponsorsError: string | null;
  fieldsError: string | null;
  waiverError: string | null;
  wavesError: string | null;
  courseError: string | null;
  discountCodesError: string | null;
  cancelRegistrationError: string | null;
  resultsError: string | null;
  bibError: string | null;
  athleteDetailError: string | null;
  lookupError: string | null;
  checkInError: string | null;
  checkInErrorCode: string | null;
  teamError: string | null;
}

const initialState: StaffPortalState = {
  dashboardStats: null,
  analytics: null,
  analyticsTimeSeries: null,
  organizerAnalytics: null,
  events: [],
  athletes: [],
  athletesPagination: null,
  registrations: [],
  registrationsPagination: null,
  eventDetail: null,
  eventHubSummary: null,
  eventHubRegistrations: [],
  eventHubRegistrationsPagination: null,
  eventSponsors: [],
  registrationFields: [],
  eventWaivers: [],
  scheduleWaves: [],
  eventCourse: null,
  discountCodes: [],
  eventResults: [],
  athleteDetail: null,
  lookupRegistration: null,
  teamMembers: [],
  loadingDashboard: false,
  loadingAnalytics: false,
  loadingEvents: false,
  loadingAthletes: false,
  loadingRegistrations: false,
  loadingEventDetail: false,
  loadingEventHubSummary: false,
  loadingEventHubRegistrations: false,
  savingEvent: false,
  publishingEvent: false,
  savingCategory: false,
  savingSponsors: false,
  savingFields: false,
  savingWaiver: false,
  loadingWaves: false,
  savingWaves: false,
  loadingCourse: false,
  savingCourse: false,
  loadingDiscountCodes: false,
  savingDiscountCode: false,
  cancellingRegistration: false,
  loadingResults: false,
  savingResults: false,
  publishingResults: false,
  assigningBib: false,
  loadingAthleteDetail: false,
  updatingAthleteStatus: false,
  lookingUp: false,
  checkingIn: false,
  loadingTeam: false,
  invitingMember: false,
  eventMedia: [],
  loadingEventMedia: false,
  savingEventMedia: false,
  eventMediaError: null,
  sendingBulkMessage: false,
  bulkMessageResult: null,
  bulkMessageError: null,
  importingBulkBibs: false,
  bulkBibResult: null,
  bulkBibError: null,
  waitlistEntries: [],
  loadingWaitlist: false,
  offeringWaitlist: false,
  waitlistError: null,
  resultSplits: [],
  loadingSplits: false,
  savingSplits: false,
  splitsError: null,
  adminOrganizers: [],
  loadingAdminOrganizers: false,
  adminOrganizersError: null,
  staffOrganizers: [],
  staffOrganizersPagination: null,
  loadingStaffOrganizers: false,
  staffOrganizersError: null,
  savingStaffOrganizer: false,
  staffOrganizerSaveError: null,
  staffOrganizerDetail: null,
  loadingStaffOrganizerDetail: false,
  staffOrganizerDetailError: null,
  invitingStaffOrganizerMember: false,
  staffOrganizerMemberError: null,
  staffAdmins: [],
  staffAdminsPagination: null,
  loadingStaffAdmins: false,
  staffAdminsError: null,
  savingStaffAdmin: false,
  staffAdminSaveError: null,
  staffRegistrationDetail: null,
  loadingStaffRegistrationDetail: false,
  staffRegistrationDetailError: null,
  creatingStaffRegistration: false,
  createStaffRegistrationError: null,
  staffPayments: [],
  staffPaymentsPagination: null,
  loadingStaffPayments: false,
  staffPaymentsError: null,
  refundingPayment: false,
  refundPaymentError: null,
  staffPaymentDetail: null,
  loadingStaffPaymentDetail: false,
  staffPaymentDetailError: null,
  sponsorAnalytics: null,
  loadingSponsorAnalytics: false,
  sponsorAnalyticsError: null,
  dashboardError: null,
  analyticsError: null,
  eventsError: null,
  athletesError: null,
  registrationsError: null,
  eventDetailError: null,
  eventHubSummaryError: null,
  eventHubRegistrationsError: null,
  saveEventError: null,
  publishError: null,
  categoryError: null,
  sponsorsError: null,
  fieldsError: null,
  waiverError: null,
  wavesError: null,
  courseError: null,
  discountCodesError: null,
  cancelRegistrationError: null,
  resultsError: null,
  bibError: null,
  athleteDetailError: null,
  lookupError: null,
  checkInError: null,
  checkInErrorCode: null,
  teamError: null,
};

function rejectMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } };
  return err?.response?.data?.error || fallback;
}

function rejectStaffAction(
  e: unknown,
  fallback: string,
): { message: string; code?: string } {
  const err = e as { response?: { data?: { error?: string; code?: string } } };
  return {
    message: err?.response?.data?.error || fallback,
    code: err?.response?.data?.code,
  };
}

function eventBasePath(role: StaffRole, eventId?: number): string {
  if (role === "admin") {
    return eventId != null ? `/admin/events/${eventId}` : "/admin/events";
  }
  return eventId != null ? `/organizer/events/${eventId}` : "/organizer/events";
}

export const fetchStaffDashboard = createAsyncThunk<
  StaffDashboardStats,
  void,
  { rejectValue: string }
>("staffPortal/dashboard", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/admin/dashboard");
    return data.stats as StaffDashboardStats;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load dashboard"));
  }
});

export const fetchStaffAnalytics = createAsyncThunk<
  AdminAnalyticsResponse,
  void,
  { rejectValue: string }
>("staffPortal/analytics", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/admin/analytics");
    return data as AdminAnalyticsResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load analytics"));
  }
});

export const fetchAdminAnalyticsTimeSeries = createAsyncThunk<
  AnalyticsTimeSeries,
  void,
  { rejectValue: string }
>("staffPortal/analyticsTimeSeries", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/admin/analytics/timeseries");
    return data as AnalyticsTimeSeries;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load chart data"));
  }
});

export const fetchOrganizerAnalytics = createAsyncThunk<
  OrganizerAnalyticsResponse,
  void,
  { rejectValue: string }
>("staffPortal/organizerAnalytics", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/organizer/analytics");
    return data as OrganizerAnalyticsResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load analytics"));
  }
});

export interface GridListParams {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
}

export const fetchAdminAthletes = createAsyncThunk<
  PaginatedAdminAthletesResponse,
  GridListParams,
  { rejectValue: string }
>("staffPortal/adminAthletes", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PaginatedAdminAthletesResponse>("/admin/athletes", {
      params: {
        q: params.q || undefined,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load athletes"));
  }
});

export const fetchAdminAthleteDetail = createAsyncThunk<
  AdminAthleteDetailResponse,
  { athleteId: number },
  { rejectValue: string }
>("staffPortal/adminAthleteDetail", async ({ athleteId }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/admin/athletes/${athleteId}`);
    return data as AdminAthleteDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load athlete"));
  }
});

export const updateAdminAthleteStatus = createAsyncThunk<
  AdminAthleteDetailResponse["athlete"],
  { athleteId: number; status: "active" | "suspended" },
  { rejectValue: string }
>("staffPortal/updateAthleteStatus", async ({ athleteId, status }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/admin/athletes/${athleteId}`, { status });
    return data.athlete as AdminAthleteDetailResponse["athlete"];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update athlete"));
  }
});

export const fetchAdminEvents = createAsyncThunk<
  StaffEventRow[],
  { q?: string; status?: string },
  { rejectValue: string }
>("staffPortal/adminEvents", async ({ q, status }, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/admin/events", {
      params: { q: q || undefined, status: status || undefined },
    });
    return data.events as StaffEventRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load events"));
  }
});

export const createAdminEvent = createAsyncThunk<
  StaffEventDetailResponse,
  AdminEventCreateRequest,
  { rejectValue: string }
>("staffPortal/createAdminEvent", async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/admin/events", body);
    return data as StaffEventDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not create event"));
  }
});

export const fetchAdminOrganizers = createAsyncThunk<
  AdminOrganizerRow[],
  { q?: string },
  { rejectValue: string }
>("staffPortal/fetchAdminOrganizers", async ({ q }, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/admin/organizers", { params: { q: q || undefined, limit: 30 } });
    return data.organizers as AdminOrganizerRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load organizers"));
  }
});

export const fetchStaffOrganizers = createAsyncThunk<
  PaginatedAdminOrganizersResponse,
  GridListParams & { status?: string },
  { rejectValue: string }
>("staffPortal/fetchStaffOrganizers", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PaginatedAdminOrganizersResponse>("/admin/organizers", {
      params: {
        q: params.q || undefined,
        status: params.status || undefined,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load organizers"));
  }
});

export const createStaffOrganizer = createAsyncThunk<
  AdminOrganizerRow,
  AdminOrganizerCreateRequest,
  { rejectValue: string }
>("staffPortal/createStaffOrganizer", async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/admin/organizers", body);
    return data.organizer as AdminOrganizerRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not create organizer"));
  }
});

export const fetchStaffOrganizerDetail = createAsyncThunk<
  AdminOrganizerDetailResponse,
  { organizerId: number },
  { rejectValue: string }
>("staffPortal/fetchStaffOrganizerDetail", async ({ organizerId }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/admin/organizers/${organizerId}`);
    return data as AdminOrganizerDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load organizer"));
  }
});

export const updateStaffOrganizer = createAsyncThunk<
  AdminOrganizerRow,
  { organizerId: number; patch: AdminOrganizerUpdateRequest },
  { rejectValue: string }
>("staffPortal/updateStaffOrganizer", async ({ organizerId, patch }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/admin/organizers/${organizerId}`, patch);
    return data.organizer as AdminOrganizerRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update organizer"));
  }
});

export const inviteStaffOrganizerMember = createAsyncThunk<
  AdminOrganizerDetailResponse["members"],
  {
    organizerId: number;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    phone?: string;
  },
  { rejectValue: string }
>("staffPortal/inviteStaffOrganizerMember", async (body, { rejectWithValue }) => {
  try {
    const { organizerId, ...payload } = body;
    const { data } = await api.post(`/admin/organizers/${organizerId}/members`, payload);
    return data.members as AdminOrganizerDetailResponse["members"];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not invite member"));
  }
});

export const assignStaffOrganizerEvents = createAsyncThunk<
  AdminOrganizerLinkedEvent[],
  { organizerId: number; event_ids: number[] },
  { rejectValue: string }
>("staffPortal/assignStaffOrganizerEvents", async ({ organizerId, event_ids }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/admin/organizers/${organizerId}/events/assign`, { event_ids });
    return data.events as AdminOrganizerLinkedEvent[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not link events"));
  }
});

export const updateStaffOrganizerMemberAccess = createAsyncThunk<
  AdminOrganizerDetailResponse["members"],
  {
    organizerId: number;
    memberId: number;
    event_access_scope: "organization" | "events";
    event_ids?: number[];
  },
  { rejectValue: string }
>("staffPortal/updateStaffOrganizerMemberAccess", async (body, { rejectWithValue }) => {
  try {
    const { organizerId, memberId, ...payload } = body;
    const { data } = await api.patch(
      `/admin/organizers/${organizerId}/members/${memberId}/access`,
      payload,
    );
    return data.members as AdminOrganizerDetailResponse["members"];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update member access"));
  }
});

export const updateStaffOrganizerMember = createAsyncThunk<
  AdminOrganizerDetailResponse["members"],
  { organizerId: number; memberId: number; status: string },
  { rejectValue: string }
>("staffPortal/updateStaffOrganizerMember", async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(
      `/admin/organizers/${body.organizerId}/members/${body.memberId}`,
      { status: body.status },
    );
    return data.members as AdminOrganizerDetailResponse["members"];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update member"));
  }
});

export const fetchStaffAdmins = createAsyncThunk<
  PaginatedAdminStaffResponse,
  GridListParams,
  { rejectValue: string }
>("staffPortal/fetchStaffAdmins", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PaginatedAdminStaffResponse>("/admin/admins", {
      params: {
        q: params.q || undefined,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load admins"));
  }
});

export const createStaffAdmin = createAsyncThunk<
  AdminStaffRow,
  AdminStaffCreateRequest,
  { rejectValue: string }
>("staffPortal/createStaffAdmin", async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/admin/admins", body);
    return data.admin as AdminStaffRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not invite admin"));
  }
});

export const updateStaffAdmin = createAsyncThunk<
  AdminStaffRow,
  { adminId: number; patch: AdminStaffUpdateRequest },
  { rejectValue: string }
>("staffPortal/updateStaffAdmin", async ({ adminId, patch }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/admin/admins/${adminId}`, patch);
    return data.admin as AdminStaffRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update admin"));
  }
});

export const fetchStaffRegistrationDetail = createAsyncThunk<
  StaffRegistrationDetailResponse,
  { eventId: number; registrationId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchRegistrationDetail", async ({ eventId, registrationId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/registrations/${registrationId}`);
    return data as StaffRegistrationDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load registration"));
  }
});

export const createStaffRegistration = createAsyncThunk<
  StaffRegistrationDetailResponse,
  { eventId: number; body: StaffManualRegistrationRequest; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/createRegistration", async ({ eventId, body, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.post(`${base}/${eventId}/registrations`, body);
    return data as StaffRegistrationDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not create registration"));
  }
});

export const fetchStaffPayments = createAsyncThunk<
  PaginatedAdminPaymentsResponse,
  GridListParams & { status?: string; organizerId?: number; eventId?: number; role?: "admin" | "organizer" },
  { rejectValue: string }
>("staffPortal/fetchStaffPayments", async (params, { rejectWithValue }) => {
  try {
    const basePath = params.role === "organizer" ? "/organizer/payments" : "/admin/payments";
    const { data } = await api.get<PaginatedAdminPaymentsResponse>(basePath, {
      params: {
        q: params.q || undefined,
        status: params.status || undefined,
        organizerId: params.organizerId,
        eventId: params.eventId,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load payments"));
  }
});

export const fetchStaffPaymentDetail = createAsyncThunk<
  AdminPaymentDetail,
  { paymentId: number; role?: "admin" | "organizer" },
  { rejectValue: string }
>("staffPortal/fetchStaffPaymentDetail", async ({ paymentId, role }, { rejectWithValue }) => {
  try {
    const basePath = role === "organizer" ? "/organizer/payments" : "/admin/payments";
    const { data } = await api.get<AdminPaymentDetailResponse>(`${basePath}/${paymentId}`);
    return data.payment;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load payment"));
  }
});

export const refundStaffPayment = createAsyncThunk<
  AdminPaymentRow,
  { paymentId: number; reason?: string },
  { rejectValue: string }
>("staffPortal/refundPayment", async ({ paymentId, reason }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/admin/payments/${paymentId}/refund`, { reason });
    return data.payment as AdminPaymentRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not refund payment"));
  }
});

export const fetchSponsorAnalytics = createAsyncThunk<
  SponsorAnalyticsResponse,
  { eventId: number; role?: "admin" | "organizer" },
  { rejectValue: string }
>("staffPortal/fetchSponsorAnalytics", async ({ eventId, role }, { rejectWithValue }) => {
  try {
    const path =
      role === "admin"
        ? `/admin/events/${eventId}/sponsor-analytics`
        : `/organizer/events/${eventId}/sponsor-analytics`;
    const { data } = await api.get(path);
    return data as SponsorAnalyticsResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load sponsor analytics"));
  }
});

export const fetchEventWaitlist = createAsyncThunk<
  StaffWaitlistEntry[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchWaitlist", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/waitlist`);
    return data.entries as StaffWaitlistEntry[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load waitlist"));
  }
});

export const offerWaitlistSpot = createAsyncThunk<
  StaffWaitlistEntry[],
  { eventId: number; waitlistEntryId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/offerWaitlist", async ({ eventId, waitlistEntryId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    await api.post(`${base}/${eventId}/waitlist/offer`, { waitlistEntryId });
    const { data } = await api.get(`${base}/${eventId}/waitlist`);
    return data.entries as StaffWaitlistEntry[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not offer waitlist spot"));
  }
});

export const revokeWaitlistEntry = createAsyncThunk<
  StaffWaitlistEntry[],
  { eventId: number; waitlistEntryId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/revokeWaitlist", async ({ eventId, waitlistEntryId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.post(`${base}/${eventId}/waitlist/revoke`, { waitlistEntryId });
    return data.entries as StaffWaitlistEntry[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not revoke waitlist entry"));
  }
});

export const fetchResultSplits = createAsyncThunk<
  ResultSplitRow[],
  { eventId: number; resultId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchSplits", async ({ eventId, resultId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/results/${resultId}/splits`);
    return data.splits as ResultSplitRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load splits"));
  }
});

export const updateResultSplits = createAsyncThunk<
  ResultSplitRow[],
  { eventId: number; resultId: number; splits: ResultSplitRow[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateSplits", async ({ eventId, resultId, splits, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put(`${base}/${eventId}/results/${resultId}/splits`, { splits });
    return data.splits as ResultSplitRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not save splits"));
  }
});

export const fetchOrganizerEvents = createAsyncThunk<
  StaffEventRow[],
  void,
  { rejectValue: string }
>("staffPortal/organizerEvents", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/organizer/events");
    return data.events as StaffEventRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load events"));
  }
});

export const fetchStaffEventDetail = createAsyncThunk<
  StaffEventDetailResponse,
  { eventId: number; role: StaffRole },
  { rejectValue: string }
>("staffPortal/eventDetail", async ({ eventId, role }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(eventBasePath(role, eventId));
    return data as StaffEventDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load event"));
  }
});

export const createOrganizerEvent = createAsyncThunk<
  StaffEventDetailResponse,
  StaffEventUpsertRequest,
  { rejectValue: string }
>("staffPortal/createEvent", async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/organizer/events", body);
    return data as StaffEventDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not create event"));
  }
});

export const updateStaffEvent = createAsyncThunk<
  StaffEventDetailResponse,
  { eventId: number; role: StaffRole; body: StaffEventUpsertRequest },
  { rejectValue: string }
>("staffPortal/updateEvent", async ({ eventId, role, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(eventBasePath(role, eventId), body);
    return data as StaffEventDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not save event"));
  }
});

export const publishStaffEvent = createAsyncThunk<
  StaffEventDetailResponse,
  { eventId: number; role: StaffRole },
  { rejectValue: string }
>("staffPortal/publishEvent", async ({ eventId, role }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`${eventBasePath(role, eventId)}/publish`);
    return data as StaffEventDetailResponse;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not publish event"));
  }
});

export const addEventCategory = createAsyncThunk<
  StaffEventCategory[],
  { eventId: number; body: StaffEventCategoryInput; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/addCategory", async ({ eventId, body, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.post(`${base}/${eventId}/categories`, body);
    return data.categories as StaffEventCategory[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not add category"));
  }
});

export const deleteEventCategory = createAsyncThunk<
  StaffEventCategory[],
  { eventId: number; categoryId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/deleteCategory", async ({ eventId, categoryId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.delete(`${base}/${eventId}/categories/${categoryId}`);
    return data.categories as StaffEventCategory[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not remove category"));
  }
});

export const fetchEventSponsors = createAsyncThunk<
  EventSponsor[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchSponsors", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/sponsors`);
    return data.sponsors as EventSponsor[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load sponsors"));
  }
});

export const updateEventSponsors = createAsyncThunk<
  EventSponsor[],
  { eventId: number; sponsors: EventSponsorInput[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateSponsors", async ({ eventId, sponsors, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put(`${base}/${eventId}/sponsors`, { sponsors });
    return data.sponsors as EventSponsor[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not save sponsors"));
  }
});

export const fetchEventHubSummary = createAsyncThunk<
  StaffEventHubSummary,
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchEventHubSummary", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/summary`);
    return data.summary as StaffEventHubSummary;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load event summary"));
  }
});

export const fetchEventHubRegistrations = createAsyncThunk<
  PaginatedRegistrationsResponse,
  GridListParams & { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchEventHubRegistrations", async ({ eventId, role = "organizer", ...params }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get<PaginatedRegistrationsResponse>(`${base}/${eventId}/registrations`, {
      params: {
        q: params.q || undefined,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load registrations"));
  }
});

export const fetchOrganizerRegistrations = createAsyncThunk<
  PaginatedRegistrationsResponse,
  GridListParams & { eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/organizerRegistrations", async ({ role = "organizer", eventId, ...params }, { rejectWithValue }) => {
  try {
    const path = role === "admin" ? "/admin/registrations" : "/organizer/registrations";
    const { data } = await api.get<PaginatedRegistrationsResponse>(path, {
      params: {
        q: params.q || undefined,
        eventId: eventId || undefined,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load registrations"));
  }
});

export const lookupRegistration = createAsyncThunk<
  RegistrationLookupResponse["registration"],
  { q: string; eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/lookupRegistration", async ({ q, eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    if (eventId != null) {
      const base = role === "admin" ? "/admin/events" : "/organizer/events";
      const { data } = await api.get(`${base}/${eventId}/registrations/lookup`, { params: { q } });
      return data.registration as RegistrationLookupResponse["registration"];
    }
    const { data } = await api.get("/organizer/registrations/lookup", { params: { q } });
    return data.registration as RegistrationLookupResponse["registration"];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Registration not found"));
  }
});

export const checkInRegistration = createAsyncThunk<
  CheckInResponse["registration"],
  { registrationId: number; eventId?: number; role?: StaffRole; force?: boolean },
  { rejectValue: { message: string; code?: string } }
>("staffPortal/checkIn", async ({ registrationId, eventId, role = "organizer", force }, { rejectWithValue }) => {
  try {
    const body = { method: "manual", ...(force ? { force: true } : {}) };
    if (eventId != null) {
      const base = role === "admin" ? "/admin/events" : "/organizer/events";
      const { data } = await api.post(
        `${base}/${eventId}/registrations/${registrationId}/check-in`,
        body,
      );
      return data.registration as CheckInResponse["registration"];
    }
    const { data } = await api.post(
      `/organizer/registrations/${registrationId}/check-in`,
      body,
    );
    return data.registration as CheckInResponse["registration"];
  } catch (e: unknown) {
    return rejectWithValue(rejectStaffAction(e, "Check-in failed"));
  }
});

export const fetchOrganizerMembers = createAsyncThunk<
  OrganizerMemberRow[],
  void,
  { rejectValue: string }
>("staffPortal/teamMembers", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/organizer/members");
    return data.members as OrganizerMemberRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load team"));
  }
});

export const inviteOrganizerMember = createAsyncThunk<
  OrganizerMemberRow[],
  {
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    phone?: string;
  },
  { rejectValue: string }
>("staffPortal/inviteMember", async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/organizer/members", body);
    return data.members as OrganizerMemberRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not invite member"));
  }
});

export const updateOrganizerMember = createAsyncThunk<
  OrganizerMemberRow[],
  { memberId: number; status?: string; role?: string },
  { rejectValue: string }
>("staffPortal/updateMember", async ({ memberId, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/organizer/members/${memberId}`, body);
    return data.members as OrganizerMemberRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update member"));
  }
});

export const updateEventCategory = createAsyncThunk<
  StaffEventCategory[],
  { eventId: number; categoryId: number; body: StaffEventCategoryPatch; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateCategory", async ({ eventId, categoryId, body, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.patch(`${base}/${eventId}/categories/${categoryId}`, body);
    return data.categories as StaffEventCategory[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update category"));
  }
});

export const fetchRegistrationFields = createAsyncThunk<
  EventRegistrationFieldRow[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchFields", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/registration-fields`);
    return data.fields as EventRegistrationFieldRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load fields"));
  }
});

export const updateRegistrationFields = createAsyncThunk<
  EventRegistrationFieldRow[],
  { eventId: number; fields: EventRegistrationFieldInput[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateFields", async ({ eventId, fields, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put(`${base}/${eventId}/registration-fields`, {
      fields,
    });
    return data.fields as EventRegistrationFieldRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not save fields"));
  }
});

export const fetchEventWaivers = createAsyncThunk<
  EventWaiverRow[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchWaivers", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/waivers`);
    return data.waivers as EventWaiverRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load waivers"));
  }
});

export const updateEventWaivers = createAsyncThunk<
  EventWaiverRow[],
  { eventId: number; waivers: EventWaiverInput[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateWaivers", async ({ eventId, role = "organizer", waivers }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put(`${base}/${eventId}/waivers`, { waivers });
    return data.waivers as EventWaiverRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not save waivers"));
  }
});

export const fetchScheduleWaves = createAsyncThunk<
  StaffScheduleWaveRow[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchWaves", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/schedule-waves`);
    return data.waves as StaffScheduleWaveRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load waves"));
  }
});

export const updateScheduleWaves = createAsyncThunk<
  StaffScheduleWaveRow[],
  { eventId: number; waves: StaffScheduleWaveInput[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateWaves", async ({ eventId, waves, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put(`${base}/${eventId}/schedule-waves`, { waves });
    return data.waves as StaffScheduleWaveRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not save waves"));
  }
});

export const fetchEventCourse = createAsyncThunk<
  StaffEventCoursePayload | null,
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchCourse", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/course`);
    return (data.course as StaffEventCoursePayload) ?? null;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load course"));
  }
});

export const updateEventCourse = createAsyncThunk<
  StaffEventCoursePayload,
  { eventId: number; course: StaffEventCoursePayload; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateCourse", async ({ eventId, course, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put(`${base}/${eventId}/course`, course);
    return data.course as StaffEventCoursePayload;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not save course"));
  }
});

export const fetchDiscountCodes = createAsyncThunk<
  StaffDiscountCodeRow[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchDiscountCodes", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/discount-codes`);
    return data.discountCodes as StaffDiscountCodeRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load discount codes"));
  }
});

export const createDiscountCode = createAsyncThunk<
  StaffDiscountCodeRow,
  { eventId: number; body: StaffDiscountCodeInput; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/createDiscountCode", async ({ eventId, body, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.post(`${base}/${eventId}/discount-codes`, body);
    return data.discountCode as StaffDiscountCodeRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not create discount code"));
  }
});

export const updateDiscountCode = createAsyncThunk<
  StaffDiscountCodeRow,
  { eventId: number; codeId: number; patch: StaffDiscountCodePatch; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateDiscountCode", async ({ eventId, codeId, patch, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.patch(`${base}/${eventId}/discount-codes/${codeId}`, patch);
    return data.discountCode as StaffDiscountCodeRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update discount code"));
  }
});

export const deleteDiscountCode = createAsyncThunk<
  number,
  { eventId: number; codeId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/deleteDiscountCode", async ({ eventId, codeId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    await api.delete(`${base}/${eventId}/discount-codes/${codeId}`);
    return codeId;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not delete discount code"));
  }
});

export const cancelRegistration = createAsyncThunk<
  OrganizerRegistrationRow,
  { registrationId: number; eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/cancelRegistration", async ({ registrationId, eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    if (eventId != null) {
      const base = role === "admin" ? "/admin/events" : "/organizer/events";
      const { data } = await api.patch(`${base}/${eventId}/registrations/${registrationId}/cancel`);
      return data.registration as OrganizerRegistrationRow;
    }
    const { data } = await api.patch(`/organizer/registrations/${registrationId}/cancel`);
    return data.registration as OrganizerRegistrationRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not cancel registration"));
  }
});

export const assignRegistrationBib = createAsyncThunk<
  { id: number; bib_number: string | null },
  { registrationId: number; bib_number: string | null; eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/assignBib", async ({ registrationId, bib_number, eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    if (eventId != null) {
      const base = role === "admin" ? "/admin/events" : "/organizer/events";
      const { data } = await api.patch(`${base}/${eventId}/registrations/${registrationId}/bib`, {
        bib_number,
      });
      return {
        id: data.registration.id as number,
        bib_number: data.registration.bib_number as string | null,
      };
    }
    const { data } = await api.patch(`/organizer/registrations/${registrationId}/bib`, {
      bib_number,
    });
    return {
      id: data.registration.id as number,
      bib_number: data.registration.bib_number as string | null,
    };
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not assign bib"));
  }
});

export const fetchEventResults = createAsyncThunk<
  StaffEventResultRow[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchResults", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/results`);
    return data.results as StaffEventResultRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load results"));
  }
});

export const upsertEventResults = createAsyncThunk<
  StaffEventResultRow[],
  { eventId: number; results: StaffResultInput[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/upsertResults", async ({ eventId, results, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.post(`${base}/${eventId}/results`, { results });
    if (data.errors?.length && !data.results?.length) {
      return rejectWithValue(data.errors.join("; "));
    }
    return data.results as StaffEventResultRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not import results"));
  }
});

export const publishEventResults = createAsyncThunk<
  number,
  { eventId: number; resultIds?: number[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/publishResults", async ({ eventId, resultIds, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.post(`${base}/${eventId}/results/publish`, {
      result_ids: resultIds,
    });
    return Number(data.published_count ?? 0);
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not publish results"));
  }
});

export const deleteEventResult = createAsyncThunk<
  number,
  { eventId: number; resultId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/deleteResult", async ({ eventId, resultId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    await api.delete(`${base}/${eventId}/results/${resultId}`);
    return resultId;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not delete result"));
  }
});

export const sendBulkMessage = createAsyncThunk<
  BulkMessageResponse,
  { eventId: number; subject: string; body: string },
  { rejectValue: string }
>("staffPortal/sendBulkMessage", async ({ eventId, subject, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<BulkMessageResponse>(
      `/organizer/events/${eventId}/messages/bulk`,
      { subject, body },
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not send messages"));
  }
});

export const bulkAssignBibs = createAsyncThunk<
  BulkBibImportResponse,
  { rows: BulkBibRow[]; eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/bulkAssignBibs", async ({ rows, eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    if (eventId != null) {
      const base = role === "admin" ? "/admin/events" : "/organizer/events";
      const { data } = await api.post<BulkBibImportResponse>(
        `${base}/${eventId}/registrations/bulk-bib`,
        { rows },
      );
      return data;
    }
    const { data } = await api.post<BulkBibImportResponse>(
      "/organizer/registrations/bulk-bib",
      { rows },
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not import bib numbers"));
  }
});

export const fetchEventMedia = createAsyncThunk<
  StaffMediaAssetRow[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchEventMedia", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get<EventMediaResponse>(`${base}/${eventId}/media`);
    return data.media;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not load event media"));
  }
});

export const updateEventMedia = createAsyncThunk<
  StaffMediaAssetRow[],
  { eventId: number; media: StaffMediaAssetRow[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateEventMedia", async ({ eventId, media, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put<EventMediaResponse>(`${base}/${eventId}/media`, { media });
    return data.media;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "Could not update event media"));
  }
});

const slice = createSlice({
  name: "staffPortal",
  initialState,
  reducers: {
    clearEventDetail(state) {
      state.eventDetail = null;
      state.eventSponsors = [];
      state.registrationFields = [];
      state.eventWaivers = [];
      state.eventDetailError = null;
      state.saveEventError = null;
      state.publishError = null;
      state.categoryError = null;
      state.sponsorsError = null;
    },
    clearEventHub(state) {
      state.eventHubSummary = null;
      state.eventHubRegistrations = [];
      state.eventHubRegistrationsPagination = null;
      state.eventHubSummaryError = null;
      state.eventHubRegistrationsError = null;
      state.lookupRegistration = null;
      state.lookupError = null;
      state.checkInError = null;
      state.checkInErrorCode = null;
    },
    clearAthleteDetail(state) {
      state.athleteDetail = null;
      state.athleteDetailError = null;
    },
    clearLookup(state) {
      state.lookupRegistration = null;
      state.lookupError = null;
      state.checkInError = null;
      state.checkInErrorCode = null;
    },
    clearStaffOrganizerDetail(state) {
      state.staffOrganizerDetail = null;
      state.staffOrganizerDetailError = null;
      state.staffOrganizerMemberError = null;
    },
    clearStaffRegistrationDetail(state) {
      state.staffRegistrationDetail = null;
      state.staffRegistrationDetailError = null;
    },
    clearStaffPaymentDetail(state) {
      state.staffPaymentDetail = null;
      state.staffPaymentDetailError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchStaffDashboard.pending, (s) => {
      s.loadingDashboard = true;
      s.dashboardError = null;
    });
    b.addCase(fetchStaffDashboard.fulfilled, (s, a) => {
      s.loadingDashboard = false;
      s.dashboardStats = a.payload;
    });
    b.addCase(fetchStaffDashboard.rejected, (s, a) => {
      s.loadingDashboard = false;
      s.dashboardError = a.payload || "Error loading dashboard";
    });

    b.addCase(fetchStaffAnalytics.pending, (s) => {
      s.loadingAnalytics = true;
      s.analyticsError = null;
    });
    b.addCase(fetchStaffAnalytics.fulfilled, (s, a) => {
      s.loadingAnalytics = false;
      s.analytics = a.payload;
    });
    b.addCase(fetchStaffAnalytics.rejected, (s, a) => {
      s.loadingAnalytics = false;
      s.analyticsError = a.payload || "Error loading analytics";
    });

    b.addCase(fetchAdminAnalyticsTimeSeries.fulfilled, (s, a) => {
      s.analyticsTimeSeries = a.payload;
    });

    b.addCase(fetchOrganizerAnalytics.pending, (s) => {
      s.loadingAnalytics = true;
      s.analyticsError = null;
    });
    b.addCase(fetchOrganizerAnalytics.fulfilled, (s, a) => {
      s.loadingAnalytics = false;
      s.organizerAnalytics = a.payload;
    });
    b.addCase(fetchOrganizerAnalytics.rejected, (s, a) => {
      s.loadingAnalytics = false;
      s.analyticsError = a.payload || "Error loading analytics";
    });

    b.addCase(fetchAdminAthletes.pending, (s) => {
      s.loadingAthletes = true;
      s.athletesError = null;
    });
    b.addCase(fetchAdminAthletes.fulfilled, (s, a) => {
      s.loadingAthletes = false;
      s.athletes = a.payload.athletes;
      s.athletesPagination = a.payload.pagination;
    });
    b.addCase(fetchAdminAthletes.rejected, (s, a) => {
      s.loadingAthletes = false;
      s.athletesError = a.payload || "Error loading athletes";
    });

    b.addCase(fetchAdminAthleteDetail.pending, (s) => {
      s.loadingAthleteDetail = true;
      s.athleteDetailError = null;
    });
    b.addCase(fetchAdminAthleteDetail.fulfilled, (s, a) => {
      s.loadingAthleteDetail = false;
      s.athleteDetail = a.payload;
    });
    b.addCase(fetchAdminAthleteDetail.rejected, (s, a) => {
      s.loadingAthleteDetail = false;
      s.athleteDetailError = a.payload || "Error loading athlete";
    });

    b.addCase(updateAdminAthleteStatus.pending, (s) => {
      s.updatingAthleteStatus = true;
    });
    b.addCase(updateAdminAthleteStatus.fulfilled, (s, a) => {
      s.updatingAthleteStatus = false;
      if (s.athleteDetail) {
        s.athleteDetail.athlete = { ...s.athleteDetail.athlete, ...a.payload };
      }
      s.athletes = s.athletes.map((ath) =>
        ath.id === a.payload.id ? { ...ath, status: a.payload.status } : ath,
      );
    });
    b.addCase(updateAdminAthleteStatus.rejected, (s) => {
      s.updatingAthleteStatus = false;
    });

    b.addCase(fetchAdminEvents.pending, (s) => {
      s.loadingEvents = true;
      s.eventsError = null;
    });
    b.addCase(fetchAdminEvents.fulfilled, (s, a) => {
      s.loadingEvents = false;
      s.events = a.payload;
    });
    b.addCase(fetchAdminEvents.rejected, (s, a) => {
      s.loadingEvents = false;
      s.eventsError = a.payload || "Error loading events";
    });

    b.addCase(fetchOrganizerEvents.pending, (s) => {
      s.loadingEvents = true;
      s.eventsError = null;
    });
    b.addCase(fetchOrganizerEvents.fulfilled, (s, a) => {
      s.loadingEvents = false;
      s.events = a.payload;
    });
    b.addCase(fetchOrganizerEvents.rejected, (s, a) => {
      s.loadingEvents = false;
      s.eventsError = a.payload || "Error loading events";
    });

    b.addCase(fetchStaffEventDetail.pending, (s) => {
      s.loadingEventDetail = true;
      s.eventDetailError = null;
    });
    b.addCase(fetchStaffEventDetail.fulfilled, (s, a) => {
      s.loadingEventDetail = false;
      s.eventDetail = a.payload;
    });
    b.addCase(fetchStaffEventDetail.rejected, (s, a) => {
      s.loadingEventDetail = false;
      s.eventDetailError = a.payload || "Error loading event";
    });

    b.addCase(fetchEventHubSummary.pending, (s) => {
      s.loadingEventHubSummary = true;
      s.eventHubSummaryError = null;
    });
    b.addCase(fetchEventHubSummary.fulfilled, (s, a) => {
      s.loadingEventHubSummary = false;
      s.eventHubSummary = a.payload;
    });
    b.addCase(fetchEventHubSummary.rejected, (s, a) => {
      s.loadingEventHubSummary = false;
      s.eventHubSummaryError = a.payload || "Error loading summary";
    });

    b.addCase(fetchEventHubRegistrations.pending, (s) => {
      s.loadingEventHubRegistrations = true;
      s.eventHubRegistrationsError = null;
    });
    b.addCase(fetchEventHubRegistrations.fulfilled, (s, a) => {
      s.loadingEventHubRegistrations = false;
      s.eventHubRegistrations = a.payload.registrations;
      s.eventHubRegistrationsPagination = a.payload.pagination;
    });
    b.addCase(fetchEventHubRegistrations.rejected, (s, a) => {
      s.loadingEventHubRegistrations = false;
      s.eventHubRegistrationsError = a.payload || "Error loading registrations";
    });

    b.addCase(createOrganizerEvent.pending, (s) => {
      s.savingEvent = true;
      s.saveEventError = null;
    });
    b.addCase(createOrganizerEvent.fulfilled, (s, a) => {
      s.savingEvent = false;
      s.eventDetail = a.payload;
    });
    b.addCase(createOrganizerEvent.rejected, (s, a) => {
      s.savingEvent = false;
      s.saveEventError = a.payload || "Error creating event";
    });

    b.addCase(updateStaffEvent.pending, (s) => {
      s.savingEvent = true;
      s.saveEventError = null;
    });
    b.addCase(updateStaffEvent.fulfilled, (s, a) => {
      s.savingEvent = false;
      s.eventDetail = a.payload;
    });
    b.addCase(updateStaffEvent.rejected, (s, a) => {
      s.savingEvent = false;
      s.saveEventError = a.payload || "Error saving event";
    });

    b.addCase(publishStaffEvent.pending, (s) => {
      s.publishingEvent = true;
      s.publishError = null;
    });
    b.addCase(publishStaffEvent.fulfilled, (s, a) => {
      s.publishingEvent = false;
      s.eventDetail = a.payload;
    });
    b.addCase(publishStaffEvent.rejected, (s, a) => {
      s.publishingEvent = false;
      s.publishError = a.payload || "Error publishing event";
    });

    b.addCase(addEventCategory.pending, (s) => {
      s.savingCategory = true;
      s.categoryError = null;
    });
    b.addCase(addEventCategory.fulfilled, (s, a) => {
      s.savingCategory = false;
      if (s.eventDetail) s.eventDetail.categories = a.payload;
    });
    b.addCase(addEventCategory.rejected, (s, a) => {
      s.savingCategory = false;
      s.categoryError = a.payload || "Error adding category";
    });

    b.addCase(deleteEventCategory.fulfilled, (s, a) => {
      if (s.eventDetail) s.eventDetail.categories = a.payload;
    });

    b.addCase(fetchEventSponsors.fulfilled, (s, a) => {
      s.eventSponsors = a.payload;
    });
    b.addCase(fetchEventSponsors.rejected, (s, a) => {
      s.sponsorsError = a.payload || "Error loading sponsors";
    });

    b.addCase(updateEventSponsors.pending, (s) => {
      s.savingSponsors = true;
      s.sponsorsError = null;
    });
    b.addCase(updateEventSponsors.fulfilled, (s, a) => {
      s.savingSponsors = false;
      s.eventSponsors = a.payload;
    });
    b.addCase(updateEventSponsors.rejected, (s, a) => {
      s.savingSponsors = false;
      s.sponsorsError = a.payload || "Error saving sponsors";
    });

    b.addCase(fetchOrganizerRegistrations.pending, (s) => {
      s.loadingRegistrations = true;
      s.registrationsError = null;
    });
    b.addCase(fetchOrganizerRegistrations.fulfilled, (s, a) => {
      s.loadingRegistrations = false;
      s.registrations = a.payload.registrations;
      s.registrationsPagination = a.payload.pagination;
    });
    b.addCase(fetchOrganizerRegistrations.rejected, (s, a) => {
      s.loadingRegistrations = false;
      s.registrationsError = a.payload || "Error loading registrations";
    });

    b.addCase(lookupRegistration.pending, (s) => {
      s.lookingUp = true;
      s.lookupError = null;
    });
    b.addCase(lookupRegistration.fulfilled, (s, a) => {
      s.lookingUp = false;
      s.lookupRegistration = a.payload;
    });
    b.addCase(lookupRegistration.rejected, (s, a) => {
      s.lookingUp = false;
      s.lookupError = a.payload || "Not found";
    });

    b.addCase(checkInRegistration.pending, (s) => {
      s.checkingIn = true;
      s.checkInError = null;
      s.checkInErrorCode = null;
    });
    b.addCase(checkInRegistration.fulfilled, (s, a) => {
      s.checkingIn = false;
      s.registrations = s.registrations.map((r) =>
        r.id === a.payload.id
          ? { ...r, checked_in_at: a.payload.checked_in_at }
          : r,
      );
      s.eventHubRegistrations = s.eventHubRegistrations.map((r) =>
        r.id === a.payload.id
          ? { ...r, checked_in_at: a.payload.checked_in_at }
          : r,
      );
      if (s.lookupRegistration?.id === a.payload.id) {
        s.lookupRegistration = {
          ...s.lookupRegistration,
          checked_in_at: a.payload.checked_in_at,
        };
      }
    });
    b.addCase(checkInRegistration.rejected, (s, a) => {
      s.checkingIn = false;
      s.checkInError = a.payload?.message || "Check-in failed";
      s.checkInErrorCode = a.payload?.code ?? null;
    });

    b.addCase(fetchOrganizerMembers.pending, (s) => {
      s.loadingTeam = true;
      s.teamError = null;
    });
    b.addCase(fetchOrganizerMembers.fulfilled, (s, a) => {
      s.loadingTeam = false;
      s.teamMembers = a.payload;
    });
    b.addCase(fetchOrganizerMembers.rejected, (s, a) => {
      s.loadingTeam = false;
      s.teamError = a.payload || "Error loading team";
    });

    b.addCase(inviteOrganizerMember.pending, (s) => {
      s.invitingMember = true;
      s.teamError = null;
    });
    b.addCase(inviteOrganizerMember.fulfilled, (s, a) => {
      s.invitingMember = false;
      s.teamMembers = a.payload;
    });
    b.addCase(inviteOrganizerMember.rejected, (s, a) => {
      s.invitingMember = false;
      s.teamError = a.payload || "Error inviting member";
    });

    b.addCase(updateOrganizerMember.fulfilled, (s, a) => {
      s.teamMembers = a.payload;
    });

    b.addCase(updateEventCategory.fulfilled, (s, a) => {
      if (s.eventDetail) s.eventDetail.categories = a.payload;
    });

    b.addCase(fetchRegistrationFields.fulfilled, (s, a) => {
      s.registrationFields = a.payload;
    });
    b.addCase(updateRegistrationFields.pending, (s) => {
      s.savingFields = true;
      s.fieldsError = null;
    });
    b.addCase(updateRegistrationFields.fulfilled, (s, a) => {
      s.savingFields = false;
      s.registrationFields = a.payload;
    });
    b.addCase(updateRegistrationFields.rejected, (s, a) => {
      s.savingFields = false;
      s.fieldsError = a.payload || "Error saving fields";
    });

    b.addCase(fetchEventWaivers.fulfilled, (s, a) => {
      s.eventWaivers = a.payload;
      s.waiverError = null;
    });
    b.addCase(fetchEventWaivers.rejected, (s, a) => {
      s.waiverError = a.payload || "Error loading waivers";
    });
    b.addCase(updateEventWaivers.pending, (s) => {
      s.savingWaiver = true;
      s.waiverError = null;
    });
    b.addCase(updateEventWaivers.fulfilled, (s, a) => {
      s.savingWaiver = false;
      s.eventWaivers = a.payload;
    });
    b.addCase(updateEventWaivers.rejected, (s, a) => {
      s.savingWaiver = false;
      s.waiverError = a.payload || "Error saving waivers";
    });

    b.addCase(fetchScheduleWaves.pending, (s) => {
      s.loadingWaves = true;
      s.wavesError = null;
    });
    b.addCase(fetchScheduleWaves.fulfilled, (s, a) => {
      s.loadingWaves = false;
      s.scheduleWaves = a.payload;
    });
    b.addCase(fetchScheduleWaves.rejected, (s, a) => {
      s.loadingWaves = false;
      s.wavesError = a.payload || "Error loading waves";
    });
    b.addCase(updateScheduleWaves.pending, (s) => {
      s.savingWaves = true;
      s.wavesError = null;
    });
    b.addCase(updateScheduleWaves.fulfilled, (s, a) => {
      s.savingWaves = false;
      s.scheduleWaves = a.payload;
    });
    b.addCase(updateScheduleWaves.rejected, (s, a) => {
      s.savingWaves = false;
      s.wavesError = a.payload || "Error saving waves";
    });

    b.addCase(fetchEventCourse.pending, (s) => {
      s.loadingCourse = true;
      s.courseError = null;
    });
    b.addCase(fetchEventCourse.fulfilled, (s, a) => {
      s.loadingCourse = false;
      s.eventCourse = a.payload;
    });
    b.addCase(fetchEventCourse.rejected, (s, a) => {
      s.loadingCourse = false;
      s.courseError = a.payload || "Error loading course";
    });
    b.addCase(updateEventCourse.pending, (s) => {
      s.savingCourse = true;
      s.courseError = null;
    });
    b.addCase(updateEventCourse.fulfilled, (s, a) => {
      s.savingCourse = false;
      s.eventCourse = a.payload;
    });
    b.addCase(updateEventCourse.rejected, (s, a) => {
      s.savingCourse = false;
      s.courseError = a.payload || "Error saving course";
    });

    b.addCase(fetchDiscountCodes.pending, (s) => {
      s.loadingDiscountCodes = true;
      s.discountCodesError = null;
    });
    b.addCase(fetchDiscountCodes.fulfilled, (s, a) => {
      s.loadingDiscountCodes = false;
      s.discountCodes = a.payload;
    });
    b.addCase(fetchDiscountCodes.rejected, (s, a) => {
      s.loadingDiscountCodes = false;
      s.discountCodesError = a.payload || "Error loading discount codes";
    });
    b.addCase(createDiscountCode.pending, (s) => {
      s.savingDiscountCode = true;
      s.discountCodesError = null;
    });
    b.addCase(createDiscountCode.fulfilled, (s, a) => {
      s.savingDiscountCode = false;
      s.discountCodes = [a.payload, ...s.discountCodes];
    });
    b.addCase(createDiscountCode.rejected, (s, a) => {
      s.savingDiscountCode = false;
      s.discountCodesError = a.payload || "Error creating discount code";
    });
    b.addCase(updateDiscountCode.fulfilled, (s, a) => {
      s.discountCodes = s.discountCodes.map((c) =>
        c.id === a.payload.id ? a.payload : c,
      );
    });
    b.addCase(deleteDiscountCode.fulfilled, (s, a) => {
      s.discountCodes = s.discountCodes.filter((c) => c.id !== a.payload);
    });

    b.addCase(cancelRegistration.pending, (s) => {
      s.cancellingRegistration = true;
      s.cancelRegistrationError = null;
    });
    b.addCase(cancelRegistration.fulfilled, (s, a) => {
      s.cancellingRegistration = false;
      s.registrations = s.registrations.map((r) =>
        r.id === a.payload.id ? { ...r, status: a.payload.status } : r,
      );
      s.eventHubRegistrations = s.eventHubRegistrations.map((r) =>
        r.id === a.payload.id ? { ...r, status: a.payload.status } : r,
      );
    });
    b.addCase(cancelRegistration.rejected, (s, a) => {
      s.cancellingRegistration = false;
      s.cancelRegistrationError = a.payload || "Error cancelling registration";
    });

    b.addCase(assignRegistrationBib.pending, (s) => {
      s.assigningBib = true;
      s.bibError = null;
    });
    b.addCase(assignRegistrationBib.fulfilled, (s, a) => {
      s.assigningBib = false;
      s.registrations = s.registrations.map((r) =>
        r.id === a.payload.id ? { ...r, bib_number: a.payload.bib_number } : r,
      );
      s.eventHubRegistrations = s.eventHubRegistrations.map((r) =>
        r.id === a.payload.id ? { ...r, bib_number: a.payload.bib_number } : r,
      );
    });
    b.addCase(assignRegistrationBib.rejected, (s, a) => {
      s.assigningBib = false;
      s.bibError = a.payload || "Error assigning bib";
    });

    b.addCase(fetchEventResults.pending, (s) => {
      s.loadingResults = true;
      s.resultsError = null;
    });
    b.addCase(fetchEventResults.fulfilled, (s, a) => {
      s.loadingResults = false;
      s.eventResults = a.payload;
    });
    b.addCase(fetchEventResults.rejected, (s, a) => {
      s.loadingResults = false;
      s.resultsError = a.payload || "Error loading results";
    });

    b.addCase(upsertEventResults.pending, (s) => {
      s.savingResults = true;
      s.resultsError = null;
    });
    b.addCase(upsertEventResults.fulfilled, (s, a) => {
      s.savingResults = false;
      if (a.payload.length > 0) {
        const map = new Map(s.eventResults.map((r) => [r.id, r]));
        for (const row of a.payload) map.set(row.id, row as StaffEventResultRow);
        s.eventResults = Array.from(map.values());
      }
    });
    b.addCase(upsertEventResults.rejected, (s, a) => {
      s.savingResults = false;
      s.resultsError = a.payload || "Error saving results";
    });

    b.addCase(publishEventResults.pending, (s) => {
      s.publishingResults = true;
    });
    b.addCase(publishEventResults.fulfilled, (s) => {
      s.publishingResults = false;
      s.eventResults = s.eventResults.map((r) => ({
        ...r,
        published_at: r.published_at ?? new Date().toISOString(),
      }));
    });
    b.addCase(publishEventResults.rejected, (s, a) => {
      s.publishingResults = false;
      s.resultsError = a.payload || "Error publishing results";
    });

    b.addCase(deleteEventResult.fulfilled, (s, a) => {
      s.eventResults = s.eventResults.filter((r) => r.id !== a.payload);
    });

    b.addCase(sendBulkMessage.pending, (s) => {
      s.sendingBulkMessage = true;
      s.bulkMessageError = null;
      s.bulkMessageResult = null;
    });
    b.addCase(sendBulkMessage.fulfilled, (s, a) => {
      s.sendingBulkMessage = false;
      s.bulkMessageResult = a.payload;
    });
    b.addCase(sendBulkMessage.rejected, (s, a) => {
      s.sendingBulkMessage = false;
      s.bulkMessageError = a.payload || "Error sending messages";
    });

    b.addCase(bulkAssignBibs.pending, (s) => {
      s.importingBulkBibs = true;
      s.bulkBibError = null;
      s.bulkBibResult = null;
    });
    b.addCase(bulkAssignBibs.fulfilled, (s, a) => {
      s.importingBulkBibs = false;
      s.bulkBibResult = a.payload;
    });
    b.addCase(bulkAssignBibs.rejected, (s, a) => {
      s.importingBulkBibs = false;
      s.bulkBibError = a.payload || "Error importing bibs";
    });

    b.addCase(fetchEventMedia.pending, (s) => {
      s.loadingEventMedia = true;
      s.eventMediaError = null;
    });
    b.addCase(fetchEventMedia.fulfilled, (s, a) => {
      s.loadingEventMedia = false;
      s.eventMedia = a.payload;
    });
    b.addCase(fetchEventMedia.rejected, (s, a) => {
      s.loadingEventMedia = false;
      s.eventMediaError = a.payload || "Error loading media";
    });

    b.addCase(updateEventMedia.pending, (s) => {
      s.savingEventMedia = true;
      s.eventMediaError = null;
    });
    b.addCase(updateEventMedia.fulfilled, (s, a) => {
      s.savingEventMedia = false;
      s.eventMedia = a.payload;
    });
    b.addCase(updateEventMedia.rejected, (s, a) => {
      s.savingEventMedia = false;
      s.eventMediaError = a.payload || "Error saving media";
    });

    b.addCase(createAdminEvent.pending, (s) => {
      s.savingEvent = true;
      s.saveEventError = null;
    });
    b.addCase(createAdminEvent.fulfilled, (s, a) => {
      s.savingEvent = false;
      s.eventDetail = a.payload;
    });
    b.addCase(createAdminEvent.rejected, (s, a) => {
      s.savingEvent = false;
      s.saveEventError = a.payload || "Error creating event";
    });

    b.addCase(fetchEventWaitlist.pending, (s) => {
      s.loadingWaitlist = true;
      s.waitlistError = null;
    });
    b.addCase(fetchEventWaitlist.fulfilled, (s, a) => {
      s.loadingWaitlist = false;
      s.waitlistEntries = a.payload;
    });
    b.addCase(fetchEventWaitlist.rejected, (s, a) => {
      s.loadingWaitlist = false;
      s.waitlistError = a.payload || "Error loading waitlist";
    });

    b.addCase(offerWaitlistSpot.pending, (s) => {
      s.offeringWaitlist = true;
      s.waitlistError = null;
    });
    b.addCase(offerWaitlistSpot.fulfilled, (s, a) => {
      s.offeringWaitlist = false;
      s.waitlistEntries = a.payload;
    });
    b.addCase(offerWaitlistSpot.rejected, (s, a) => {
      s.offeringWaitlist = false;
      s.waitlistError = a.payload || "Error offering waitlist spot";
    });

    b.addCase(revokeWaitlistEntry.pending, (s) => {
      s.offeringWaitlist = true;
      s.waitlistError = null;
    });
    b.addCase(revokeWaitlistEntry.fulfilled, (s, a) => {
      s.offeringWaitlist = false;
      s.waitlistEntries = a.payload;
    });
    b.addCase(revokeWaitlistEntry.rejected, (s, a) => {
      s.offeringWaitlist = false;
      s.waitlistError = a.payload || "Error revoking waitlist entry";
    });

    b.addCase(fetchResultSplits.pending, (s) => {
      s.loadingSplits = true;
      s.splitsError = null;
    });
    b.addCase(fetchResultSplits.fulfilled, (s, a) => {
      s.loadingSplits = false;
      s.resultSplits = a.payload;
    });
    b.addCase(fetchResultSplits.rejected, (s, a) => {
      s.loadingSplits = false;
      s.splitsError = a.payload || "Error loading splits";
    });

    b.addCase(updateResultSplits.pending, (s) => {
      s.savingSplits = true;
      s.splitsError = null;
    });
    b.addCase(updateResultSplits.fulfilled, (s, a) => {
      s.savingSplits = false;
      s.resultSplits = a.payload;
    });
    b.addCase(updateResultSplits.rejected, (s, a) => {
      s.savingSplits = false;
      s.splitsError = a.payload || "Error saving splits";
    });

    b.addCase(fetchAdminOrganizers.pending, (s) => {
      s.loadingAdminOrganizers = true;
      s.adminOrganizersError = null;
    });
    b.addCase(fetchAdminOrganizers.fulfilled, (s, a) => {
      s.loadingAdminOrganizers = false;
      s.adminOrganizers = a.payload;
    });
    b.addCase(fetchAdminOrganizers.rejected, (s, a) => {
      s.loadingAdminOrganizers = false;
      s.adminOrganizersError = a.payload || "Error loading organizers";
    });

    b.addCase(fetchStaffOrganizers.pending, (s) => {
      s.loadingStaffOrganizers = true;
      s.staffOrganizersError = null;
    });
    b.addCase(fetchStaffOrganizers.fulfilled, (s, a) => {
      s.loadingStaffOrganizers = false;
      s.staffOrganizers = a.payload.organizers;
      s.staffOrganizersPagination = a.payload.pagination;
    });
    b.addCase(fetchStaffOrganizers.rejected, (s, a) => {
      s.loadingStaffOrganizers = false;
      s.staffOrganizersError = a.payload || "Error loading organizers";
    });

    b.addCase(createStaffOrganizer.pending, (s) => {
      s.savingStaffOrganizer = true;
      s.staffOrganizerSaveError = null;
    });
    b.addCase(createStaffOrganizer.fulfilled, (s, a) => {
      s.savingStaffOrganizer = false;
      s.staffOrganizers = [a.payload, ...s.staffOrganizers];
    });
    b.addCase(createStaffOrganizer.rejected, (s, a) => {
      s.savingStaffOrganizer = false;
      s.staffOrganizerSaveError = a.payload || "Error creating organizer";
    });

    b.addCase(fetchStaffOrganizerDetail.pending, (s) => {
      s.loadingStaffOrganizerDetail = true;
      s.staffOrganizerDetailError = null;
    });
    b.addCase(fetchStaffOrganizerDetail.fulfilled, (s, a) => {
      s.loadingStaffOrganizerDetail = false;
      s.staffOrganizerDetail = a.payload;
    });
    b.addCase(fetchStaffOrganizerDetail.rejected, (s, a) => {
      s.loadingStaffOrganizerDetail = false;
      s.staffOrganizerDetailError = a.payload || "Error loading organizer";
    });

    b.addCase(updateStaffOrganizer.fulfilled, (s, a) => {
      s.savingStaffOrganizer = false;
      s.staffOrganizers = s.staffOrganizers.map((o) =>
        o.id === a.payload.id ? { ...o, ...a.payload } : o,
      );
      if (s.staffOrganizerDetail?.organizer.id === a.payload.id) {
        s.staffOrganizerDetail = {
          ...s.staffOrganizerDetail,
          organizer: { ...s.staffOrganizerDetail.organizer, ...a.payload },
        };
      }
    });
    b.addCase(updateStaffOrganizer.pending, (s) => {
      s.savingStaffOrganizer = true;
      s.staffOrganizerSaveError = null;
    });
    b.addCase(updateStaffOrganizer.rejected, (s, a) => {
      s.savingStaffOrganizer = false;
      s.staffOrganizerSaveError = a.payload || "Error updating organizer";
    });

    b.addCase(inviteStaffOrganizerMember.pending, (s) => {
      s.invitingStaffOrganizerMember = true;
      s.staffOrganizerMemberError = null;
    });
    b.addCase(inviteStaffOrganizerMember.fulfilled, (s, a) => {
      s.invitingStaffOrganizerMember = false;
      if (s.staffOrganizerDetail) {
        s.staffOrganizerDetail = { ...s.staffOrganizerDetail, members: a.payload };
      }
    });
    b.addCase(inviteStaffOrganizerMember.rejected, (s, a) => {
      s.invitingStaffOrganizerMember = false;
      s.staffOrganizerMemberError = a.payload || "Error inviting member";
    });

    b.addCase(updateStaffOrganizerMember.fulfilled, (s, a) => {
      if (s.staffOrganizerDetail) {
        s.staffOrganizerDetail = { ...s.staffOrganizerDetail, members: a.payload };
      }
    });

    b.addCase(assignStaffOrganizerEvents.fulfilled, (s, a) => {
      if (s.staffOrganizerDetail) {
        s.staffOrganizerDetail = { ...s.staffOrganizerDetail, events: a.payload };
      }
    });

    b.addCase(updateStaffOrganizerMemberAccess.fulfilled, (s, a) => {
      if (s.staffOrganizerDetail) {
        s.staffOrganizerDetail = { ...s.staffOrganizerDetail, members: a.payload };
      }
    });

    b.addCase(fetchStaffAdmins.pending, (s) => {
      s.loadingStaffAdmins = true;
      s.staffAdminsError = null;
    });
    b.addCase(fetchStaffAdmins.fulfilled, (s, a) => {
      s.loadingStaffAdmins = false;
      s.staffAdmins = a.payload.admins;
      s.staffAdminsPagination = a.payload.pagination;
    });
    b.addCase(fetchStaffAdmins.rejected, (s, a) => {
      s.loadingStaffAdmins = false;
      s.staffAdminsError = a.payload || "Error loading admins";
    });

    b.addCase(createStaffAdmin.pending, (s) => {
      s.savingStaffAdmin = true;
      s.staffAdminSaveError = null;
    });
    b.addCase(createStaffAdmin.fulfilled, (s, a) => {
      s.savingStaffAdmin = false;
      s.staffAdmins = [a.payload, ...s.staffAdmins];
    });
    b.addCase(createStaffAdmin.rejected, (s, a) => {
      s.savingStaffAdmin = false;
      s.staffAdminSaveError = a.payload || "Error inviting admin";
    });

    b.addCase(updateStaffAdmin.fulfilled, (s, a) => {
      s.savingStaffAdmin = false;
      s.staffAdmins = s.staffAdmins.map((admin) =>
        admin.id === a.payload.id ? a.payload : admin,
      );
    });
    b.addCase(updateStaffAdmin.pending, (s) => {
      s.savingStaffAdmin = true;
      s.staffAdminSaveError = null;
    });
    b.addCase(updateStaffAdmin.rejected, (s, a) => {
      s.savingStaffAdmin = false;
      s.staffAdminSaveError = a.payload || "Error updating admin";
    });

    b.addCase(fetchStaffRegistrationDetail.pending, (s) => {
      s.loadingStaffRegistrationDetail = true;
      s.staffRegistrationDetailError = null;
    });
    b.addCase(fetchStaffRegistrationDetail.fulfilled, (s, a) => {
      s.loadingStaffRegistrationDetail = false;
      s.staffRegistrationDetail = a.payload;
    });
    b.addCase(fetchStaffRegistrationDetail.rejected, (s, a) => {
      s.loadingStaffRegistrationDetail = false;
      s.staffRegistrationDetailError = a.payload || "Error loading registration";
    });

    b.addCase(createStaffRegistration.pending, (s) => {
      s.creatingStaffRegistration = true;
      s.createStaffRegistrationError = null;
    });
    b.addCase(createStaffRegistration.fulfilled, (s, a) => {
      s.creatingStaffRegistration = false;
      s.staffRegistrationDetail = a.payload;
    });
    b.addCase(createStaffRegistration.rejected, (s, a) => {
      s.creatingStaffRegistration = false;
      s.createStaffRegistrationError = a.payload || "Error creating registration";
    });

    b.addCase(fetchStaffPayments.pending, (s) => {
      s.loadingStaffPayments = true;
      s.staffPaymentsError = null;
    });
    b.addCase(fetchStaffPayments.fulfilled, (s, a) => {
      s.loadingStaffPayments = false;
      s.staffPayments = a.payload.payments;
      s.staffPaymentsPagination = a.payload.pagination;
    });
    b.addCase(fetchStaffPayments.rejected, (s, a) => {
      s.loadingStaffPayments = false;
      s.staffPaymentsError = a.payload || "Error loading payments";
    });

    b.addCase(fetchStaffPaymentDetail.pending, (s) => {
      s.loadingStaffPaymentDetail = true;
      s.staffPaymentDetailError = null;
    });
    b.addCase(fetchStaffPaymentDetail.fulfilled, (s, a) => {
      s.loadingStaffPaymentDetail = false;
      s.staffPaymentDetail = a.payload;
    });
    b.addCase(fetchStaffPaymentDetail.rejected, (s, a) => {
      s.loadingStaffPaymentDetail = false;
      s.staffPaymentDetailError = a.payload || "Error loading payment";
    });

    b.addCase(refundStaffPayment.pending, (s) => {
      s.refundingPayment = true;
      s.refundPaymentError = null;
    });
    b.addCase(refundStaffPayment.fulfilled, (s, a) => {
      s.refundingPayment = false;
      s.staffPayments = s.staffPayments.map((p) =>
        p.id === a.payload.id ? { ...p, status: a.payload.status } : p,
      );
      if (s.staffRegistrationDetail?.payment?.id === a.payload.id) {
        s.staffRegistrationDetail = {
          ...s.staffRegistrationDetail,
          payment: { ...s.staffRegistrationDetail.payment!, status: a.payload.status },
          registration: { ...s.staffRegistrationDetail.registration, status: "refunded" },
        };
      }
      if (s.staffPaymentDetail?.id === a.payload.id) {
        s.staffPaymentDetail = { ...s.staffPaymentDetail, status: a.payload.status };
      }
    });
    b.addCase(refundStaffPayment.rejected, (s, a) => {
      s.refundingPayment = false;
      s.refundPaymentError = a.payload || "Error refunding payment";
    });

    b.addCase(fetchSponsorAnalytics.pending, (s) => {
      s.loadingSponsorAnalytics = true;
      s.sponsorAnalyticsError = null;
    });
    b.addCase(fetchSponsorAnalytics.fulfilled, (s, a) => {
      s.loadingSponsorAnalytics = false;
      s.sponsorAnalytics = a.payload;
    });
    b.addCase(fetchSponsorAnalytics.rejected, (s, a) => {
      s.loadingSponsorAnalytics = false;
      s.sponsorAnalyticsError = a.payload || "Error loading sponsor analytics";
    });
  },
});

export const {
  clearEventDetail,
  clearEventHub,
  clearAthleteDetail,
  clearLookup,
  clearStaffOrganizerDetail,
  clearStaffRegistrationDetail,
  clearStaffPaymentDetail,
} = slice.actions;
export default slice.reducer;
