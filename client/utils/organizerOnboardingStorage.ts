const ORGANIZER_ONBOARDING_DISMISSED_KEY = "athlete_hub_staff_onboarding_dismissed";

export function isOrganizerOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ORGANIZER_ONBOARDING_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOrganizerOnboarding(): void {
  try {
    localStorage.setItem(ORGANIZER_ONBOARDING_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}
