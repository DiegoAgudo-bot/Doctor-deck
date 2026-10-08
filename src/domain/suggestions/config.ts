import type { Role } from "../roles/types";

export interface EngineConfig {
  /** score de una carta = a·synergy + b·inclusion (fracciones). */
  weights: {
    /** a: peso de la synergy. */
    synergy: number;
    /** b: peso del % de inclusión. */
    inclusion: number;
    /** c: peso del bonus de rol al emparejar (mismo rol, cubrir un mínimo). */
    roleBonus: number;
  };
  /** Mínimo de cartas por rol: ningún cambio deja el mazo por debajo. */
  minimums: Partial<Record<Role, number>>;
  /** Mejora mínima (score entra − score sale, sin bonus) para proponer un cambio. */
  minImprovement: number;
  maxSuggestions: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  weights: { synergy: 1, inclusion: 1, roleBonus: 0.2 },
  minimums: { land: 36, ramp: 10, draw: 10, removal: 8, wipe: 2 },
  minImprovement: 0.02,
  maxSuggestions: 15,
};

/** Mezcla una configuración parcial con la de por defecto. */
export function mergeEngineConfig(
  override: {
    weights?: Partial<EngineConfig["weights"]>;
    minimums?: EngineConfig["minimums"];
    minImprovement?: number;
    maxSuggestions?: number;
  } = {},
  base: EngineConfig = DEFAULT_ENGINE_CONFIG,
): EngineConfig {
  return {
    weights: { ...base.weights, ...override.weights },
    minimums: { ...base.minimums, ...override.minimums },
    minImprovement: override.minImprovement ?? base.minImprovement,
    maxSuggestions: override.maxSuggestions ?? base.maxSuggestions,
  };
}
