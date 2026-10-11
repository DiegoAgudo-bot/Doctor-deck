"use client";

import { useCallback, useEffect, useState } from "react";
import { CONDITIONS, conditionShort } from "@/domain/cards/conditions";
import { LANGUAGES } from "@/domain/cards/languages";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDTO, CollectionLineDTO, PrintingDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { IconMinus, IconPlus, IconTrash } from "./icons";
import { LendDialog } from "./loans-page";
import { Banner, Dialog, Loading } from "./ui";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Una carta de mi colección, copia a copia: edición, foil, idioma, estado y cuántas, o quitarla.
 * Vale también para lo importado del CSV (al editarlo deja de depender del CSV). Cada cambio se
 * guarda al momento y `onChanged` avisa para refrescar la colección.
 */
export function CollectionCardDialog({
  card,
  onClose,
  onChanged,
}: {
  card: CardDTO | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [lines, setLines] = useState<CollectionLineDTO[] | null>(null);
  const [printings, setPrintings] = useState<PrintingDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** La copia cuya imagen se enseña (la primera, o la última que se ha tocado). */
  const [focus, setFocus] = useState<string | null>(null);
  const [lending, setLending] = useState(false);

  const load = useCallback(async (oracleId: string) => {
    try {
      const [l, p] = await Promise.all([
        api<CollectionLineDTO[]>(`/api/collection/lines?oracleId=${encodeURIComponent(oracleId)}`),
        api<PrintingDTO[]>(`/api/cards/${encodeURIComponent(oracleId)}/printings`),
      ]);
      setLines(l);
      setPrintings(p);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar la carta");
    }
  }, []);

  useEffect(() => {
    if (!card) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al abrir otra carta
    setLines(null);
    setFocus(null);
    void load(card.oracleId);
  }, [card, load]);

  async function run(lineId: string, action: () => Promise<unknown>) {
    if (!card) return;
    setBusy(lineId);
    setFocus(lineId);
    try {
      await action();
      await load(card.oracleId);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  }
  const patch = (line: CollectionLineDTO, body: Record<string, unknown>) =>
    run(line.id, () =>
      api(`/api/collection/lines/${encodeURIComponent(line.id)}`, {
        method: "PATCH",
        ...json(body),
      }),
    );
  const remove = (line: CollectionLineDTO) =>
    run(line.id, () =>
      api(`/api/collection/lines/${encodeURIComponent(line.id)}`, { method: "DELETE" }),
    );
  const addCopy = () =>
    card &&
    run("new", () =>
      api("/api/collection/cards", {
        method: "POST",
        ...json({ cards: [{ oracleId: card.oracleId, quantity: 1 }] }),
      }),
    );

  const shown = lines?.find((l) => l.id === focus) ?? lines?.[0];
  const copies = lines?.reduce((n, l) => n + l.quantity, 0) ?? 0;
  const value = lines?.reduce((n, l) => n + (l.unitPrice ?? 0) * l.quantity, 0) ?? 0;

  return (
    <Dialog
      open={card !== null}
      onClose={onClose}
      title={card?.name ?? ""}
      width={860}
      headerExtra={
        lines && lines.length > 0 ? (
          <span className="mono subtle text-xs">
            {copies} {copies === 1 ? "copia" : "copias"} · {formatEuros(value)}
          </span>
        ) : null
      }
      footer={
        <>
          <button
            type="button"
            className="btn mr-auto"
            disabled={busy !== null}
            onClick={() => void addCopy()}
          >
            <IconPlus size={13} /> Añadir otra copia
          </button>
          {lines && lines.length > 0 && (
            <button type="button" className="btn" onClick={() => setLending(true)}>
              Prestar
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Hecho
          </button>
        </>
      }
    >
      {error && <Banner tone="out">{error}</Banner>}
      {!lines && !error && <Loading>Cargando tus copias…</Loading>}
      {lines && (
        <div className="cardsheet">
          <div className="cardsheet-art">
            {shown ? <CardImage card={shown.card} /> : card && <CardImage card={card} />}
            {card?.typeLine && <p className="subtle text-xs">{card.typeLine}</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-2.5">
            {lines.length === 0 && (
              <p className="muted text-[13px]">Ya no tienes copias de esta carta.</p>
            )}
            {lines.map((l) => (
              <article
                key={l.id}
                className={`copyrow ${focus === l.id ? "is-focus" : ""}`}
                onMouseEnter={() => setFocus(l.id)}
                aria-busy={busy === l.id}
              >
                <div className="copyrow-head">
                  <span className="qty">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label="Una copia menos"
                      disabled={busy !== null}
                      onClick={() => void patch(l, { quantity: l.quantity - 1 })}
                    >
                      <IconMinus size={12} />
                    </button>
                    <span className="mono">{l.quantity}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label="Una copia más"
                      disabled={busy !== null || l.quantity >= 999}
                      onClick={() => void patch(l, { quantity: l.quantity + 1 })}
                    >
                      <IconPlus size={12} />
                    </button>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {l.foil && <span className="pill pill-foil">foil</span>}
                    {l.condition && (
                      <span
                        className="pill"
                        title={CONDITIONS[l.condition as keyof typeof CONDITIONS]?.label}
                      >
                        {conditionShort(l.condition)}
                      </span>
                    )}
                    <span className="pill subtle">{l.source === "csv" ? "del CSV" : "a mano"}</span>
                  </span>
                  <span className="mono text-[13px]">
                    {l.unitPrice !== null ? formatEuros(l.unitPrice * l.quantity) : "—"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label="Quitar estas copias"
                    title="Quitar de la colección"
                    disabled={busy !== null}
                    onClick={() => void remove(l)}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
                <div className="copyrow-fields">
                  <label className="field">
                    <span className="label">Edición</span>
                    <select
                      className="select"
                      value={l.printing?.scryfallId ?? ""}
                      disabled={busy !== null}
                      onChange={(e) =>
                        e.target.value && void patch(l, { scryfallId: e.target.value })
                      }
                    >
                      {!l.printing && <option value="">Sin elegir</option>}
                      {printings.map((p) => (
                        <option key={p.scryfallId} value={p.scryfallId}>
                          {p.setCode.toUpperCase()} {p.collectorNumber}
                          {p.setName ? ` · ${p.setName}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Idioma</span>
                    <select
                      className="select"
                      value={l.language ?? ""}
                      disabled={busy !== null}
                      onChange={(e) => void patch(l, { language: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {Object.entries(LANGUAGES).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Estado</span>
                    <select
                      className="select"
                      value={l.condition ?? ""}
                      disabled={busy !== null}
                      onChange={(e) => void patch(l, { condition: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {Object.entries(CONDITIONS).map(([code, c]) => (
                        <option key={code} value={code}>
                          {c.short} · {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check self-end pb-1.5">
                    <input
                      type="checkbox"
                      checked={l.foil}
                      disabled={busy !== null}
                      onChange={(e) => void patch(l, { foil: e.target.checked })}
                    />
                    Foil
                  </label>
                </div>
              </article>
            ))}
            {lines.some((l) => l.source === "csv") && (
              <p className="subtle text-xs">
                Al editar una copia del CSV pasa a llevarse solo aquí. Si ya gestionas tu colección
                en Doctor Deck, no vuelvas a importar el CSV de ManaBox: sus cartas se sumarían otra
                vez.
              </p>
            )}
          </div>
        </div>
      )}
      <LendDialog
        card={lending ? card : null}
        onClose={() => setLending(false)}
        onDone={() => {
          setLending(false);
          onChanged();
        }}
      />
    </Dialog>
  );
}
