import { closeRegistrationWizard } from "@/store/slices/registrationCheckoutSlice";
import type { AppDispatch } from "@/store";
import { clearRegistrationSession } from "@/utils/registrationSessionStorage";

/** Close the modal and wipe in-progress checkout session (never leave stale resume data). */
export function dismissRegistrationWizard(dispatch: AppDispatch) {
  clearRegistrationSession();
  dispatch(closeRegistrationWizard());
}
