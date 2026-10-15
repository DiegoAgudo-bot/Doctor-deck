import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LifeGame } from "@/domain/play/life";

/** Donde el contador de vidas guarda la mesa (para seguir la partida al volver). */
export const LIFE_KEY = "doctordeck:life";

/** La partida que hay abierta en el contador, si hay alguna. */
export async function openLifeGame(): Promise<LifeGame | null> {
  try {
    const raw = await AsyncStorage.getItem(LIFE_KEY);
    return raw ? ((JSON.parse(raw) as { game?: LifeGame | null }).game ?? null) : null;
  } catch {
    return null;
  }
}
