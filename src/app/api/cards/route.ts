import { connection, type NextRequest } from "next/server";
import { browseCatalog, CATALOG_PAGE } from "@/application/card-catalog";
import { parseCatalogQuery } from "@/domain/cards/catalog-search";
import { catalogCardDTO, type CatalogPageDTO } from "@/server/card-dto";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";

/**
 * Buscador de cartas (público): `?q=` (nombre, tipo o texto), `colors=WU` (o `C`), `mode=within|
 * exact|includes`, `type=creature…`, `commander=1`, `gc=1`, `cmc=0..7`, `sort=popular|name|cmc`,
 * filtros avanzados (`o`, `sub`, `kw`, `super`, `by`, `cmin`/`cmax`, `powmin`/`powmax`,
 * `toumin`/`toumax`, `rarity`, `set`, `artist`; ver `parseCatalogQuery`), `offset`, `limit` (máx. 60).
 */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const params = req.nextUrl.searchParams;
    const offset = Math.max(0, Math.floor(Number(params.get("offset")) || 0));
    const limit = Math.min(
      60,
      Math.max(1, Math.floor(Number(params.get("limit")) || CATALOG_PAGE)),
    );
    const { cards, total, prices } = await browseCatalog(parseCatalogQuery(params), offset, limit, {
      cards: getContainer().cards,
    });
    const body: CatalogPageDTO = { items: cards.map((c) => catalogCardDTO(c, prices)), total };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
