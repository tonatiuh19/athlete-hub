import type { LucideIcon } from "lucide-react";
import {
  canOrganizerCreateEvents as sharedCanOrganizerCreateEvents,
  canOrganizerEditEvents as sharedCanOrganizerEditEvents,
  canOrganizerManageRegistrations as sharedCanOrganizerManageRegistrations,
  canOrganizerManageSimulations as sharedCanOrganizerManageSimulations,
  canOrganizerRecordManualSale as sharedCanOrganizerRecordManualSale,
  canOrganizerViewAllPayments as sharedCanOrganizerViewAllPayments,
  canOrganizerViewPayments as sharedCanOrganizerViewPayments,
  canOrganizerViewSellerSalesSummary as sharedCanOrganizerViewSellerSalesSummary,
} from "@shared/staffRoles";
import {
  BarChart3,
  Banknote,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  LayoutDashboard,
  Mail,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

export interface StaffNavItem {
  to: string;
  end?: boolean;
  labelKey: string;
  icon: LucideIcon;
}

const MESSAGING_NAV: StaffNavItem = {
  to: "/staff/messaging",
  labelKey: "staffPortal.nav.messaging",
  icon: Mail,
};

function withMessagingNav(items: StaffNavItem[], role: string): StaffNavItem[] {
  if (!canOrganizerEditEvents(role)) return items;
  const settingsIdx = items.findIndex((i) => i.to === "/staff/settings");
  if (settingsIdx >= 0) {
    return [
      ...items.slice(0, settingsIdx),
      MESSAGING_NAV,
      ...items.slice(settingsIdx),
    ];
  }
  return [...items, MESSAGING_NAV];
}

const BLOG_NAV: StaffNavItem = {
  to: "/staff/blog",
  labelKey: "staffPortal.nav.blog",
  icon: FileText,
};

const ADMIN_NAV: StaffNavItem[] = [
  { to: "/staff", end: true, labelKey: "staffPortal.nav.dashboard", icon: LayoutDashboard },
  { to: "/staff/athletes", labelKey: "staffPortal.nav.athletes", icon: Users },
  { to: "/staff/people", labelKey: "staffPortal.nav.staffManagement", icon: UserCog },
  { to: "/staff/events", labelKey: "staffPortal.nav.events", icon: Calendar },
  BLOG_NAV,
  { to: "/staff/payments", labelKey: "staffPortal.nav.payments", icon: CreditCard },
  { to: "/staff/analytics", labelKey: "staffPortal.nav.analytics", icon: BarChart3 },
  { to: "/staff/site-settings", labelKey: "staffPortal.nav.siteSettings", icon: Globe },
  { to: "/staff/profile", labelKey: "staffPortal.nav.profile", icon: Settings },
];

function organizerNav(role: string): StaffNavItem[] {
  const dashboard: StaffNavItem = {
    to: "/staff",
    end: true,
    labelKey: "staffPortal.nav.dashboard",
    icon: LayoutDashboard,
  };
  const events: StaffNavItem = {
    to: "/staff/events",
    labelKey: "staffPortal.nav.myEvents",
    icon: Calendar,
  };
  const registrations: StaffNavItem = {
    to: "/staff/registrations",
    labelKey: "staffPortal.nav.registrations",
    icon: Users,
  };
  const payments: StaffNavItem = {
    to: "/staff/payments",
    labelKey: "staffPortal.nav.payments",
    icon: CreditCard,
  };
  const payouts: StaffNavItem = {
    to: "/staff/payouts",
    labelKey: "staffPortal.nav.payouts",
    icon: Banknote,
  };
  const analytics: StaffNavItem = {
    to: "/staff/analytics",
    labelKey: "staffPortal.nav.analytics",
    icon: BarChart3,
  };
  const team: StaffNavItem = {
    to: "/staff/team",
    labelKey: "staffPortal.nav.team",
    icon: UserCog,
  };
  const settings: StaffNavItem = {
    to: "/staff/profile",
    labelKey: "staffPortal.nav.profile",
    icon: Settings,
  };

  switch (role) {
    case "timing":
      return withMessagingNav([dashboard, registrations, events], role);
    case "operations":
      return withMessagingNav([dashboard, events, BLOG_NAV, registrations, settings], role);
    case "marketing":
      return withMessagingNav([dashboard, events, BLOG_NAV, analytics, settings], role);
    case "finance":
      return withMessagingNav([dashboard, registrations, payments, payouts, analytics, settings], role);
    case "seller":
      return [dashboard, payments, settings];
    case "sponsor":
      return withMessagingNav([dashboard, events, settings], role);
    case "owner":
    case "organizer":
    default:
      return withMessagingNav(
        [
          dashboard,
          events,
          BLOG_NAV,
          registrations,
          payments,
          payouts,
          analytics,
          team,
          settings,
        ],
        role,
      );
  }
}

export function getStaffNav(isAdmin: boolean, organizerRole?: string): StaffNavItem[] {
  if (isAdmin) return ADMIN_NAV;
  return organizerNav(organizerRole ?? "organizer");
}

export function canOrganizerEditEvents(role: string): boolean {
  return sharedCanOrganizerEditEvents(role);
}

export function canOrganizerManageRegistrations(role: string): boolean {
  return sharedCanOrganizerManageRegistrations(role);
}

/** Admin always; organizer members via REGISTRATION_OPS_ROLES (includes timing). */
export function canStaffManageRegistrations(
  isAdmin: boolean,
  organizerRole?: string,
): boolean {
  if (isAdmin) return true;
  return sharedCanOrganizerManageRegistrations(organizerRole ?? "");
}

export function canOrganizerManageTeam(role: string): boolean {
  return role === "owner";
}

export function canOrganizerCreateEvents(role: string): boolean {
  return sharedCanOrganizerCreateEvents(role);
}

export function canOrganizerManageSimulations(role: string): boolean {
  return sharedCanOrganizerManageSimulations(role);
}

export function canOrganizerRecordManualSale(role: string): boolean {
  return sharedCanOrganizerRecordManualSale(role);
}

export function canViewStaffPayments(isAdmin: boolean, organizerRole?: string): boolean {
  if (isAdmin) return true;
  return sharedCanOrganizerViewPayments(organizerRole ?? "");
}

export function canViewAllStaffPayments(isAdmin: boolean, organizerRole?: string): boolean {
  if (isAdmin) return true;
  return sharedCanOrganizerViewAllPayments(organizerRole ?? "");
}

export function canViewSellerSalesSummary(isAdmin: boolean, organizerRole?: string): boolean {
  if (isAdmin) return false;
  return sharedCanOrganizerViewSellerSalesSummary(organizerRole ?? "");
}

/** Organizer self-serve payout setup (same roles as payments for finance/owner). */
export function canAccessStaffPayouts(isAdmin: boolean, organizerRole?: string): boolean {
  if (isAdmin) return false;
  return ["owner", "organizer", "finance"].includes(organizerRole ?? "");
}

/** Refund permissions — sellers can record sales but not refund. */
export function canRefundStaffPayments(isAdmin: boolean, organizerRole?: string): boolean {
  if (isAdmin) return true;
  return ["owner", "organizer", "finance"].includes(organizerRole ?? "");
}

/** $0 / free / coupon-covered payments have nothing to refund. */
export function isStaffPaymentRefundable(payment: {
  status: string;
  amount_cents: number;
}): boolean {
  return payment.status === "succeeded" && Number(payment.amount_cents) > 0;
}
