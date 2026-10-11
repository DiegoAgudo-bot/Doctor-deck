import { scryfallImagePath } from "@/domain/cards/images";
import { COLORS, type Color } from "@/domain/cards/types";
import { loadEnv } from "@/config/env";
import { getContainer } from "./container";

/** URL pública de la web (para las URL absolutas de las vistas previas). */
export const siteUrl = () => new URL(loadEnv().BETTER_AUTH_URL);

/** Lo que se enseña al compartir un mazo (solo públicos u ocultos; los privados, nada). */
export interface DeckShare {
  name: string;
  commanders: string[];
  owner: string | null;
  cardCount: number;
  bracket: number | null;
  colors: Color[];
  unlisted: boolean;
  /** Ruta de Scryfall del arte del primer comandante ("art_crop/front/…"). */
  artPath: string | null;
}

/** De la imagen normal de Scryfall, la del arte recortado (misma carta, otra carpeta). */
const artCrop = (imageUrl: string | null) => {
  const path = imageUrl ? scryfallImagePath(imageUrl) : null;
  return path ? path.replace(/^[a-z_]+\//, "art_crop/").replace(/\.png$/, ".jpg") : null;
};

export async function deckShare(id: string): Promise<DeckShare | null> {
  const c = getContainer();
  const found = await c.publicDecks.find(id, null);
  if (!found) return null;
  const { deck, ownerId } = found;
  const [commanders, owner, facts] = await Promise.all([
    c.cards.findCardsByOracleIds(deck.commanders),
    c.social.byId(ownerId),
    c.publicDecks.search({ ownerIds: [ownerId] }, 500),
  ]);
  const identity = new Set(commanders.flatMap((x) => x.colorIdentity));
  return {
    name: deck.name,
    commanders: deck.commanderNames,
    owner: owner?.username ?? null,
    cardCount: deck.cardCount,
    bracket: facts.find((f) => f.id === id)?.bracket ?? null,
    colors: COLORS.filter((x) => identity.has(x)),
    unlisted: deck.visibility === "unlisted",
    artPath: artCrop(commanders[0]?.imageUrl ?? null),
  };
}

/** Lo que se enseña al compartir un perfil. */
export interface ProfileShare {
  username: string;
  name: string;
  publicDecks: number;
  /** Comandantes de sus últimos mazos públicos. */
  commanders: string[];
  artPath: string | null;
}

export async function profileShare(username: string): Promise<ProfileShare | null> {
  const c = getContainer();
  const profile = await c.social.byUsername(username.toLowerCase());
  if (!profile?.username) return null;
  const decks = await c.publicDecks.search({ ownerIds: [profile.id] }, 500);
  const first = decks[0];
  const [commander] = first ? await c.cards.findCardsByOracleIds(first.commanders.slice(0, 1)) : [];
  return {
    username: profile.username,
    name: profile.name,
    publicDecks: decks.length,
    commanders: [...new Set(decks.flatMap((d) => d.commanderNames))].slice(0, 3),
    artPath: artCrop(commander?.imageUrl ?? null),
  };
}

/** La imagen (de la caché de disco o de Scryfall) como data URI, o null si no se puede. */
export async function imageDataUri(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const img = await getContainer().images.get(path);
    if (!img) return null;
    return `data:${img.contentType};base64,${Buffer.from(img.body).toString("base64")}`;
  } catch {
    return null;
  }
}
