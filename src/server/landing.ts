import { headers } from "next/headers";
import { COLORS, type Color } from "@/domain/cards/types";
import { localImageUrl } from "@/domain/cards/images";
import { getAuth, getContainer } from "./container";

/** Un mazo público para enseñar en la portada (prueba de que hay comunidad detrás). */
export interface LandingDeck {
  id: string;
  name: string;
  commanders: string[];
  owner: string;
  likes: number;
  colors: Color[];
  /** Imagen del primer comandante (servida por nosotros, /img/…). */
  imageUrl: string | null;
}

/** ¿Hay sesión en esta petición? (Para decidir en el servidor entre portada y panel.) */
export async function hasSession(): Promise<boolean> {
  // Primero las cabeceras: eso marca la ruta como dinámica antes de tocar la configuración.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return Boolean(session?.user);
}

/** Los mazos públicos más recientes, con su dueño y la imagen del comandante. */
export async function landingDecks(limit = 3): Promise<LandingDeck[]> {
  const c = getContainer();
  const rows = await c.publicDecks.search({}, limit);
  const [cards, owners] = await Promise.all([
    c.cards.findCardsByOracleIds([...new Set(rows.flatMap((r) => r.commanders))]),
    Promise.all(rows.map((r) => c.social.byId(r.ownerId))),
  ]);
  const byId = new Map(cards.map((card) => [card.oracleId, card]));
  return rows.flatMap((r, i) => {
    const owner = owners[i]?.username;
    if (!owner) return [];
    const commanders = r.commanders.map((id) => byId.get(id)).filter((x) => x !== undefined);
    const identity = new Set(commanders.flatMap((x) => x.colorIdentity));
    return [
      {
        id: r.id,
        name: r.name,
        commanders: r.commanderNames,
        owner,
        likes: r.likes,
        colors: COLORS.filter((x) => identity.has(x)),
        imageUrl: localImageUrl(commanders[0]?.imageUrl ?? null),
      },
    ];
  });
}
