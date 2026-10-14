import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { api } from "./api";
import { API_URL, APP_VERSION } from "./config";
import { appRoute } from "./paths";

let registeredToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Pide permiso y registra el móvil en el servidor para recibir los avisos como push (token de
 * Firebase). Si el servidor no manda push, el permiso se deniega o es un emulador, no hace nada.
 */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Avisos",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const current = await Notifications.getPermissionsAsync();
  const status =
    current.status === "granted"
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  if (typeof token !== "string") return;
  await api("/api/me/devices", {
    body: { token, platform: "android", appVersion: APP_VERSION },
  });
  registeredToken = token;
}

/** Al cerrar sesión: que no le lleguen los avisos de esta cuenta. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  await api("/api/me/devices", { method: "DELETE", body: { token: registeredToken } }).catch(
    () => {},
  );
  registeredToken = null;
}

/** Tocar una notificación lleva a su pantalla (la ruta de la web viene en `data.path`). */
export function useNotificationTaps() {
  const last = Notifications.useLastNotificationResponse();
  const path = last?.notification.request.content.data?.path;
  return typeof path === "string" ? path : null;
}

/**
 * Abre una ruta de la web (de un aviso o un enlace) en su pantalla de la app; lo que no tiene
 * pantalla (privacidad, aviso legal…), en el navegador del sistema.
 */
export function openWebPath(path: string) {
  const route = appRoute(path);
  if (route) router.push(route as never);
  else WebBrowser.openBrowserAsync(new URL(path, API_URL).toString()).catch(() => {});
}
