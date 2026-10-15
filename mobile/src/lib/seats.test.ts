import assert from "node:assert/strict";
import { test } from "node:test";
import { seatLayout } from "./seats.ts";

test("reparte a los lados y deja al impar abajo, en el sentido de las agujas del reloj", () => {
  assert.deepEqual(seatLayout(2), { left: [0], right: [1], bottom: null });
  assert.deepEqual(seatLayout(3), { left: [0], right: [1], bottom: 2 });
  assert.deepEqual(seatLayout(4), { left: [1, 0], right: [2, 3], bottom: null });
  assert.deepEqual(seatLayout(5), { left: [1, 0], right: [2, 3], bottom: 4 });
  assert.deepEqual(seatLayout(6), { left: [2, 1, 0], right: [3, 4, 5], bottom: null });
});

test("sienta a todos una sola vez", () => {
  for (let n = 2; n <= 6; n++) {
    const s = seatLayout(n);
    const all = [...s.left, ...s.right, ...(s.bottom === null ? [] : [s.bottom])].sort();
    assert.deepEqual(
      all,
      Array.from({ length: n }, (_, i) => i),
    );
  }
});
