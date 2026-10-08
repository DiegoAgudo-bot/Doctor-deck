"use client";

import { useEffect, useMemo, useState } from "react";
import { applySwaps, exportDecklist, type ExportableDeck } from "@/domain/deck/export";
import type { AnalyzeResponse, CardDTO } from "@/server/dto";
import { api, ApiError, storage } from "./api-client";
import { CardImage } from "./card-image";
import { DeckCardList } from "./deck-card-list";
import { ExportPanel } from "./export-panel";
import { ManaCurve } from "./mana-curve";
import { RoleSummary } from "./role-summary";
import { SwapItem, type Decision } from "./swap-item";
import { Alert, Section, buttonClass } from "./ui";

interface Saved {
  input: string;
  theme: string;
  locked: string[];
  excluded: string[];
}

const KEY = "deck-doctor:mazo";
const EMPTY: Saved = { input: "", theme: "", locked: [], excluded: [] };

type Ok = Extract<AnalyzeResponse, { status: "ok" }>;

export function DeckDoctor() {
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Restaurar lo último que se analizó (solo en el navegador)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar
    setSaved({ ...EMPTY, ...storage.get<Partial<Saved>>(KEY, {}) });
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) storage.set(KEY, saved);
  }, [saved, hydrated]);

  const update = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }));
  const locked = useMemo(() => new Set(saved.locked), [saved.locked]);

  async function analyze(next: Partial<Saved> = {}, commanders: string[] = chosen) {
    const req = { ...saved, ...next };
    if (!req.input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<AnalyzeResponse>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: req.input,
          ...(req.theme ? { theme: req.theme } : {}),
          ...(commanders.length > 0 ? { commanders } : {}),
          locked: req.locked,
          excluded: req.excluded,
        }),
      });
      setResult(res);
      setDecisions({});
      setDirty(false);
      update(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo analizar el mazo");
    } finally {
      setBusy(false);
    }
  }

  const ok = result?.status === "ok" ? result : null;
  const accepted = ok ? ok.swaps.filter((s) => decisions[s.id] === "accepted") : [];
  const rejected = ok ? ok.swaps.filter((s) => decisions[s.id] === "rejected") : [];

  const baseDeck: ExportableDeck | null = ok
    ? {
        commanders: ok.commanders,
        cards: ok.cards.map((c) => ({
          oracleId: c.card.oracleId,
          name: c.card.name,
          quantity: c.quantity,
        })),
      }
    : null;
  const finalDeck = baseDeck
    ? applySwaps(
        baseDeck,
        accepted.map((s) => ({ outOracleId: s.out.card.oracleId, in: s.in.card })),
      )
    : null;
  const exportText = finalDeck ? exportDecklist(finalDeck) : "";

  /** Aplica los aceptados a la lista, excluye los descartados y vuelve a analizar. */
  function applyAndRecalculate() {
    if (!finalDeck) return;
    void analyze({
      input: exportDecklist(finalDeck),
      excluded: [...new Set([...saved.excluded, ...rejected.map((s) => s.in.card.oracleId)])],
    });
  }

  function toggleLock(oracleId: string) {
    const next = new Set(saved.locked);
    if (next.has(oracleId)) next.delete(oracleId);
    else next.add(oracleId);
    update({ locked: [...next] });
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setChosen([]);
          void analyze({}, []);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>Lista del mazo</span>
          <textarea
            value={saved.input}
            onChange={(e) => update({ input: e.target.value })}
            rows={8}
            placeholder={
              "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1x Arcane Signet (C21) 263\n…"
            }
            className="w-full rounded-lg border border-zinc-300 p-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy || !saved.input.trim()}
            className={buttonClass.primary}
          >
            {busy ? "Analizando…" : "Analizar"}
          </button>
          {(saved.locked.length > 0 || saved.excluded.length > 0) && (
            <button
              type="button"
              className={buttonClass.secondary}
              onClick={() => {
                update({ locked: [], excluded: [] });
                setDirty(true);
              }}
            >
              Olvidar bloqueos y descartes ({saved.locked.length + saved.excluded.length})
            </button>
          )}
        </div>
      </form>

      {error && <Alert tone="error">{error}</Alert>}

      {result?.status === "needs_commander" && (
        <CommanderPicker
          candidates={result.candidates}
          chosen={chosen}
          onToggle={(id) =>
            setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)))
          }
          onConfirm={() => void analyze({}, chosen)}
          busy={busy}
        />
      )}

      {ok && (
        <>
          <Overview
            ok={ok}
            theme={saved.theme}
            onTheme={(theme) => void analyze({ theme })}
            busy={busy}
          />

          <Section
            title={`Cambios sugeridos (${ok.swaps.length})`}
            aside={
              <span className="text-xs text-zinc-500">
                {accepted.length} aceptados · {rejected.length} descartados
              </span>
            }
          >
            {ok.swaps.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No hay cartas de tu colección que mejoren el mazo con la configuración actual.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {ok.swaps.map((s) => (
                  <SwapItem
                    key={s.id}
                    swap={s}
                    decision={decisions[s.id]}
                    onDecide={(d) =>
                      setDecisions((prev) => {
                        const next = { ...prev };
                        if (d) next[s.id] = d;
                        else delete next[s.id];
                        return next;
                      })
                    }
                  />
                ))}
              </ul>
            )}
            {(accepted.length > 0 || rejected.length > 0 || dirty) && (
              <div className="sticky bottom-3 flex justify-center">
                <button
                  type="button"
                  onClick={applyAndRecalculate}
                  disabled={busy}
                  className={`${buttonClass.primary} shadow-lg`}
                >
                  {busy ? "Recalculando…" : "Aplicar cambios y recalcular"}
                </button>
              </div>
            )}
          </Section>

          <Section
            title="Cartas del mazo"
            aside={<span className="text-xs text-zinc-500">🔒 = no cortar</span>}
          >
            <DeckCardList cards={ok.cards} locked={locked} onToggleLock={toggleLock} />
          </Section>

          <Section title="Exportar">
            <p className="text-xs text-zinc-500">Incluye los cambios aceptados.</p>
            <ExportPanel text={exportText} />
          </Section>
        </>
      )}
    </div>
  );
}

function CommanderPicker({
  candidates,
  chosen,
  onToggle,
  onConfirm,
  busy,
}: {
  candidates: CardDTO[];
  chosen: string[];
  onToggle: (oracleId: string) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Section title="¿Cuál es el comandante?">
      {candidates.length === 0 ? (
        <Alert tone="warning">
          No hay ninguna carta que pueda ser comandante en la lista. Márcalo con una sección
          &quot;Commander&quot; o con *CMDR*.
        </Alert>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            Elige uno (o dos si son pareja: partner, background…).
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {candidates.map((c) => (
              <li key={c.oracleId}>
                <button
                  type="button"
                  aria-pressed={chosen.includes(c.oracleId)}
                  onClick={() => onToggle(c.oracleId)}
                  className={`w-full rounded-xl p-1 ${chosen.includes(c.oracleId) ? "ring-4 ring-sky-500" : ""}`}
                >
                  <CardImage card={c} className="w-full" />
                </button>
              </li>
            ))}
          </ul>
          <div>
            <button
              type="button"
              disabled={chosen.length === 0 || busy}
              onClick={onConfirm}
              className={buttonClass.primary}
            >
              Usar como comandante
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

function Overview({
  ok,
  theme,
  onTheme,
  busy,
}: {
  ok: Ok;
  theme: string;
  onTheme: (theme: string) => void;
  busy: boolean;
}) {
  return (
    <>
      <div className="flex gap-4">
        <div className="flex w-28 shrink-0 flex-col gap-1 sm:w-36">
          {ok.commanders.map((c) => (
            <CardImage key={c.oracleId} card={c} className="w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-2 text-sm">
          <h2 className="text-lg font-semibold">{ok.commanders.map((c) => c.name).join(" + ")}</h2>
          <p>
            {ok.totalCards} cartas · EDHREC: {ok.edhrec.totalDecks?.toLocaleString("es") ?? "?"}{" "}
            mazos
          </p>
          {ok.edhrec.themes.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Tema de EDHREC</span>
              <select
                value={theme}
                disabled={busy}
                onChange={(e) => onTheme(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-background p-1.5 dark:border-zinc-700"
              >
                <option value="">General</option>
                {ok.edhrec.themes.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                    {t.count !== null ? ` (${t.count})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {ok.edhrec.warning && <Alert tone="warning">{ok.edhrec.warning}</Alert>}
      {ok.issues.length > 0 && (
        <Alert tone="warning">
          <ul className="list-disc pl-5">
            {ok.issues.map((i, idx) => (
              <li key={idx}>{i.message}</li>
            ))}
          </ul>
        </Alert>
      )}
      {(ok.unresolved.length > 0 || ok.skipped.length > 0) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-500">
            {ok.unresolved.length} cartas no encontradas · {ok.skipped.length} líneas ignoradas
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {ok.unresolved.map((n) => (
              <li key={`u-${n}`}>No encontrada: {n}</li>
            ))}
            {ok.skipped.map((s) => (
              <li key={`s-${s.line}`}>
                Línea {s.line}: {s.text.trim()} — {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Section title="Curva de maná">
        <ManaCurve curve={ok.curve} />
      </Section>
      <Section title="Roles">
        <RoleSummary roles={ok.roles} />
      </Section>
    </>
  );
}
