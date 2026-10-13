import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_URL, APP_SCHEME } from "./config";

/**
 * Sesión de Better Auth en la app: la cookie se guarda cifrada (SecureStore) y se manda en la
 * cabecera de cada petición; el login con Google se abre en el navegador y vuelve a
 * `doctordeck://` con la sesión.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: APP_SCHEME, storagePrefix: "doctordeck", storage: SecureStore })],
});

export const useSession = authClient.useSession;
