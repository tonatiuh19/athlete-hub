/** True for organizer/admin console routes (not public marketplace). */
export function isStaffConsolePath(pathname: string): boolean {
  return pathname === "/staff" || pathname.startsWith("/staff/");
}
