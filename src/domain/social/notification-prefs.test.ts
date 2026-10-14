import { describe, expect, it } from "vitest";
import { formatMutedGroups, isMuted, parseMutedGroups } from "./notification-prefs";

describe("avisos silenciados", () => {
  it("lee la columna sin repetidos ni grupos desconocidos", () => {
    expect(parseMutedGroups("")).toEqual([]);
    expect(parseMutedGroups("prices, loans,prices,nada")).toEqual(["prices", "loans"]);
  });

  it("escribe en orden fijo", () => {
    expect(formatMutedGroups(["loans", "follows"])).toBe("follows,loans");
  });

  it("silencia todos los tipos del grupo y solo esos", () => {
    expect(isMuted("trade_counter", ["proposals"])).toBe(true);
    expect(isMuted("trade_match", ["proposals"])).toBe(false);
    expect(isMuted("price_drop", [])).toBe(false);
  });
});
