"use client";

import Link from "next/link";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { CardImage } from "./card-image";
import { IconEye, IconEyeOff, IconTrash } from "./icons";
import { ColorPips } from "./mana";
import { ago } from "./ui";

const SOURCE_LABEL: Record<string, string> = {
  text: "Texto",
  archidekt: "Archidekt",
  moxfield: "Moxfield",
};

/**
 * Tarjeta de un mazo (Mis mazos, perfiles, comunidad). Con `onToggleVisibility` / `onDelete`
 * (solo los míos) enseña los botones de público/privado y borrar; con `owner`, de quién es.
 */
export function DeckTile({
  deck: d,
  owner,
  onToggleVisibility,
  onDelete,
  delay = 0,
}: {
  deck: SavedDeckSummaryDTO;
  owner?: { username: string | null; name: string } | undefined;
  onToggleVisibility?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  delay?: number;
}) {
  const mine = Boolean(onToggleVisibility || onDelete);
  return (
    <div className="fade relative" style={{ ["--d" as string]: `${delay}ms` }}>
      <Link className="deckcard" href={`/decks/${d.id}`}>
        <div style={{ width: 74, flex: "none" }}>
          {d.commanderCard ? (
            <CardImage card={d.commanderCard} />
          ) : (
            <div className="cardimg cardimg-missing" />
          )}
        </div>
        <div className={`flex min-w-0 flex-1 flex-col gap-1 ${mine ? "pr-16" : ""}`}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{d.name}</span>
          <span className="muted flex flex-wrap items-center gap-2">
            <span className="truncate">{d.commanderNames.join(" + ")}</span>
            <ColorPips colors={d.colorIdentity} />
          </span>
          <span className="mono subtle flex flex-wrap gap-3 text-xs">
            {owner && <span>@{owner.username ?? owner.name}</span>}
            <span>{SOURCE_LABEL[d.source] ?? d.source}</span>
            <span>{d.cardCount} cartas</span>
            <span>{ago(d.updatedAt)}</span>
          </span>
          {mine && !d.isPublic && (
            <span className="pill subtle mt-auto">
              <IconEyeOff size={12} />
              Privado
            </span>
          )}
        </div>
      </Link>
      {mine && (
        <div className="absolute flex gap-0.5" style={{ top: 8, right: 8 }}>
          {onToggleVisibility && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28 }}
              aria-label={d.isPublic ? `Hacer privado ${d.name}` : `Hacer público ${d.name}`}
              title={
                d.isPublic
                  ? "Público: lo ve cualquiera. Clic para hacerlo privado"
                  : "Privado: solo lo ves tú. Clic para hacerlo público"
              }
              onClick={onToggleVisibility}
            >
              {d.isPublic ? <IconEye size={14} /> : <IconEyeOff size={14} />}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28 }}
              aria-label={`Borrar ${d.name}`}
              onClick={onDelete}
            >
              <IconTrash size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Cambia la visibilidad de uno de mis mazos (la API devuelve el nuevo estado). */
export async function setDeckVisibility(
  api: <T>(path: string, init?: RequestInit) => Promise<T>,
  id: string,
  isPublic: boolean,
) {
  return api<{ isPublic: boolean }>(`/api/decks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPublic }),
  });
}
