import Constants from "expo-constants";

/** Servidor de Doctor Deck (la misma API JSON que usa la web). */
export const API_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "https://doctordeck.app";

export const APP_SCHEME = "doctordeck";
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";
