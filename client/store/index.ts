import { configureStore } from "@reduxjs/toolkit";
import athleteAuthReducer from "./slices/athleteAuthSlice";
import staffAuthReducer from "./slices/staffAuthSlice";
import athletePortalReducer from "./slices/athletePortalSlice";
import athleteTeamsReducer from "./slices/athleteTeamsSlice";
import gamificationReducer from "./slices/gamificationSlice";
import staffPortalReducer from "./slices/staffPortalSlice";
import marketplaceReducer from "./slices/marketplaceSlice";
import registrationCheckoutReducer from "./slices/registrationCheckoutSlice";
import paymentMethodsReducer from "./slices/paymentMethodsSlice";
import appConfigReducer from "./slices/appConfigSlice";
import publicHomeReducer from "./slices/publicHomeSlice";
import publicTeamsReducer from "./slices/publicTeamsSlice";
import blogsReducer from "./slices/blogsSlice";
import geoReducer from "./slices/geoSlice";

export const store = configureStore({
  reducer: {
    athleteAuth: athleteAuthReducer,
    staffAuth: staffAuthReducer,
    athletePortal: athletePortalReducer,
    athleteTeams: athleteTeamsReducer,
    gamification: gamificationReducer,
    staffPortal: staffPortalReducer,
    marketplace: marketplaceReducer,
    registrationCheckout: registrationCheckoutReducer,
    paymentMethods: paymentMethodsReducer,
    appConfig: appConfigReducer,
    publicHome: publicHomeReducer,
    publicTeams: publicTeamsReducer,
    blogs: blogsReducer,
    geo: geoReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
