import { File } from "expo-file-system";
import { router } from "expo-router";
import { setPendingImport } from "./shared";

/** Elegir un CSV de ManaBox o una lista .txt del móvil y llevarlo a la pantalla de importar. */
export async function pickImportFile(): Promise<void> {
  const picked = await File.pickFileAsync({
    mimeTypes: ["text/*", "text/csv", "application/csv", "application/vnd.ms-excel"],
  });
  if (picked.canceled) return;
  const text = await picked.result.text();
  setPendingImport(text, picked.result.name);
  router.push("/share");
}
