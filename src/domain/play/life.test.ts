import { describe, expect, it } from "vitest";
import {
  changeCommander,
  changeLife,
  changePoison,
  isOut,
  lastStanding,
  newLifeGame,
  nextTurn,
  rematch,
  setConceded,
} from "./life";

describe("contador de vidas", () => {
  it("empieza a 40 con entre 2 y 6 jugadores y nombres por defecto", () => {
    const g = newLifeGame(["Ana", " ", "Beto"], 40, 0);
    expect(g.players.map((p) => [p.name, p.life])).toEqual([
      ["Ana", 40],
      ["Jugador 2", 40],
      ["Beto", 40],
    ]);
    expect(newLifeGame(["solo"]).players).toHaveLength(2);
    expect(newLifeGame(Array.from({ length: 9 }, () => "x")).players).toHaveLength(6);
  });

  it("el daño de comandante resta vida y elimina a los 21", () => {
    let g = newLifeGame(["A", "B", "C"]);
    g = changeCommander(g, 1, 0, 15);
    g = changeCommander(g, 1, 0, -20); // no baja de 0, devuelve solo lo hecho
    expect(g.players[1]).toMatchObject({ life: 40, commander: [0, 0, 0] });
    g = changeCommander(g, 1, 0, 21);
    expect(g.players[1]!.life).toBe(19);
    expect(isOut(g.players[1]!)).toBe(true);
    // A uno mismo no.
    expect(changeCommander(g, 2, 2, 5)).toBe(g);
  });

  it("veneno, vida a 0 y concesión eliminan; queda el último en pie", () => {
    let g = newLifeGame(["A", "B", "C"]);
    g = changePoison(g, 0, 10);
    g = changeLife(g, 1, -40);
    expect(lastStanding(g)).toBe(2);
    g = changeLife(g, 1, 5);
    expect(lastStanding(g)).toBeNull();
    g = setConceded(g, 1, true);
    expect(lastStanding(g)).toBe(2);
    expect(changePoison(g, 2, -3).players[2]!.poison).toBe(0);
  });

  it("el turno salta a los eliminados y cuenta vueltas", () => {
    let g = newLifeGame(["A", "B", "C"]);
    g = changeLife(g, 1, -40);
    g = nextTurn(g);
    expect([g.active, g.turn]).toEqual([2, 1]);
    g = nextTurn(g);
    expect([g.active, g.turn]).toEqual([0, 2]);
  });

  it("revancha con los mismos jugadores y colores", () => {
    const g = changeLife(newLifeGame(["A", "B"]), 0, -12);
    const r = rematch(g);
    expect(r.players.map((p) => [p.name, p.life, p.color])).toEqual([
      ["A", 40, "w"],
      ["B", 40, "u"],
    ]);
  });
});
