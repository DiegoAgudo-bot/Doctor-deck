import { cache } from "react";
import { cardDetail } from "@/application/card-catalog";
import { AppError } from "@/application/errors";
import { cardDetailDTO, type CardDetailDTO } from "./card-dto";
import { getContainer } from "./container";
import { deckSummaries } from "./deck-summaries";

/** Ficha de una carta para la API (con sesión, además mis copias y mi lista de deseos). */
export async function cardDetailBody(
  oracleId: string,
  viewerId: string | null,
): Promise<CardDetailDTO> {
  const c = getContainer();
  const detail = await cardDetail(oracleId.slice(0, 64), viewerId, c);
  const [summaries, owners] = await Promise.all([
    deckSummaries(detail.commanderDecks, c.cards),
    Promise.all(detail.commanderDecks.map((d) => c.social.byId(d.ownerId))),
  ]);
  return cardDetailDTO(
    detail,
    summaries.map((s, i) => ({ ...s, owner: owners[i]?.username ?? null })),
  );
}

/**
 * La ficha sin sesión, para pintarla en el servidor (la leen los buscadores) y para sus metadatos;
 * `cache` evita leerla dos veces en la misma petición. null si la carta no existe.
 */
export const publicCardDetail = cache(async (oracleId: string) => {
  try {
    return await cardDetailBody(oracleId, null);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) return null;
    throw err;
  }
});
