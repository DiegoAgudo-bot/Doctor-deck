import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";
import { peekShare, putShare, subscribeShare, type ShareItem } from "./share-inbox";
import { itemFromPending } from "./share-pending";

/**
 * Lo compartido desde otras apps lo recibe una actividad nativa propia
 * (`plugins/share-receiver/ShareReceiverActivity.kt`), que lo deja en
 * `files/shared-inbox/pending.json` (el fichero, copiado al lado) y abre la app como desde el
 * icono. Aquí se recoge: al arrancar y cada vez que la app vuelve a primer plano.
 */
const pendingFile = () => new File(Paths.document, "shared-inbox", "pending.json");

/** Si hay algo compartido esperando, lo pasa al buzón y lo borra (se recoge una sola vez). */
export async function pollNativeShare(): Promise<void> {
  // Mientras haya algo sin recoger se deja esperando lo nuevo (no se pierde).
  if (peekShare()) return;
  const file = pendingFile();
  if (!file.exists) return;
  let raw: string;
  try {
    raw = await file.text();
  } finally {
    try {
      file.delete();
    } catch {
      // Si no se puede borrar, `putShare` no lo repite (mismo id durante un rato).
    }
  }
  putShare(itemFromPending(raw));
}

/** Borra la copia del fichero compartido cuando ya se ha leído. */
export function removeSharedCopy(path: string) {
  try {
    const f = new File(path.startsWith("file://") ? path : `file://${path}`);
    if (f.exists) f.delete();
  } catch {
    // Da igual: la siguiente vez que se comparta algo se borran las copias anteriores.
  }
}

/** Lo que hay en el buzón ahora mismo. */
export const useShareInbox = (): ShareItem | null =>
  useSyncExternalStore(subscribeShare, peekShare, peekShare);
