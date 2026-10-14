import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { gameStats, recordGame } from "@/application/games";
import { memberGroup } from "@/application/groups";
import { forbidden, notFound } from "@/application/errors";
import type { GameFilter } from "@/domain/ports/play";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { gameStatsDTO } from "@/server/social-dto";
import { readJson } from "@/server/body";

/**
 * Partidas y clasificación: de un grupo (`?group=`, si soy miembro), de un mazo (`?deck=`, si
 * puedo verlo), de un usuario (`?username=`, solo las de grupos que compartimos o en las que
 * jugué) o, sin nada, las mías.
 */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const deps = socialDeps();
    const q = req.nextUrl.searchParams;
    let filter: GameFilter = { userId: user.id };
    let groupOwner: string | null = null;
    const group = q.get("group");
    const deck = q.get("deck");
    if (group) {
      groupOwner = (await memberGroup(group, user.id, deps)).ownerId;
      filter = { groupId: group };
    } else if (deck) {
      if (!(await deps.publicDecks.find(deck, user.id))) throw notFound("Ese mazo no existe.");
      filter = { deckId: deck };
    } else if (q.get("username")) {
      throw forbidden("Las partidas de otros se ven en su perfil y en los grupos.");
    }
    const stats = await gameStats(filter, deps);
    // Las de grupos ajenos no se enseñan con detalle (sí cuentan en las estadísticas del mazo).
    const mine = await deps.groups.forUser(user.id);
    const myGroupIds = new Set(mine.map((g) => g.id));
    const visible = {
      ...stats,
      recent: stats.recent.filter(
        (g) =>
          !g.group || myGroupIds.has(g.group.id) || g.players.some((p) => p.userId === user.id),
      ),
    };
    return Response.json(gameStatsDTO(visible, user.id, groupOwner));
  } catch (err) {
    return errorResponse(err);
  }
}

const playerSchema = z.object({
  username: z.string().max(40).optional(),
  guestName: z.string().max(80).optional(),
  deckId: z.string().max(80).optional(),
  deckName: z.string().max(200).optional(),
  winner: z.boolean().default(false),
});

const gameSchema = z.object({
  groupId: z.string().max(80).optional(),
  playedAt: z.coerce.date().optional(),
  turns: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(2000).optional(),
  players: z.array(playerSchema).min(2).max(8),
});

/** Registra una partida. Devuelve su id. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const id = await recordGame(user.id, gameSchema.parse(await readJson(req)), socialDeps());
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
