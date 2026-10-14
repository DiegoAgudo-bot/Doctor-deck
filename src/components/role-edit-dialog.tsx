"use client";

import { useEffect, useState } from "react";
import { ROLES, type Role } from "@/domain/roles/types";
import type { CardRoleEditDTO, DeckCardDTO } from "@/server/dto";
import { roleLabel } from "./deck-views";
import { Dialog } from "./ui";

/** Dónde vale la corrección: en todos mis mazos (y la colección) o solo en este mazo. */
export type RoleEditScope = "all" | "deck";

/**
 * Corregir los roles de una carta (y ponerle etiquetas libres). Por defecto vale para todos tus
 * mazos y para la colección; en un mazo guardado tuyo se puede limitar a ese mazo. Los mínimos
 * por rol y los cambios propuestos usan los roles corregidos.
 */
export function RoleEditDialog({
  card,
  busy,
  canScopeToDeck,
  onClose,
  onSave,
}: {
  card: DeckCardDTO | null;
  busy: boolean;
  /** Es un mazo guardado mío: se puede guardar solo para él. */
  canScopeToDeck: boolean;
  onClose: () => void;
  /** Roles vacíos = quitar la corrección (de este mazo o de todos). */
  onSave: (edit: CardRoleEditDTO, scope: RoleEditScope) => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [primary, setPrimary] = useState<Role | null>(null);
  const [tags, setTags] = useState("");
  const [scope, setScope] = useState<RoleEditScope>("all");

  useEffect(() => {
    if (!card) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reiniciar el formulario al abrir
    setRoles(card.roles);
    setPrimary(card.primaryRole);
    setTags(card.tags.join(", "));
    setScope(card.roleSource === "deck" && canScopeToDeck ? "deck" : "all");
  }, [card, canScopeToDeck]);

  function toggle(r: Role) {
    const next = ROLES.filter((x) => (x === r ? !roles.includes(r) : roles.includes(x)));
    setRoles(next);
    if (primary === null || !next.includes(primary)) setPrimary(next[0] ?? null);
  }
  const tagList = tags
    .split(",")
    .map((t) => t.trim().replace(/^#!?/, ""))
    .filter(Boolean);

  return (
    <Dialog
      open={card !== null}
      onClose={onClose}
      title={card ? `Roles de ${card.card.name}` : ""}
      width={460}
      footer={
        <>
          {card?.roleSource === "deck" && canScopeToDeck && (
            <button
              type="button"
              className="btn mr-auto"
              disabled={busy}
              title="Vuelve a los roles de todos tus mazos (o a los automáticos)"
              onClick={() => onSave({ roles: [], primary: null, tags: [] }, "deck")}
            >
              Quitar la de este mazo
            </button>
          )}
          {card?.roleSource === "mine" && (
            <button
              type="button"
              className="btn mr-auto"
              disabled={busy}
              onClick={() => onSave({ roles: [], primary: null, tags: tagList }, "all")}
            >
              Volver a los automáticos
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || roles.length === 0}
            onClick={() => onSave({ roles, primary, tags: tagList }, scope)}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <p className="muted text-[13px]">
        {card?.roleSource === "auto"
          ? "Estos roles los ha puesto el clasificador automático. Si se equivoca, corrígelos:"
          : card?.roleSource === "list"
            ? "Estos roles vienen de las etiquetas de tu lista. Puedes cambiarlos:"
            : card?.roleSource === "deck"
              ? "Ya los habías corregido para este mazo. Puedes cambiarlos o quitar la corrección:"
              : "Ya los habías corregido. Puedes cambiarlos o volver a los automáticos."}{" "}
        cuentan para los mínimos y los cambios propuestos.
      </p>
      {canScopeToDeck && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="label mb-1">Dónde vale</legend>
          <label className="check text-[13.5px]">
            <input
              type="radio"
              name="role-scope"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />
            En todos mis mazos y en la colección
          </label>
          <label className="check text-[13.5px]">
            <input
              type="radio"
              name="role-scope"
              checked={scope === "deck"}
              onChange={() => setScope("deck")}
            />
            Solo en este mazo
          </label>
        </fieldset>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="label mb-1">Roles (el principal decide su grupo)</legend>
        {ROLES.map((r) => (
          <div key={r} className="flex items-center justify-between gap-3 text-[13.5px]">
            <label className="check">
              <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(r)} />
              {roleLabel(r)}
            </label>
            {roles.includes(r) && roles.length > 1 && (
              <label className="check subtle text-xs">
                <input
                  type="radio"
                  name="primary-role"
                  checked={primary === r}
                  onChange={() => setPrimary(r)}
                />
                principal
              </label>
            )}
          </div>
        ))}
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="role-tags">
          Etiquetas (opcional)
        </label>
        <input
          id="role-tags"
          className="input"
          value={tags}
          maxLength={200}
          placeholder="wincon, tesoros…"
          onChange={(e) => setTags(e.target.value)}
        />
        <span className="hint">
          Separadas por comas. Salen en la lista y al exportar como texto con etiquetas.
        </span>
      </div>
    </Dialog>
  );
}
