"use client";

import { useEffect, useState } from "react";
import { ROLES, type Role } from "@/domain/roles/types";
import type { CardRoleEditDTO, DeckCardDTO } from "@/server/dto";
import { roleLabel } from "./deck-views";
import { Dialog } from "./ui";

/**
 * Corregir los roles de una carta (y ponerle etiquetas libres). Vale para todos tus mazos y para
 * la colección; los mínimos por rol y los cambios propuestos usan los roles corregidos.
 */
export function RoleEditDialog({
  card,
  busy,
  onClose,
  onSave,
}: {
  card: DeckCardDTO | null;
  busy: boolean;
  onClose: () => void;
  /** Roles vacíos = volver a los automáticos. */
  onSave: (edit: CardRoleEditDTO) => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [primary, setPrimary] = useState<Role | null>(null);
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!card) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reiniciar el formulario al abrir
    setRoles(card.roles);
    setPrimary(card.primaryRole);
    setTags(card.tags.join(", "));
  }, [card]);

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
          {card?.roleSource === "mine" && (
            <button
              type="button"
              className="btn mr-auto"
              disabled={busy}
              onClick={() => onSave({ roles: [], primary: null, tags: tagList })}
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
            onClick={() => onSave({ roles, primary, tags: tagList })}
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
            : "Ya los habías corregido. Puedes cambiarlos o volver a los automáticos."}{" "}
        valen para todos tus mazos y cuentan para los mínimos y los cambios propuestos.
      </p>
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
          Separadas por comas. Salen en la lista y al exportar en formato Moxfield.
        </span>
      </div>
    </Dialog>
  );
}
