"use client";

import Link from "next/link";
import type { DeckOwnershipSummary } from "@/domain/community/rank";
import { formatEuros } from "@/domain/suggestions/format";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { CardImage } from "./card-image";
import { nextVisibility, VISIBILITY } from "./deck-visibility";
import { IconCopy, IconHeart, IconPencil, IconTrash } from "./icons";
import { ColorPips } from "./mana";
import { ago } from "./ui";

const SOURCE_LABEL: Record<string, string> = {
  text: "Texto",
  archidekt: "Archidekt",
  moxfield: "Moxfield",
};

/**
 * Tarjeta de un mazo (Mis mazos, perfiles, comunidad). Con `onToggleVisibility` / `onDelete`
 * (solo los míos) enseña los botones de visibilidad (público → oculto → privado) y borrar; con `owner`, de quién es.
 */
export function DeckTile({
  deck: d,
  owner,
  onToggleVisibility,
  onDelete,
  onRename,
  onDuplicate,
  ownership,
  likes,
  bracket,
  delay = 0,
}: {
  deck: SavedDeckSummaryDTO;
  owner?: { username: string | null; name: string } | undefined;
  onToggleVisibility?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onRename?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  /** Cuánto del mazo tengo yo (Comunidad, perfiles de otros). */
  ownership?: DeckOwnershipSummary | undefined;
  likes?: number | undefined;
  bracket?: number | null | undefined;
  delay?: number;
}) {
  const mine = Boolean(onToggleVisibility || onDelete);
  const Vis = VISIBILITY[d.visibility].Icon;
  const next = nextVisibility(d.visibility);
  const actions = [onRename, onDuplicate, onToggleVisibility, onDelete].filter(Boolean).length;
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
        <div
          className="flex min-w-0 flex-1 flex-col gap-1"
          style={{ paddingRight: mine ? actions * 28 + 4 : 0 }}
        >
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
            {bracket != null && <span>Bracket {bracket}</span>}
            {likes !== undefined && likes > 0 && (
              <span className="inline-flex items-center gap-1">
                <IconHeart size={11} filled />
                {likes}
              </span>
            )}
          </span>
          {ownership && <OwnershipBar o={ownership} />}
          {mine && d.visibility !== "public" && (
            <span className="pill subtle mt-auto">
              <Vis size={12} />
              {VISIBILITY[d.visibility].label}
            </span>
          )}
        </div>
      </Link>
      {mine && (
        <div className="absolute flex gap-0.5" style={{ top: 8, right: 8 }}>
          {onRename && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28 }}
              aria-label={`Cambiar el nombre de ${d.name}`}
              title="Cambiar el nombre"
              onClick={onRename}
            >
              <IconPencil size={14} />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28 }}
              aria-label={`Duplicar ${d.name}`}
              title="Duplicar"
              onClick={onDuplicate}
            >
              <IconCopy size={14} />
            </button>
          )}
          {onToggleVisibility && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28 }}
              aria-label={`${VISIBILITY[d.visibility].label}: cambiar a ${VISIBILITY[next].label.toLowerCase()} ${d.name}`}
              title={`${VISIBILITY[d.visibility].label}: ${VISIBILITY[d.visibility].hint} Clic para hacerlo ${VISIBILITY[next].label.toLowerCase()}.`}
              onClick={onToggleVisibility}
            >
              <Vis size={14} />
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

/** "Tienes el 72 % · faltan 12 (≈ 35,40 €)" con una barra. */
function OwnershipBar({ o }: { o: DeckOwnershipSummary }) {
  return (
    <span className="mt-auto flex flex-col gap-1 pt-1">
      <span className="text-xs">
        <b style={{ color: o.toBuy ? undefined : "var(--color-in)" }}>Tienes el {o.percent} %</b>
        <span className="subtle">
          {o.toBuy
            ? ` · faltan ${o.toBuy}${o.cost ? ` (≈ ${formatEuros(o.cost)}${o.unpriced ? "+" : ""})` : ""}`
            : o.fromOtherDecks
              ? ` · ${o.fromOtherDecks} en otros mazos`
              : " · ¡lo puedes montar ya!"}
        </span>
      </span>
      <span className="role-bar" style={{ height: 4 }}>
        <i style={{ width: `${o.percent}%` }} />
      </span>
    </span>
  );
}
