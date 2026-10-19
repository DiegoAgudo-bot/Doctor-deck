import { parseShareIntent, ShareIntentModule, type ShareIntent } from "expo-share-intent";
import { useSyncExternalStore } from "react";
import { peekShare, putShare, subscribeShare, type ShareItem } from "./share-inbox";

/** Lo que trae el contexto de compartir, como entrada del buzón. */
export function itemFromIntent(intent: ShareIntent): ShareItem {
  return {
    kind: "content",
    text: intent.text ?? null,
    files: intent.files?.map((f) => ({ path: f.path, fileName: f.fileName })) ?? null,
  };
}

interface NativeShare {
  takeShareIntent?: () => Promise<{ value: unknown; error: string | null }>;
}

/**
 * Pide al módulo nativo lo último compartido, por si su evento no llegó (el módulo parcheado lo
 * guarda hasta que se recoge). Lo deja en el buzón.
 */
export async function pollNativeShare(): Promise<void> {
  const native = ShareIntentModule as unknown as NativeShare | null;
  if (!native?.takeShareIntent) return;
  const { value, error } = await native.takeShareIntent();
  if (value) {
    const intent = parseShareIntent(value as never, {});
    if (intent.text || intent.files?.length) {
      putShare(itemFromIntent(intent));
      return;
    }
  }
  if (error) putShare({ kind: "error", message: error });
}

/** Lo que hay en el buzón ahora mismo. */
export const useShareInbox = (): ShareItem | null =>
  useSyncExternalStore(subscribeShare, peekShare, peekShare);
