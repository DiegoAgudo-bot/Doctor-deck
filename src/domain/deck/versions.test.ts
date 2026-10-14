import { describe, expect, it } from "vitest";
import { diffVersions } from "./versions";

describe("diffVersions", () => {
  it("cuenta lo que entra y sale, con copias", () => {
    const diff = diffVersions(
      [
        ["cmd", 1, true],
        ["ring", 1, false],
        ["island", 30, false],
      ],
      [
        ["cmd", 1, true],
        ["signet", 1, false],
        ["island", 28, false],
      ],
    );
    expect(diff.added).toEqual([["signet", 1]]);
    expect(diff.removed).toEqual([
      ["ring", 1],
      ["island", 2],
    ]);
  });
});
