import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import i18n from "@/i18n";
import api from "@/lib/api";
import type {
  AdminAnalyticsResponse,
  AdminAthleteDetailResponse,
  AdminAthleteRow,
  AnalyticsTimeSeries,
  CheckInResponse,
  CheckInWindowInfo,
  CheckInWindowResponse,
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
  StaffFolioSegmentInput,
  StaffFolioSegmentRow,
  StaffEventCategory,
  StaffEventCategoryInput,
  StaffEventCategoryPatch,
  StaffEventExtra,
  StaffEventExtraInput,
  StaffEventExtraPatch,
  StaffEventCoursePayload,
  StaffEventDetail,
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
  RegistrationExportCatalogResponse,
  StaffMediaAssetRow,
  AdminEventCreateRequest,
  AdminOrganizerRow,
  AdminOrganizerDetailResponse,
  AdminOrganizerLinkedEvent,
  AdminOrganizerCreateRequest,
  AdminOrganizerUpdateRequest,
  OrganizerPayoutOnboardResponse,
  OrganizerPayoutProfileUpdateRequest,
  OrganizerPayoutStatusResponse,
  OrganizerSellerSalesSummaryResponse,
  AdminStaffRow,
  AdminStaffCreateRequest,
  AdminStaffUpdateRequest,
  PaginatedAdminOrganizersResponse,
  PaginatedAdminStaffResponse,
  PaginatedStaffEventsResponse,
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
  eventsPagination: PaginationInfo | null;
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
  folioSegments: StaffFolioSegmentRow[];
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
  rejectingEventApproval: boolean;
  savingCategory: boolean;
  savingExtra: boolean;
  savingSponsors: boolean;
  savingFields: boolean;
  savingWaiver: boolean;
  loadingWaves: boolean;
  savingWaves: boolean;
  loadingCourse: boolean;
  savingCourse: boolean;
  loadingDiscountCodes: boolean;
  savingDiscountCode: boolean;
  loadingFolioSegments: boolean;
  savingFolioSegments: boolean;
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
  sellerSalesSummary: OrganizerSellerSalesSummaryResponse | null;
  loadingSellerSalesSummary: boolean;
  sellerSalesSummaryError: string | null;
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
  extraError: string | null;
  sponsorsError: string | null;
  fieldsError: string | null;
  waiverError: string | null;
  wavesError: string | null;
  courseError: string | null;
  discountCodesError: string | null;
  folioSegmentsError: string | null;
  cancelRegistrationError: string | null;
  resultsError: string | null;
  bibError: string | null;
  athleteDetailError: string | null;
  lookupError: string | null;
  checkInWindow: CheckInWindowInfo | null;
  canBypassCheckInWindow: boolean;
  loadingCheckInWindow: boolean;
  checkInError: string | null;
  checkInErrorCode: string | null;
  payoutStatus: OrganizerPayoutStatusResponse | null;
  loadingPayoutStatus: boolean;
  payoutStatusError: string | null;
  savingPayoutProfile: boolean;
  acceptingPayoutTerms: boolean;
  onboardingPayouts: boolean;
  payoutOnboardError: string | null;
  syncingPayouts: boolean;
  adminOrganizerConnect: OrganizerPayoutStatusResponse | null;
  loadingAdminOrganizerConnect: boolean;
  adminOrganizerConnectError: string | null;
  adminConnectActionLoading: boolean;
  teamError: string | null;
}

const initialState: StaffPortalState = {
  dashboardStats: null,
  analytics: null,
  analyticsTimeSeries: null,
  organizerAnalytics: null,
  events: [],
  eventsPagination: null,
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
  folioSegments: [],
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
  rejectingEventApproval: false,
  savingCategory: false,
  savingExtra: false,
  savingSponsors: false,
  savingFields: false,
  savingWaiver: false,
  loadingWaves: false,
  savingWaves: false,
  loadingCourse: false,
  savingCourse: false,
  loadingDiscountCodes: false,
  savingDiscountCode: false,
  loadingFolioSegments: false,
  savingFolioSegments: false,
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
  sellerSalesSummary: null,
  loadingSellerSalesSummary: false,
  sellerSalesSummaryError: null,
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
  extraError: null,
  sponsorsError: null,
  fieldsError: null,
  waiverError: null,
  wavesError: null,
  courseError: null,
  discountCodesError: null,
  folioSegmentsError: null,
  cancelRegistrationError: null,
  resultsError: null,
  bibError: null,
  athleteDetailError: null,
  lookupError: null,
  checkInWindow: null,
  canBypassCheckInWindow: false,
  loadingCheckInWindow: false,
  checkInError: null,
  checkInErrorCode: null,
  payoutStatus: null,
  loadingPayoutStatus: false,
  payoutStatusError: null,
  savingPayoutProfile: false,
  acceptingPayoutTerms: false,
  onboardingPayouts: false,
  payoutOnboardError: null,
  syncingPayouts: false,
  adminOrganizerConnect: null,
  loadingAdminOrganizerConnect: false,
  adminOrganizerConnectError: null,
  adminConnectActionLoading: false,
  teamError: null,
};

function rejectMessage(
  e: unknown,
  fallbackKey: string,
  codeKeys?: Record<string, string>,
): string {
  const err = e as { response?: { data?: { error?: string; code?: string } } };
  const code = err?.response?.data?.code;
  if (code && codeKeys?.[code]) {
    return i18n.t(codeKeys[code]);
  }
  return err?.response?.data?.error || i18n.t(fallbackKey);
}

function rejectStaffAction(
  e: unknown,
  fallbackKey: string,
): { message: string; code?: string; window?: CheckInWindowInfo } {
  const err = e as {
    response?: { data?: { error?: string; code?: string; window?: CheckInWindowInfo } };
  };
  return {
    message: err?.response?.data?.error || i18n.t(fallbackKey),
    code: err?.response?.data?.code,
    window: err?.response?.data?.window,
  };
}

function eventBasePath(role: StaffRole, eventId?: number): string {
  if (role === "admin") {
    return eventId != null ? `/admin/events/${eventId}` : "/admin/events";
  }
  return eventId != null ? `/organizer/events/${eventId}` : "/organizer/events";
}

function hubEventBasePath(role: StaffRole, eventId: number | undefined): string | null {
  if (eventId == null || !Number.isFinite(eventId)) {
    return null;
  }
  return eventBasePath(role, eventId);
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadDashboard"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadAnalytics"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadChartData"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadAnalytics"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadAthletes"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadAthlete"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateAthlete"));
  }
});

export const fetchAdminEvents = createAsyncThunk<
  PaginatedStaffEventsResponse,
  GridListParams & { status?: string; organizerId?: number; simulation?: string },
  { rejectValue: string }
>("staffPortal/adminEvents", async ({ q, status, organizerId, simulation, page, limit, sortBy, sortDir }, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PaginatedStaffEventsResponse>("/admin/events", {
      params: {
        q: q || undefined,
        status: status || undefined,
        organizerId,
        simulation: simulation && simulation !== "all" ? simulation : undefined,
        page,
        limit,
        sortBy,
        sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadEvents"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.createEvent"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadOrganizers"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadOrganizers"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.createOrganizer"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadOrganizer"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateOrganizer"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.inviteMember"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.linkEvents"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateMemberAccess"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateMember"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadAdmins"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.inviteAdmin"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateAdmin"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadRegistration"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.createRegistration"));
  }
});

export const fetchStaffPayments = createAsyncThunk<
  PaginatedAdminPaymentsResponse,
  GridListParams & {
    status?: string;
    provider?: string;
    organizerId?: number;
    eventId?: number;
    sellerFilter?: string;
    recordedByMemberId?: number;
    role?: "admin" | "organizer";
  },
  { rejectValue: string }
>("staffPortal/fetchStaffPayments", async (params, { rejectWithValue }) => {
  try {
    const basePath = params.role === "organizer" ? "/organizer/payments" : "/admin/payments";
    const { data } = await api.get<PaginatedAdminPaymentsResponse>(basePath, {
      params: {
        q: params.q || undefined,
        status: params.status || undefined,
        provider: params.provider || undefined,
        organizerId: params.organizerId,
        eventId: params.eventId,
        sellerFilter:
          params.sellerFilter && params.sellerFilter !== "all"
            ? params.sellerFilter
            : undefined,
        recordedByMemberId: params.recordedByMemberId,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadPayments"));
  }
});

export const fetchSellerSalesSummary = createAsyncThunk<
  OrganizerSellerSalesSummaryResponse,
  void,
  { rejectValue: string }
>("staffPortal/fetchSellerSalesSummary", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<OrganizerSellerSalesSummaryResponse>(
      "/organizer/payments/seller-summary",
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadSellerSummary"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadPayment"));
  }
});

export const refundStaffPayment = createAsyncThunk<
  AdminPaymentRow,
  { paymentId: number; role: StaffRole; reason?: string },
  { rejectValue: string }
>("staffPortal/refundPayment", async ({ paymentId, role, reason }, { rejectWithValue }) => {
  try {
    const basePath = role === "organizer" ? "/organizer/payments" : "/admin/payments";
    const { data } = await api.post(`${basePath}/${paymentId}/refund`, { reason });
    return data.payment as AdminPaymentRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.refundPayment"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadSponsorAnalytics"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadWaitlist"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.offerWaitlistSpot"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.revokeWaitlistEntry"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadSplits"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveSplits"));
  }
});

export const fetchOrganizerEvents = createAsyncThunk<
  PaginatedStaffEventsResponse,
  GridListParams & { status?: string; simulation?: string },
  { rejectValue: string }
>("staffPortal/organizerEvents", async (params = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get<PaginatedStaffEventsResponse>("/organizer/events", {
      params: {
        q: params.q || undefined,
        status: params.status || undefined,
        simulation:
          params.simulation && params.simulation !== "all"
            ? params.simulation
            : undefined,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadEvents"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadEvent"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.createEvent"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveEvent"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.publishEvent"));
  }
});

export const deactivateStaffEventListing = createAsyncThunk<
  { ok: true; event: StaffEventDetail },
  { eventId: number; role: StaffRole },
  { rejectValue: string }
>("staffPortal/deactivateListing", async ({ eventId, role }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`${eventBasePath(role, eventId)}/deactivate-listing`);
    return data as { ok: true; event: StaffEventDetail };
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.deactivateEvent"));
  }
});

export const deleteStaffEvent = createAsyncThunk<
  { ok: true; cancelledRegistrations: number },
  { eventId: number; role: StaffRole },
  { rejectValue: string }
>("staffPortal/deleteEvent", async ({ eventId, role }, { rejectWithValue }) => {
  try {
    const { data } = await api.delete(`${eventBasePath(role, eventId)}`);
    return data as { ok: true; cancelledRegistrations: number };
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.deleteEvent"));
  }
});

export const rejectStaffEventApproval = createAsyncThunk<
  StaffEventDetailResponse,
  { eventId: number },
  { rejectValue: string }
>("staffPortal/rejectEventApproval", async ({ eventId }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{
      event: StaffEventDetailResponse["event"];
      categories?: StaffEventCategory[];
    }>(`/admin/events/${eventId}/reject`);
    return {
      event: data.event,
      categories: data.categories ?? [],
    };
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.rejectEvent"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.addCategory"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.removeCategory"));
  }
});

export const addEventExtra = createAsyncThunk<
  StaffEventExtra[],
  { eventId: number; body: StaffEventExtraInput; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/addExtra", async ({ eventId, body, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.post(`${base}/${eventId}/extras`, body);
    return data.extras as StaffEventExtra[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.addExtra"));
  }
});

export const updateEventExtra = createAsyncThunk<
  StaffEventExtra[],
  {
    eventId: number;
    extraId: number;
    body: StaffEventExtraPatch;
    role?: StaffRole;
  },
  { rejectValue: string }
>("staffPortal/updateExtra", async ({ eventId, extraId, body, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.patch(`${base}/${eventId}/extras/${extraId}`, body);
    return data.extras as StaffEventExtra[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateExtra"));
  }
});

export const deleteEventExtra = createAsyncThunk<
  StaffEventExtra[],
  { eventId: number; extraId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/deleteExtra", async ({ eventId, extraId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.delete(`${base}/${eventId}/extras/${extraId}`);
    return data.extras as StaffEventExtra[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.removeExtra"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadSponsors"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveSponsors"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadEventSummary"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadRegistrations"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadRegistrations"));
  }
});

export const fetchCheckInWindow = createAsyncThunk<
  CheckInWindowResponse,
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/checkInWindow", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get<CheckInWindowResponse>(`${base}/${eventId}/check-in/window`);
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadCheckInWindow"));
  }
});

export const lookupRegistration = createAsyncThunk<
  RegistrationLookupResponse["registration"],
  { q: string; eventId?: number; role?: StaffRole },
  { rejectValue: { message: string; window?: CheckInWindowInfo } }
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
    const rejected = rejectStaffAction(e, "staffPortal.errors.registrationNotFound");
    return rejectWithValue({ message: rejected.message, window: rejected.window });
  }
});

export const checkInRegistration = createAsyncThunk<
  CheckInResponse["registration"],
  {
    registrationId: number;
    eventId?: number;
    role?: StaffRole;
    force?: boolean;
    bypassWindow?: boolean;
    method?: "qr_scan" | "manual" | "kiosk" | "api";
  },
  { rejectValue: { message: string; code?: string; window?: CheckInWindowInfo } }
>("staffPortal/checkIn", async (
  { registrationId, eventId, role = "organizer", force, bypassWindow, method = "manual" },
  { rejectWithValue },
) => {
  try {
    const base = hubEventBasePath(role, eventId);
    if (!base) {
      return rejectWithValue({
        message: i18n.t("staffPortal.errors.eventIdRequired"),
      });
    }
    const body = {
      method,
      ...(force ? { force: true } : {}),
      ...(bypassWindow ? { bypass_window: true } : {}),
    };
    const { data } = await api.post(
      `${base}/registrations/${registrationId}/check-in`,
      body,
    );
    return data.registration as CheckInResponse["registration"];
  } catch (e: unknown) {
    return rejectWithValue(rejectStaffAction(e, "staffPortal.errors.checkInFailed"));
  }
});

export const fetchOrganizerPayoutStatus = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  void,
  { rejectValue: string }
>("staffPortal/payoutStatus", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<OrganizerPayoutStatusResponse>("/organizer/payouts/status");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadPayoutStatus"));
  }
});

export const updateOrganizerPayoutProfile = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  OrganizerPayoutProfileUpdateRequest,
  { rejectValue: string }
>("staffPortal/payoutProfile", async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.patch<OrganizerPayoutStatusResponse>("/organizer/payouts/profile", body);
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.savePayoutProfile"));
  }
});

export const acceptOrganizerPayoutTerms = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  void,
  { rejectValue: string }
>("staffPortal/payoutTerms", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutStatusResponse>("/organizer/payouts/accept-terms");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.acceptPayoutTerms"));
  }
});

export const onboardOrganizerPayouts = createAsyncThunk<
  OrganizerPayoutOnboardResponse,
  void,
  { rejectValue: string }
>("staffPortal/payoutOnboard", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutOnboardResponse>("/organizer/payouts/onboard");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(
      rejectMessage(e, "staffPortal.errors.startPayoutVerification", {
        connect_not_enabled: "staffPortal.errors.connectNotEnabled",
        connect_onboard_failed: "staffPortal.errors.startPayoutVerification",
      }),
    );
  }
});

export const syncOrganizerPayouts = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  void,
  { rejectValue: string }
>("staffPortal/payoutSync", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutStatusResponse>("/organizer/payouts/sync");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.syncPayoutStatus"));
  }
});

export const setOrganizerPayoutRail = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  "stripe" | "mercadopago",
  { rejectValue: string }
>("staffPortal/payoutRail", async (payout_rail, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutStatusResponse>("/organizer/payouts/rail", {
      payout_rail,
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.savePayoutRail"));
  }
});

export const startMercadoPagoOauth = createAsyncThunk<
  { url: string },
  void,
  { rejectValue: string }
>("staffPortal/mpOauthStart", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<{ url: string }>("/organizer/payouts/mp/oauth/start");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.mpOauthStart"));
  }
});

export const loginOrganizerPayoutDashboard = createAsyncThunk<
  { url: string },
  void,
  { rejectValue: string }
>("staffPortal/payoutLogin", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{ url: string }>("/organizer/payouts/login");
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.openPayoutDashboard"));
  }
});

export const fetchAdminOrganizerConnect = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  { organizerId: number },
  { rejectValue: string }
>("staffPortal/adminConnectStatus", async ({ organizerId }, { rejectWithValue }) => {
  try {
    const { data } = await api.get<OrganizerPayoutStatusResponse>(
      `/admin/organizers/${organizerId}/connect`,
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadConnectStatus"));
  }
});

export const adminOnboardOrganizerConnect = createAsyncThunk<
  OrganizerPayoutOnboardResponse,
  { organizerId: number },
  { rejectValue: string }
>("staffPortal/adminConnectOnboard", async ({ organizerId }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutOnboardResponse>(
      `/admin/organizers/${organizerId}/connect/onboard`,
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(
      rejectMessage(e, "staffPortal.errors.startAssistedOnboarding", {
        connect_not_enabled: "staffPortal.errors.connectNotEnabled",
        connect_onboard_failed: "staffPortal.errors.startAssistedOnboarding",
      }),
    );
  }
});

export const adminSyncOrganizerConnect = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  { organizerId: number },
  { rejectValue: string }
>("staffPortal/adminConnectSync", async ({ organizerId }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutStatusResponse>(
      `/admin/organizers/${organizerId}/connect/sync`,
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.syncConnectStatus"));
  }
});

export const adminLinkOrganizerConnectAccount = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  { organizerId: number; stripe_account_id: string },
  { rejectValue: string }
>("staffPortal/adminConnectLink", async ({ organizerId, stripe_account_id }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutStatusResponse>(
      `/admin/organizers/${organizerId}/connect/link-account`,
      { stripe_account_id },
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.linkPayoutAccount"));
  }
});

export const adminDisableOrganizerConnect = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  { organizerId: number },
  { rejectValue: string }
>("staffPortal/adminConnectDisable", async ({ organizerId }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutStatusResponse>(
      `/admin/organizers/${organizerId}/connect/disable`,
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.disablePayouts"));
  }
});

export const adminEnableOrganizerConnect = createAsyncThunk<
  OrganizerPayoutStatusResponse,
  { organizerId: number },
  { rejectValue: string }
>("staffPortal/adminConnectEnable", async ({ organizerId }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<OrganizerPayoutStatusResponse>(
      `/admin/organizers/${organizerId}/connect/enable`,
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.enablePayouts"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadTeam"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.inviteMember"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateMember"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateCategory"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadFields"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveFields"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadWaivers"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveWaivers"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadWaves"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveWaves"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadCourse"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveCourse"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadDiscountCodes"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.createDiscountCode"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateDiscountCode"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.deleteDiscountCode"));
  }
});

export const fetchFolioSegments = createAsyncThunk<
  StaffFolioSegmentRow[],
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/fetchFolioSegments", async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.get(`${base}/${eventId}/folio-segments`);
    return data.segments as StaffFolioSegmentRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadFolioSegments"));
  }
});

export const updateFolioSegments = createAsyncThunk<
  StaffFolioSegmentRow[],
  { eventId: number; segments: StaffFolioSegmentInput[]; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/updateFolioSegments", async ({ eventId, segments, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = role === "admin" ? "/admin/events" : "/organizer/events";
    const { data } = await api.put(`${base}/${eventId}/folio-segments`, { segments });
    return data.segments as StaffFolioSegmentRow[];
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.saveFolioSegments"));
  }
});

export const cancelRegistration = createAsyncThunk<
  OrganizerRegistrationRow,
  { registrationId: number; eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/cancelRegistration", async ({ registrationId, eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = hubEventBasePath(role, eventId);
    if (!base) {
      return rejectWithValue(i18n.t("staffPortal.errors.eventIdRequired"));
    }
    const { data } = await api.patch(`${base}/registrations/${registrationId}/cancel`);
    return data.registration as OrganizerRegistrationRow;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.cancelRegistration"));
  }
});

export const assignRegistrationBib = createAsyncThunk<
  { id: number; bib_number: string | null },
  { registrationId: number; bib_number: string | null; eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/assignBib", async ({ registrationId, bib_number, eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = hubEventBasePath(role, eventId);
    if (!base) {
      return rejectWithValue(i18n.t("staffPortal.errors.eventIdRequired"));
    }
    const { data } = await api.patch(`${base}/registrations/${registrationId}/bib`, {
      bib_number,
    });
    return {
      id: data.registration.id as number,
      bib_number: data.registration.bib_number as string | null,
    };
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.assignBib"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadResults"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.importResults"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.publishResults"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.deleteResult"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.sendMessages"));
  }
});

export const bulkAssignBibs = createAsyncThunk<
  BulkBibImportResponse,
  { rows: BulkBibRow[]; eventId?: number; role?: StaffRole },
  { rejectValue: string }
>("staffPortal/bulkAssignBibs", async ({ rows, eventId, role = "organizer" }, { rejectWithValue }) => {
  try {
    const base = hubEventBasePath(role, eventId);
    if (!base) {
      return rejectWithValue(i18n.t("staffPortal.errors.eventIdRequired"));
    }
    const { data } = await api.post<BulkBibImportResponse>(
      `${base}/registrations/bulk-bib`,
      { rows },
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.importBibNumbers"));
  }
});

export const fetchRegistrationExportCatalog = createAsyncThunk<
  RegistrationExportCatalogResponse,
  { eventId: number; role?: StaffRole },
  { rejectValue: string }
>(
  "staffPortal/fetchRegistrationExportCatalog",
  async ({ eventId, role = "organizer" }, { rejectWithValue }) => {
    try {
      const base = hubEventBasePath(role, eventId);
      if (!base) {
        return rejectWithValue(i18n.t("staffPortal.errors.eventIdRequired"));
      }
      const { data } = await api.get<RegistrationExportCatalogResponse>(
        `${base}/registrations/export-catalog`,
      );
      return data;
    } catch (e: unknown) {
      return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadExportCatalog"));
    }
  },
);

export const exportEventRegistrationsCsv = createAsyncThunk<
  { filename: string; rowCount: number },
  {
    eventId: number;
    role?: StaffRole;
    columns: string[];
    statuses: string[];
    q?: string;
  },
  { rejectValue: string }
>(
  "staffPortal/exportEventRegistrationsCsv",
  async ({ eventId, role = "organizer", columns, statuses, q }, { rejectWithValue }) => {
    try {
      const base = hubEventBasePath(role, eventId);
      if (!base) {
        return rejectWithValue(i18n.t("staffPortal.errors.eventIdRequired"));
      }
      const response = await api.post(
        `${base}/registrations/export`,
        { columns, statuses, q: q || undefined, format: "csv" },
        { responseType: "blob" },
      );
      const contentType = String(response.headers["content-type"] ?? "");
      if (contentType.includes("application/json")) {
        const text = await (response.data as Blob).text();
        try {
          const parsed = JSON.parse(text) as { error?: string };
          return rejectWithValue(parsed.error || i18n.t("staffPortal.errors.exportRegistrations"));
        } catch {
          return rejectWithValue(i18n.t("staffPortal.errors.exportRegistrations"));
        }
      }

      const disposition = String(response.headers["content-disposition"] ?? "");
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "registrations-export.csv";
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      return { filename, rowCount: -1 };
    } catch (e: unknown) {
      const err = e as { response?: { data?: Blob | { error?: string } } };
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) return rejectWithValue(parsed.error);
        } catch {
          /* fall through */
        }
      }
      return rejectWithValue(rejectMessage(e, "staffPortal.errors.exportRegistrations"));
    }
  },
);

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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.loadEventMedia"));
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
    return rejectWithValue(rejectMessage(e, "staffPortal.errors.updateEventMedia"));
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
      state.checkInWindow = null;
    },
    clearStaffOrganizerDetail(state) {
      state.staffOrganizerDetail = null;
      state.staffOrganizerDetailError = null;
      state.staffOrganizerMemberError = null;
      state.staffOrganizerSaveError = null;
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
      s.events = a.payload.events;
      s.eventsPagination = a.payload.pagination;
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
      s.events = a.payload.events;
      s.eventsPagination = a.payload.pagination;
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

    b.addCase(deactivateStaffEventListing.fulfilled, (s, a) => {
      if (s.eventDetail?.event?.id === a.payload.event.id) {
        s.eventDetail = {
          ...s.eventDetail,
          event: a.payload.event,
          categories: s.eventDetail.categories ?? [],
        };
      }
      s.events = s.events.map((ev) =>
        ev.id === a.payload.event.id
          ? { ...ev, visibility: a.payload.event.visibility }
          : ev,
      );
    });

    b.addCase(deleteStaffEvent.fulfilled, (s, a) => {
      const id = Number(
        (a.meta.arg as { eventId: number }).eventId,
      );
      s.events = s.events.filter((ev) => ev.id !== id);
      if (s.eventDetail?.event?.id === id) {
        s.eventDetail = null;
      }
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

    b.addCase(rejectStaffEventApproval.pending, (s) => {
      s.rejectingEventApproval = true;
      s.publishError = null;
    });
    b.addCase(rejectStaffEventApproval.fulfilled, (s, a) => {
      s.rejectingEventApproval = false;
      s.eventDetail = a.payload;
    });
    b.addCase(rejectStaffEventApproval.rejected, (s, a) => {
      s.rejectingEventApproval = false;
      s.publishError = a.payload || "Error rejecting event";
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

    b.addCase(addEventExtra.pending, (s) => {
      s.savingExtra = true;
      s.extraError = null;
    });
    b.addCase(addEventExtra.fulfilled, (s, a) => {
      s.savingExtra = false;
      if (s.eventDetail) s.eventDetail.extras = a.payload;
    });
    b.addCase(addEventExtra.rejected, (s, a) => {
      s.savingExtra = false;
      s.extraError = a.payload || "Error adding extra";
    });
    b.addCase(updateEventExtra.pending, (s) => {
      s.savingExtra = true;
      s.extraError = null;
    });
    b.addCase(updateEventExtra.fulfilled, (s, a) => {
      s.savingExtra = false;
      if (s.eventDetail) s.eventDetail.extras = a.payload;
    });
    b.addCase(updateEventExtra.rejected, (s, a) => {
      s.savingExtra = false;
      s.extraError = a.payload || "Error updating extra";
    });
    b.addCase(deleteEventExtra.pending, (s) => {
      s.savingExtra = true;
      s.extraError = null;
    });
    b.addCase(deleteEventExtra.fulfilled, (s, a) => {
      s.savingExtra = false;
      if (s.eventDetail) s.eventDetail.extras = a.payload;
    });
    b.addCase(deleteEventExtra.rejected, (s, a) => {
      s.savingExtra = false;
      s.extraError = a.payload || "Error removing extra";
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
      s.lookupError = a.payload?.message || "Not found";
      if (a.payload?.window) {
        s.checkInWindow = a.payload.window;
      }
    });

    b.addCase(fetchCheckInWindow.pending, (s) => {
      s.loadingCheckInWindow = true;
    });
    b.addCase(fetchCheckInWindow.fulfilled, (s, a) => {
      s.loadingCheckInWindow = false;
      s.checkInWindow = a.payload.window;
      s.canBypassCheckInWindow = Boolean(a.payload.canBypassWindow);
    });
    b.addCase(fetchCheckInWindow.rejected, (s) => {
      s.loadingCheckInWindow = false;
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
      if (a.payload?.window) {
        s.checkInWindow = a.payload.window;
      }
    });

    b.addCase(fetchOrganizerPayoutStatus.pending, (s) => {
      s.loadingPayoutStatus = true;
      s.payoutStatusError = null;
    });
    b.addCase(fetchOrganizerPayoutStatus.fulfilled, (s, a) => {
      s.loadingPayoutStatus = false;
      s.payoutStatus = a.payload;
    });
    b.addCase(fetchOrganizerPayoutStatus.rejected, (s, a) => {
      s.loadingPayoutStatus = false;
      s.payoutStatusError = a.payload || "Error loading payouts";
    });

    b.addCase(updateOrganizerPayoutProfile.pending, (s) => {
      s.savingPayoutProfile = true;
    });
    b.addCase(updateOrganizerPayoutProfile.fulfilled, (s, a) => {
      s.savingPayoutProfile = false;
      s.payoutStatus = a.payload;
    });
    b.addCase(updateOrganizerPayoutProfile.rejected, (s) => {
      s.savingPayoutProfile = false;
    });

    b.addCase(acceptOrganizerPayoutTerms.pending, (s) => {
      s.acceptingPayoutTerms = true;
    });
    b.addCase(acceptOrganizerPayoutTerms.fulfilled, (s, a) => {
      s.acceptingPayoutTerms = false;
      s.payoutStatus = a.payload;
    });
    b.addCase(acceptOrganizerPayoutTerms.rejected, (s) => {
      s.acceptingPayoutTerms = false;
    });

    b.addCase(onboardOrganizerPayouts.pending, (s) => {
      s.onboardingPayouts = true;
      s.payoutOnboardError = null;
    });
    b.addCase(onboardOrganizerPayouts.fulfilled, (s, a) => {
      s.onboardingPayouts = false;
      s.payoutOnboardError = null;
      s.payoutStatus = a.payload;
    });
    b.addCase(onboardOrganizerPayouts.rejected, (s, a) => {
      s.onboardingPayouts = false;
      s.payoutOnboardError = a.payload || null;
    });

    b.addCase(syncOrganizerPayouts.pending, (s) => {
      s.syncingPayouts = true;
    });
    b.addCase(syncOrganizerPayouts.fulfilled, (s, a) => {
      s.syncingPayouts = false;
      s.payoutStatus = a.payload;
    });
    b.addCase(syncOrganizerPayouts.rejected, (s) => {
      s.syncingPayouts = false;
    });

    b.addCase(setOrganizerPayoutRail.fulfilled, (s, a) => {
      s.payoutStatus = a.payload;
    });

    b.addCase(fetchAdminOrganizerConnect.pending, (s) => {
      s.loadingAdminOrganizerConnect = true;
      s.adminOrganizerConnectError = null;
    });
    b.addCase(fetchAdminOrganizerConnect.fulfilled, (s, a) => {
      s.loadingAdminOrganizerConnect = false;
      s.adminOrganizerConnect = a.payload;
    });
    b.addCase(fetchAdminOrganizerConnect.rejected, (s, a) => {
      s.loadingAdminOrganizerConnect = false;
      s.adminOrganizerConnectError = a.payload || "Error loading Connect";
    });

    const adminConnectDone = (
      s: typeof initialState,
      a: { payload: OrganizerPayoutStatusResponse },
    ) => {
      s.adminConnectActionLoading = false;
      s.adminOrganizerConnect = a.payload;
    };
    b.addCase(adminOnboardOrganizerConnect.pending, (s) => {
      s.adminConnectActionLoading = true;
    });
    b.addCase(adminOnboardOrganizerConnect.fulfilled, adminConnectDone);
    b.addCase(adminOnboardOrganizerConnect.rejected, (s) => {
      s.adminConnectActionLoading = false;
    });
    b.addCase(adminSyncOrganizerConnect.pending, (s) => {
      s.adminConnectActionLoading = true;
    });
    b.addCase(adminSyncOrganizerConnect.fulfilled, adminConnectDone);
    b.addCase(adminSyncOrganizerConnect.rejected, (s) => {
      s.adminConnectActionLoading = false;
    });
    b.addCase(adminLinkOrganizerConnectAccount.pending, (s) => {
      s.adminConnectActionLoading = true;
    });
    b.addCase(adminLinkOrganizerConnectAccount.fulfilled, adminConnectDone);
    b.addCase(adminLinkOrganizerConnectAccount.rejected, (s) => {
      s.adminConnectActionLoading = false;
    });
    b.addCase(adminDisableOrganizerConnect.pending, (s) => {
      s.adminConnectActionLoading = true;
    });
    b.addCase(adminDisableOrganizerConnect.fulfilled, adminConnectDone);
    b.addCase(adminDisableOrganizerConnect.rejected, (s) => {
      s.adminConnectActionLoading = false;
    });
    b.addCase(adminEnableOrganizerConnect.pending, (s) => {
      s.adminConnectActionLoading = true;
    });
    b.addCase(adminEnableOrganizerConnect.fulfilled, adminConnectDone);
    b.addCase(adminEnableOrganizerConnect.rejected, (s) => {
      s.adminConnectActionLoading = false;
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

    b.addCase(fetchFolioSegments.pending, (s) => {
      s.loadingFolioSegments = true;
      s.folioSegmentsError = null;
    });
    b.addCase(fetchFolioSegments.fulfilled, (s, a) => {
      s.loadingFolioSegments = false;
      s.folioSegments = a.payload;
    });
    b.addCase(fetchFolioSegments.rejected, (s, a) => {
      s.loadingFolioSegments = false;
      s.folioSegmentsError = a.payload || "Error loading folio segments";
    });
    b.addCase(updateFolioSegments.pending, (s) => {
      s.savingFolioSegments = true;
      s.folioSegmentsError = null;
    });
    b.addCase(updateFolioSegments.fulfilled, (s, a) => {
      s.savingFolioSegments = false;
      s.folioSegments = a.payload;
    });
    b.addCase(updateFolioSegments.rejected, (s, a) => {
      s.savingFolioSegments = false;
      s.folioSegmentsError = a.payload || "Error saving folio segments";
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
      s.staffOrganizerSaveError = null;
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

    b.addCase(fetchSellerSalesSummary.pending, (s) => {
      s.loadingSellerSalesSummary = true;
      s.sellerSalesSummaryError = null;
    });
    b.addCase(fetchSellerSalesSummary.fulfilled, (s, a) => {
      s.loadingSellerSalesSummary = false;
      s.sellerSalesSummary = a.payload;
    });
    b.addCase(fetchSellerSalesSummary.rejected, (s, a) => {
      s.loadingSellerSalesSummary = false;
      s.sellerSalesSummaryError = a.payload || "Error loading seller summary";
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
