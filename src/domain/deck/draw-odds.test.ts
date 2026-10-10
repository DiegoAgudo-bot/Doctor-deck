import { describe, expect, it } from "vitest";
import { atLeast, hypergeometric, openingHandOdds, shuffleLibrary } from "./draw-odds";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 4);

describe("hipergeométrica", () => {
  it("coincide con valores conocidos", () => {
    // 36 tierras en 99, mano de 7 (referencia: C(K,k)·C(N−K,n−k)/C(N,n) con enteros exactos).
    close(hypergeometric(99, 36, 7, 3), 0.285688);
    close(hypergeometric(99, 36, 7, 0), 0.037165);
    // Sumar todas da 1.
    const all = Array.from({ length: 8 }, (_, k) => hypergeometric(99, 36, 7, k));
    close(
      all.reduce((a, b) => a + b, 0),
      1,
    );
  });

  it("casos límite", () => {
    expect(hypergeometric(10, 0, 7, 0)).toBe(1);
    expect(hypergeometric(10, 0, 7, 1)).toBe(0);
    expect(atLeast(10, 10, 7, 7)).toBe(1);
    // Biblioteca más pequeña que la mano: se roba todo.
    expect(atLeast(5, 2, 7, 2)).toBe(1);
  });
});

describe("openingHandOdds", () => {
  it("un mazo con 36 tierras y 10 de ramp", () => {
    const odds = openingHandOdds({ library: 99, lands: 36, ramp: 10, draw: 10 });
    expect(odds.landsInHand).toHaveLength(8);
    close(odds.keepable, odds.landsInHand[2]! + odds.landsInHand[3]! + odds.landsInHand[4]!);
    close(odds.keepable, 0.740268);
    expect(odds.rampByT2).toBeGreaterThan(odds.rampInHand);
    expect(odds.landDropT3).toBeGreaterThan(odds.landDropT4);
  });

  it("más tierras, más probable llegar a 4 en el turno 4", () => {
    const few = openingHandOdds({ library: 99, lands: 30, ramp: 0, draw: 0 });
    const many = openingHandOdds({ library: 99, lands: 40, ramp: 0, draw: 0 });
    expect(many.landDropT4).toBeGreaterThan(few.landDropT4);
    expect(few.rampInHand).toBe(0);
  });
});

describe("shuffleLibrary", () => {
  it("expande las copias y baraja todas", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const library = shuffleLibrary(
      [
        { name: "Island", quantity: 3 },
        { name: "Sol Ring", quantity: 1 },
      ],
      random,
    );
    expect(library).toHaveLength(4);
    expect(library.filter((c) => c.name === "Island")).toHaveLength(3);
  });
});
