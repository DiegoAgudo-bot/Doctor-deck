import type { PrefKey } from "../prefs/prefs";

/** Preferencias de la interfaz de un usuario (el repositorio ya va filtrado por usuario). */
export interface PrefsRepository {
  all(): Promise<Partial<Record<PrefKey, Record<string, unknown>>>>;
  set(key: PrefKey, value: Record<string, unknown>): Promise<void>;
}
