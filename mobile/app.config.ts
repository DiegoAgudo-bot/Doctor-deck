import { existsSync } from "node:fs";
import type { ExpoConfig } from "expo/config";

/** Versión de la app: súbela en cada publicación (el servidor puede exigir una mínima). */
const VERSION = "1.2.0";
/** Para Google Play: entero que sube con cada build que se sube a la tienda. */
const VERSION_CODE = Number(process.env.ANDROID_VERSION_CODE ?? 1);

// Las notificaciones push necesitan el google-services.json de Firebase (secreto en el CI).
const googleServices = existsSync("./google-services.json") ? "./google-services.json" : undefined;

const config: ExpoConfig = {
  name: "Doctor Deck",
  slug: "doctor-deck",
  version: VERSION,
  scheme: "doctordeck",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#0e131b",
  android: {
    package: "app.doctordeck",
    versionCode: VERSION_CODE,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#0e131b" },
    ...(googleServices ? { googleServicesFile: googleServices } : {}),
    // Los enlaces https://doctordeck.app/decks/… (y cartas, invitaciones, perfiles y propuestas)
    // abren la app si está instalada.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [
          { scheme: "https", host: "doctordeck.app", pathPrefix: "/decks/" },
          { scheme: "https", host: "doctordeck.app", pathPrefix: "/cards/" },
          { scheme: "https", host: "doctordeck.app", pathPrefix: "/groups/join/" },
          { scheme: "https", host: "doctordeck.app", pathPrefix: "/u/" },
          { scheme: "https", host: "doctordeck.app", pathPrefix: "/trades/proposals/" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    predictiveBackGestureEnabled: false,
    // Sin copia de seguridad de Android: la caché (colección, mazos) no sale del móvil.
    allowBackup: false,
  },
  ios: { bundleIdentifier: "app.doctordeck", supportsTablet: false },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      { image: "./assets/icon.png", imageWidth: 160, backgroundColor: "#0e131b" },
    ],
    "expo-secure-store",
    "expo-web-browser",
    "expo-image",
    [
      "expo-share-intent",
      {
        // Lo que comparte ManaBox: la lista como texto o el CSV como fichero.
        androidIntentFilters: ["text/*", "application/csv", "application/vnd.ms-excel"],
        disableIOS: true,
      },
    ],
    ["expo-notifications", { color: "#6cb0ff", defaultChannel: "default" }],
    "./plugins/with-release-signing.js",
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://doctordeck.app",
  },
};

export default config;
