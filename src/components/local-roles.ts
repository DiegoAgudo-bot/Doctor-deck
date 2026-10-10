"use client";

import type { CardRoleEditDTO } from "@/server/dto";
import { storage } from "./api-client";

const KEY = "deck-doctor:roles";

/**
 * Correcciones de roles de quien no tiene cuenta: viven en este navegador y se mandan al analizar
 * (`roleEdits`). Con cuenta se guardan en el servidor (`/api/me/card-roles`).
 */
export const localRoles = {
  all(): [string, CardRoleEditDTO][] {
    const v = storage.get<unknown>(KEY, []);
    return Array.isArray(v) ? (v as [string, CardRoleEditDTO][]) : [];
  },
  set(oracleId: string, edit: CardRoleEditDTO) {
    const rest = localRoles.all().filter(([id]) => id !== oracleId);
    const empty = edit.roles.length === 0 && edit.tags.length === 0;
    storage.set(KEY, empty ? rest : [...rest, [oracleId, edit]]);
  },
};
