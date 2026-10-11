import { deckStandings, playerStandings, type GameResult } from "@/domain/play/stats";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { Game, GameFilter, GameRepository, GroupRepository } from "@/domain/ports/play";
import type { NotificationRepository, ProfileRepository, PublicDecks } from "@/domain/ports/social";
import { AppError, forbidden, notFound } from "./errors";
import { memberGroup } from "./groups";
import { ensureUsername } from "./social";

export interface GameDeps {
  games: GameRepository;
  groups: GroupRepository;
  profiles: ProfileRepository;
  notifications: NotificationRepository;
  publicDecks: PublicDecks;
  decksFor: (userId: string) => DeckRepository;
}

export interface GamePlayerInput {
  /** Usuario de Doctor Deck (en una partida de grupo, miembro del grupo) o invitado. */
  username?: string | undefined;
  guestName?: string | undefined;
  /** Mazo guardado del jugador (id público), o solo el nombre del mazo / comandante. */
  deckId?: string | undefined;
  deckName?: string | undefined;
  winner: boolean;
}

export interface GameInput {
  groupId?: string | undefined;
  playedAt?: Date | undefined;
  turns?: number | undefined;
  notes?: string | undefined;
  players: GamePlayerInput[];
}

const invalid = (message: string) => new AppError("invalid_game", message);

/**
 * Registra una partida. Sin grupo, el único usuario puede ser quien la registra (el resto,
 * invitados); en un grupo, los jugadores con cuenta tienen que ser miembros. Cada mazo guardado
 * tiene que ser de su jugador (y, si no es mío, público u oculto). Avisa a los demás jugadores.
 */
export async function recordGame(viewerId: string, input: GameInput, deps: GameDeps) {
  const me = await ensureUsername(viewerId, deps);
  if (input.players.length < 2 || input.players.length > 8) {
    throw invalid("Una partida tiene entre 2 y 8 jugadores.");
  }
  if (input.players.filter((p) => p.winner).length > 1) {
    throw invalid("Solo puede haber un ganador (o ninguno, si fue empate).");
  }
  const group = input.groupId ? await memberGroup(input.groupId, viewerId, deps) : null;
  const allowed = new Map(
    (group?.members ?? [{ id: me.id, username: me.username, name: me.name, image: me.image }]).map(
      (m) => [m.username?.toLowerCase(), m],
    ),
  );
  const seen = new Set<string>();
  const players = await Promise.all(
    input.players.map(async (p) => {
      const username = p.username?.replace(/^@/, "").trim().toLowerCase();
      const guestName = p.guestName?.replace(/\s+/g, " ").trim().slice(0, 40);
      const user = username ? allowed.get(username) : undefined;
      if (username && !user) {
        throw invalid(
          group
            ? `@${username} no es del grupo.`
            : "Sin grupo, los demás jugadores van como invitados (solo su nombre).",
        );
      }
      if (!user && !guestName) throw invalid("A cada jugador le falta el nombre.");
      if (user) {
        if (seen.has(user.id)) throw invalid(`@${username} está dos veces.`);
        seen.add(user.id);
      }
      let deckName = (p.deckName ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      let commanderNames: string[] = [];
      let deckId: string | null = null;
      if (p.deckId) {
        if (!user) throw invalid("Los invitados no tienen mazos guardados.");
        const found = await deps.publicDecks.find(p.deckId, viewerId);
        if (!found || found.ownerId !== user.id) {
          throw invalid("Ese mazo no es de ese jugador (o es privado).");
        }
        deckId = found.deck.id;
        deckName = found.deck.name;
        commanderNames = found.deck.commanderNames;
      }
      return {
        label: user ? `@${user.username ?? user.name}` : guestName!,
        userId: user?.id ?? null,
        guestName: user ? null : guestName!,
        deckId,
        deckName,
        commanderNames,
        winner: p.winner,
      };
    }),
  );
  if (!group && !players.some((p) => p.userId === viewerId)) {
    throw invalid("Tienes que estar entre los jugadores.");
  }
  const playedAt = input.playedAt ?? new Date();
  if (playedAt.getTime() > Date.now() + 86_400_000) throw invalid("Esa fecha aún no ha llegado.");
  const id = await deps.games.create({
    groupId: group?.id ?? null,
    createdById: viewerId,
    playedAt,
    turns: input.turns ?? null,
    notes: (input.notes ?? "").trim().slice(0, 500),
    players: players.map((p) => ({
      userId: p.userId,
      guestName: p.guestName,
      deckId: p.deckId,
      deckName: p.deckName,
      commanderNames: p.commanderNames,
      winner: p.winner,
    })),
  });
  const winner = players.find((p) => p.winner);
  await deps.notifications.create(
    players.flatMap((p) =>
      p.userId && p.userId !== viewerId
        ? [
            {
              userId: p.userId,
              actorId: viewerId,
              type: "game_recorded" as const,
              title: winner ? `Ganó ${winner.label}` : "Partida sin ganador",
              refId: id,
            },
          ]
        : [],
    ),
  );
  return id;
}

/** Puede verla quien jugó, quien la registró y los miembros de su grupo. */
async function canSee(game: Game, viewerId: string, deps: Pick<GameDeps, "groups">) {
  return (
    game.createdById === viewerId ||
    game.players.some((p) => p.userId === viewerId) ||
    (game.group !== null && (await deps.groups.isMember(game.group.id, viewerId)))
  );
}

export async function getGame(
  id: string,
  viewerId: string,
  deps: Pick<GameDeps, "games" | "groups">,
) {
  const g = await deps.games.get(id);
  if (!g || !(await canSee(g, viewerId, deps))) throw notFound("Esa partida no existe.");
  return g;
}

/** La borra quien la registró o el dueño del grupo. */
export async function deleteGame(
  id: string,
  viewerId: string,
  deps: Pick<GameDeps, "games" | "groups">,
) {
  const g = await getGame(id, viewerId, deps);
  const group = g.group ? await deps.groups.get(g.group.id) : null;
  if (g.createdById !== viewerId && group?.ownerId !== viewerId) {
    throw forbidden("Solo quien la registró puede borrarla.");
  }
  await deps.games.delete(id);
}

/** Para las estadísticas: jugadores por usuario (o nombre del invitado) y mazos por id o nombre. */
export function gameResults(games: readonly Game[]): GameResult[] {
  return games.map((g) => ({
    playedAt: g.playedAt,
    players: g.players.map((p) => ({
      key: p.userId ?? `guest:${(p.guestName ?? "").toLowerCase()}`,
      name: p.user ? (p.user.username ? `@${p.user.username}` : p.user.name) : (p.guestName ?? ""),
      deckKey: p.deckId ?? (p.deckName ? `name:${p.deckName.toLowerCase()}` : null),
      deckName: p.deckName,
      winner: p.winner,
    })),
  }));
}

/** Las estadísticas se calculan sobre, como mucho, las últimas partidas. */
export const STATS_GAMES = 500;

export async function gameStats(filter: GameFilter, deps: Pick<GameDeps, "games">) {
  const games = await deps.games.list(filter, STATS_GAMES);
  const results = gameResults(games);
  return {
    games: games.length,
    players: playerStandings(results),
    decks: deckStandings(results),
    recent: games.slice(0, 20),
  };
}
