import type { ListedCard } from "../trades/lists";

/** Lista de deseos manual y cartas que no cambio, de UN usuario (se crea por usuario). */
export interface TradeRepository {
  wishes(): Promise<ListedCard[]>;
  /** Copias que quiero de una carta (0 = quitarla de la lista). */
  setWish(oracleId: string, quantity: number): Promise<void>;
  keeps(): Promise<Set<string>>;
  setKeep(oracleId: string, keep: boolean): Promise<void>;
}
