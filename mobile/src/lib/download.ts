import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { authClient } from "./auth";
import { API_URL } from "./config";

/**
 * Descarga un fichero de la API con la sesión de la app (mis datos en JSON, la colección en CSV)
 * y abre el menú de compartir de Android para guardarlo o mandarlo a otra app.
 */
export async function downloadAndShare(path: string, fileName: string, mimeType: string) {
  const cookie = await authClient.getCookie();
  const target = new File(Paths.cache, fileName);
  const file = await File.downloadFileAsync(`${API_URL}${path}`, target, {
    headers: cookie ? { cookie } : {},
    idempotent: true,
  });
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}
