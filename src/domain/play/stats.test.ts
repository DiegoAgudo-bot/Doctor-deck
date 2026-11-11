import { describe, expect, it } from "vitest";
import { deckStandings, personalStats, playerStandings, recordOf, type GameResult } from "./stats";

const game = (day: number, winner: string, players: [string, string | null][]): GameResult => ({
  playedAt: new Date(Date.UTC(2026, 0, day)),
  players: players.map(([key, deck]) => ({
    key,
    name: key.toUpperCase(),
    deckKey: deck,
    deckName: deck ?? "",
    winner: key === winner,
  })),
});

const games = [
  game(1, "ana", [
    ["ana", "atraxa"],
    ["beto", "krenko"],
    ["carla", null],
  ]),
  game(2, "beto", [
    ["ana", "atraxa"],
    ["beto", "krenko"],
  ]),
  game(3, "beto", [
    ["ana", "edgar"],
    ["beto", "krenko"],
    ["carla", null],
  ]),
];

describe("playerStandings", () => {
  it("ordena por victorias, luego %, y calcula la racha desde la última partida", () => {
    const s = playerStandings(games);
    expect(s.map((x) => [x.key, x.wins, x.games])).toEqual([
      ["beto", 2, 3],
      ["ana", 1, 3],
      ["carla", 0, 2],
    ]);
    expect(recordOf(s, "beto")).toMatchObject({ streak: 2, winRate: 2 / 3 });
    expect(recordOf(s, "ana")?.streak).toBe(-2);
    expect(recordOf(s, "carla")?.lastPlayed).toEqual(new Date(Date.UTC(2026, 0, 3)));
    expect(recordOf(s, "nadie")).toBeNull();
  });

  it("sin partidas, nada", () => {
    expect(playerStandings([])).toEqual([]);
  });
});

describe("deckStandings", () => {
  it("cuenta solo los mazos conocidos", () => {
    const s = deckStandings(games);
    expect(s.map((x) => [x.key, x.wins, x.games])).toEqual([
      ["krenko", 2, 3],
      ["atraxa", 1, 2],
      ["edgar", 0, 1],
    ]);
  });
});

describe("personalStats", () => {
  it("mi récord, mis mazos, mis rivales y los meses", () => {
    const march = {
      ...game(1, "ana", [
        ["ana", "atraxa"],
        ["dani", null],
      ]),
    };
    march.playedAt = new Date(Date.UTC(2026, 2, 5));
    const s = personalStats([...games, march], "ana");
    expect(s.record).toMatchObject({ games: 4, wins: 2, streak: 1 });
    expect(s.decks.map((d) => [d.key, d.wins, d.games])).toEqual([
      ["atraxa", 2, 3],
      ["edgar", 0, 1],
    ]);
    expect(s.rivals).toEqual([
      { key: "beto", name: "BETO", games: 3, myWins: 1, theirWins: 2 },
      { key: "carla", name: "CARLA", games: 2, myWins: 1, theirWins: 0 },
      { key: "dani", name: "DANI", games: 1, myWins: 1, theirWins: 0 },
    ]);
    expect(s.months).toEqual([
      { month: "2026-01", games: 3, wins: 1 },
      { month: "2026-02", games: 0, wins: 0 },
      { month: "2026-03", games: 1, wins: 1 },
    ]);
  });

  it("sin partidas mías, vacío", () => {
    expect(personalStats(games, "nadie")).toEqual({
      record: null,
      decks: [],
      rivals: [],
      months: [],
    });
  });
});
