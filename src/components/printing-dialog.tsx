"use client";

import { useEffect, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDTO, PrintingDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { Dialog, Loading } from "./ui";

/**
 * Elegir la impresión de una carta del mazo: su imagen sale en el mazo y se escribe al exportar
 * (`1 Sol Ring (LEA) 270`). No cambia el análisis, que va por carta.
 */
export function PrintingDialog({
  card,
  busy,
  onClose,
  onPick,
}: {
  card: CardDTO | null;
  busy: boolean;
  onClose: () => void;
  /** null = sin impresión elegida (la de por defecto). */
  onPick: (printing: PrintingDTO | null) => void;
}) {
  const [printings, setPrintings] = useState<PrintingDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al abrir otra carta
    setPrintings(null);
    api<PrintingDTO[]>(`/api/cards/${encodeURIComponent(card.oracleId)}/printings`)
      .then((p) => !cancelled && setPrintings(p))
      .catch(
        (e: unknown) =>
          !cancelled && setError(e instanceof ApiError ? e.message : "Error al cargar"),
      );
    return () => {
      cancelled = true;
    };
  }, [card]);

  const current = card?.printing?.scryfallId ?? null;
  return (
    <Dialog
      open={card !== null}
      onClose={onClose}
      title={card ? `Edición de ${card.name}` : ""}
      width={720}
      footer={
        current ? (
          <button
            type="button"
            className="btn mr-auto"
            disabled={busy}
            onClick={() => onPick(null)}
          >
            Quitar la edición elegida
          </button>
        ) : undefined
      }
    >
      {error ? (
        <p className="text-[13px]" style={{ color: "var(--color-out)" }}>
          {error}
        </p>
      ) : !printings ? (
        <Loading>Buscando ediciones…</Loading>
      ) : (
        <>
          <p className="subtle text-xs">
            {printings.length} {printings.length === 1 ? "edición" : "ediciones"}, de la más nueva a
            la más vieja. Precio de Cardmarket (vía Scryfall), normal / foil.
          </p>
          <div
            className="grid gap-3 overflow-y-auto"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              maxHeight: "60vh",
            }}
          >
            {printings.map((p) => (
              <button
                key={p.scryfallId}
                type="button"
                disabled={busy}
                aria-pressed={p.scryfallId === current}
                className="flex cursor-pointer flex-col gap-1 rounded-md p-1 text-left"
                style={{
                  border: `2px solid ${p.scryfallId === current ? "var(--color-accent)" : "transparent"}`,
                  background: "none",
                  color: "inherit",
                }}
                onClick={() => onPick(p)}
              >
                <CardImage card={{ name: card?.name ?? "", imageUrl: p.imageUrl }} />
                <span className="truncate text-xs" title={p.setName ?? p.setCode}>
                  {p.setName ?? p.setCode.toUpperCase()}
                </span>
                <span className="mono subtle text-[11px]">
                  {p.setCode.toUpperCase()} #{p.collectorNumber}
                  {p.lang !== "en" ? ` · ${p.lang}` : ""}
                </span>
                <span className="mono subtle text-[11px]">
                  {p.priceEur !== null ? formatEuros(p.priceEur) : "—"}
                  {p.priceEurFoil !== null && ` / ${formatEuros(p.priceEurFoil)}`}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
