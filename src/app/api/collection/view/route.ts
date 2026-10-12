import { z } from "zod";
import { BrowserCollectionRepository, noSavedDecks } from "@/adapters/memory/anonymous";
import { browseCollectionView, collectionView } from "@/application/collection-cards";
import { CARD_TYPES, COLLECTION_SORTS, COLOR_FILTERS } from "@/domain/collection/browse";
import { ROLES } from "@/domain/roles/types";
import { withOverrides } from "@/domain/roles/overrides";
import { getContainer } from "@/server/container";
import { collectionCardDTO, type CollectionViewResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { browserRoleEditsSchema, loadRoleEdits, overridesOf } from "@/server/role-edits";
import { currentUser } from "@/server/session";
import { Timing } from "@/server/timing";

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
      language: z
        .string()
        .regex(/^[a-z]{2,3}$/)
        .optional(),
    })
    .default({}),
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
    const { collection, username, roleEdits, ...query } = schema.parse(
      await request.json().catch(() => ({})),
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
      collectionView({
        ...deps,
        // Con las correcciones de roles del dueño (o, sin sesión, las del navegador).
        classifier: withOverrides(c.classifier, {
          mine: overridesOf(
            ownerId
              ? await c.roleOverridesFor(ownerId).all()
              : await loadRoleEdits(null, roleEdits),
          ),
        }),
      });
    // La de un usuario se guarda en caché; la del navegador (sin cuenta) viene en cada petición.
    const view = await timing.step("view", async () => {
      if (!ownerId) return load();
      const r = await c.collectionViews.get(ownerId, load);
      timing.add(r.hit ? "cache-hit" : "cache-miss", 0);
      return r.value;
    });
    const result = browseCollectionView(view, query);
    const body: CollectionViewResponse = {
      items: result.items.map(collectionCardDTO),
      total: result.total,
      overall: result.overall,
    };
    return Response.json(body, { headers: timing.header() });
  } catch (err) {
    return errorResponse(err);
  }
}
