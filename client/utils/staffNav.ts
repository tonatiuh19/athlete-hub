import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calendar,
  CreditCard,
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

const ADMIN_NAV: StaffNavItem[] = [
  { to: "/staff", end: true, labelKey: "staffPortal.nav.dashboard", icon: LayoutDashboard },
  { to: "/staff/athletes", labelKey: "staffPortal.nav.athletes", icon: Users },
  { to: "/staff/people", labelKey: "staffPortal.nav.staffManagement", icon: UserCog },
  { to: "/staff/events", labelKey: "staffPortal.nav.events", icon: Calendar },
  { to: "/staff/payments", labelKey: "staffPortal.nav.payments", icon: CreditCard },
  { to: "/staff/analytics", labelKey: "staffPortal.nav.analytics", icon: BarChart3 },
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
      return withMessagingNav([dashboard, events, registrations, settings], role);
    case "marketing":
      return withMessagingNav([dashboard, events, analytics, settings], role);
    case "finance":
      return withMessagingNav([dashboard, registrations, payments, analytics, settings], role);
    case "sponsor":
      return withMessagingNav([dashboard, events, settings], role);
    case "owner":
    case "organizer":
    default:
      return withMessagingNav(
        [dashboard, events, registrations, payments, analytics, team, settings],
        role,
      );
  }
}

export function getStaffNav(isAdmin: boolean, organizerRole?: string): StaffNavItem[] {
  if (isAdmin) return ADMIN_NAV;
  return organizerNav(organizerRole ?? "organizer");
}

export function canOrganizerEditEvents(role: string): boolean {
  return ["owner", "organizer", "operations", "marketing"].includes(role);
}

export function canOrganizerManageTeam(role: string): boolean {
  return role === "owner";
}

export function canOrganizerCreateEvents(role: string): boolean {
  return ["owner", "organizer", "operations", "marketing"].includes(role);
}

export function canViewStaffPayments(isAdmin: boolean, organizerRole?: string): boolean {
  if (isAdmin) return true;
  return ["owner", "organizer", "finance"].includes(organizerRole ?? "");
}
