import { describe, expect, it } from "vitest";
import type { PushDeviceRepository, PushMessage } from "@/domain/ports/push";
import { pushNotifications } from "./push";

const devices = (tokens: { userId: string; token: string }[]) => {
  const removed: string[] = [];
  const repo: PushDeviceRepository = {
    register: async () => {},
    unregister: async () => {},
    tokensFor: async (ids) => tokens.filter((t) => ids.includes(t.userId)),
    remove: async (t) => void removed.push(...t),
    labels: async () => new Map([["ana", "@ana"]]),
  };
  return { repo, removed };
};

describe("pushNotifications", () => {
  it("un mensaje por dispositivo con el texto del aviso; borra los tokens que ya no valen", async () => {
    const { repo, removed } = devices([
      { userId: "u1", token: "a" },
      { userId: "u1", token: "b" },
      { userId: "u2", token: "c" },
    ]);
    const sent: PushMessage[] = [];
    const r = await pushNotifications(
      [{ userId: "u1", actorId: "ana", type: "loan_new", title: "Sol Ring", refId: "l1" }],
      {
        devices: repo,
        sender: {
          send: async (m) => {
            sent.push(...m);
            return { invalidTokens: ["b"] };
          },
        },
      },
    );
    expect(sent.map((m) => m.token)).toEqual(["a", "b"]);
    expect(sent[0]).toMatchObject({
      title: "Préstamo",
      body: "@ana te ha prestado Sol Ring",
      data: { path: "/loans", type: "loan_new" },
    });
    expect(removed).toEqual(["b"]);
    expect(r.sent).toBe(1);
  });

  it("sin dispositivos no llama al servicio", async () => {
    const { repo } = devices([]);
    const r = await pushNotifications(
      [{ userId: "u1", actorId: "ana", type: "new_deck", title: "Jund" }],
      { devices: repo, sender: { send: () => Promise.reject(new Error("no")) } },
    );
    expect(r.sent).toBe(0);
  });
});
