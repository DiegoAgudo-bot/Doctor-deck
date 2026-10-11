import { describe, expect, it } from "vitest";
import { excerpt, mergeFeed, type FeedItem } from "./feed";

const actor = { id: "a", username: "ana", name: "Ana" };
const deck = { id: "d", name: "Mazo", commanders: [], commanderIds: [] };
const item = (id: string, day: number): FeedItem => ({
  id,
  at: new Date(Date.UTC(2026, 0, day)),
  actor,
  type: "deck",
  deck,
});

describe("mergeFeed", () => {
  it("mezcla por fecha, quita repetidos y corta", () => {
    const out = mergeFeed(
      [
        [item("deck:1", 5), item("deck:2", 1)],
        [item("game:1", 3), item("deck:1", 5)],
      ],
      2,
    );
    expect(out.map((i) => i.id)).toEqual(["deck:1", "game:1"]);
  });
});

describe("excerpt", () => {
  it("aplana espacios y corta con puntos suspensivos", () => {
    expect(excerpt("hola\n\n  mundo")).toBe("hola mundo");
    expect(excerpt("abcdefghij", 5)).toBe("abcd…");
  });
});
