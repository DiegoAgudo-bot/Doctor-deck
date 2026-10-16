import { z } from "zod";
import { BrowserCollectionRepository, noSavedDecks } from "@/adapters/memory/anonymous";
import {
  browseCollectionView,
  collectionView,
  withKeywordMatches,
} from "@/application/collection-cards";
import { RARITIES, SUPERTYPES } from "@/domain/cards/attributes";
import { CARD_TYPES, COLLECTION_SORTS, COLOR_FILTERS } from "@/domain/collection/browse";
import { ROLES } from "@/domain/roles/types";
import { withOverrides } from "@/domain/roles/overrides";
import { getContainer } from "@/server/container";
import { collectionCardDTO, type CollectionViewResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { browserRoleEditsSchema, loadRoleEdits, overridesOf } from "@/server/role-edits";
import { currentUser } from "@/server/session";
import { Timing } from "@/server/timing";
import { BODY_LIMIT, readJson } from "@/server/body";

const text = z.string().max(100).optional();
const num = (min: number, max: number) => z.number().min(min).max(max).optional();

const schema = z.object({
  /** La colección de otro usuario (si la tiene pública). */
  username: z.string().min(1).max(40).optional(),
  /** Sin sesión: la colección del navegador, como pares [oracleId, copias]. */
  collection: z
    .array(z.tuple([z.string().min(1).max(64), z.number().int().min(1).max(10_000)]))
    .max(60_000)
    .optional(),
  filters: z
    .object({
      q: z.string().max(100).optional(),
      colors: z.array(z.enum(COLOR_FILTERS)).max(6).optional(),
      colorMode: z.enum(["alguno", "dentro", "exacto"]).optional(),
      type: z.enum(CARD_TYPES).optional(),
      role: z.enum(ROLES).optional(),
      cmc: z.number().int().min(0).max(7).optional(),
      origin: z.enum(["csv", "manual"]).optional(),
      use: z.enum(["libres", "en-mazos"]).optional(),
      foil: z.boolean().optional(),
      commander: z.boolean().optional(),
      language: z
        .string()
        .regex(/^[a-z]{2,3}$/)
        .optional(),
      text,
      colorBy: z.enum(["identity", "color"]).optional(),
      types: z.array(z.enum(CARD_TYPES)).max(8).optional(),
      supertypes: z.array(z.enum(SUPERTYPES)).max(3).optional(),
      subtype: text,
      keyword: text,
      cmcMin: num(0, 20),
      cmcMax: num(0, 20),
      powerMin: num(-5, 99),
      powerMax: num(-5, 99),
      toughnessMin: num(-5, 99),
      toughnessMax: num(-5, 99),
      loyaltyMin: num(0, 99),
      loyaltyMax: num(0, 99),
      rarities: z.array(z.enum(RARITIES)).max(6).optional(),
      sets: z
        .array(z.string().regex(/^[a-z0-9]{2,6}$/i))
        .max(50)
        .optional(),
      conditions: z.array(z.string().max(20)).max(8).optional(),
      artist: text,
      finish: z.enum(["foil", "nonfoil"]).optional(),
      priceMin: num(0, 100_000),
      priceMax: num(0, 100_000),
      quantityMin: z.number().int().min(1).max(1000).optional(),
      addedSince: z.iso.datetime().optional(),
      gameChanger: z.boolean().optional(),
    })
    .default({}),
  /** Una fila por carta o, como ManaBox, por variante (edición, foil, idioma y estado). */
  by: z.enum(["card", "copy"]).default("card"),
  sort: z.enum(COLLECTION_SORTS).default("nombre"),
  dir: z.enum(["asc", "desc"]).optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(0).max(200).default(48),
  roleEdits: browserRoleEditsSchema,
});

/**
 * Una página de la colección (agrupada por carta) con los filtros y el orden pedidos, y los
 * totales de lo filtrado y de toda la colección. POST porque sin sesión el navegador manda su
 * colección en el cuerpo. Con `limit: 0` devuelve solo los totales.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const { collection, username, roleEdits, by, ...query } = schema.parse(
      await readJson(request, BODY_LIMIT.large).catch(() => ({})),
    );
    const c = getContainer();
    // De quién es la colección: de otro (si es pública o soy yo), la mía o la del navegador.
    let ownerId = user?.id ?? null;
    if (username) {
      const owner = await c.social.byUsername(username.toLowerCase());
      if (!owner || (!owner.collectionPublic && owner.id !== user?.id)) {
        return Response.json(
          { error: { code: "collection_private", message: "Esta colección es privada" } },
          { status: 403 },
        );
      }
      ownerId = owner.id;
    }
    const timing = new Timing();
    const deps = {
      cards: c.cards,
      collection: ownerId ? c.collectionFor(ownerId) : new BrowserCollectionRepository(collection),
      decks: ownerId ? c.decksFor(ownerId) : noSavedDecks,
    };
    const load = async () =>
      collectionView(
        {
          ...deps,
          // Con las correcciones de roles del dueño (o, sin sesión, las del navegador).
          classifier: withOverrides(c.classifier, {
            mine: overridesOf(
              ownerId
                ? await c.roleOverridesFor(ownerId).all()
                : await loadRoleEdits(null, roleEdits),
            ),
          }),
        },
        by,
      );
    // La de un usuario se guarda en caché; la del navegador (sin cuenta) viene en cada petición.
    const view = await timing.step("view", async () => {
      if (!ownerId) return load();
      const r = await c.collectionViews.get(`${ownerId}|${by}`, load);
      timing.add(r.hit ? "cache-hit" : "cache-miss", 0);
      return r.value;
    });
    const result = browseCollectionView(view, await withKeywordMatches(query, c.cards));
    const body: CollectionViewResponse = {
      // En la colección de otro no salen los nombres de sus mazos (pueden ser privados) ni a
      // quién presta: solo cuántas copias tiene ocupadas.
      items: result.items
        .map(collectionCardDTO)
        .map((i) => (ownerId && ownerId !== user?.id ? { ...i, usedIn: [] } : i)),
      total: result.total,
      overall: result.overall,
      facets: result.facets,
    };
    return Response.json(body, { headers: timing.header() });
  } catch (err) {
    return errorResponse(err);
  }
}
