import { configureStore } from "@reduxjs/toolkit";
import athleteAuthReducer from "./slices/athleteAuthSlice";
import staffAuthReducer from "./slices/staffAuthSlice";
import athletePortalReducer from "./slices/athletePortalSlice";
import staffPortalReducer from "./slices/staffPortalSlice";
import marketplaceReducer from "./slices/marketplaceSlice";
import registrationCheckoutReducer from "./slices/registrationCheckoutSlice";
import appConfigReducer from "./slices/appConfigSlice";

export const store = configureStore({
  reducer: {
    athleteAuth: athleteAuthReducer,
    staffAuth: staffAuthReducer,
    athletePortal: athletePortalReducer,
    staffPortal: staffPortalReducer,
    marketplace: marketplaceReducer,
    registrationCheckout: registrationCheckoutReducer,
    appConfig: appConfigReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
