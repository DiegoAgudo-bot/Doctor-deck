import { DEFAULT_ENGINE_CONFIG, mergeEngineConfig } from "@/domain/suggestions/config";

/**
 * Configuración del motor de sugerencias. Ajusta aquí pesos y mínimos por rol:
 *   score(carta) = a·synergy + b·inclusion
 *   score(cambio) = score(entra) − score(sale) + c·bonus_rol
 */
export const engineConfig = mergeEngineConfig({
  // weights: { synergy: 1, inclusion: 1, roleBonus: 0.2 },
  // minimums: { land: 36, ramp: 10, draw: 10, removal: 8, wipe: 2 },
});

export { DEFAULT_ENGINE_CONFIG };
