"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COLORS } from "@/domain/cards/types";
import { suggestedDeckName } from "@/domain/deck/naming";
import type { DeckVisibility } from "@/domain/deck/visibility";
import type { CardDTO, CommanderInfoDTO, NewDeckResponse } from "@/server/dto";
import { api, ApiError, storage } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { CardSearch } from "./card-search";
import { VisibilityPicker } from "./deck-visibility";
import { IconX } from "./icons";
import { notifyDecksChanged } from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, Loading, fmt } from "./ui";

type Mode = "average" | "empty";

const shortName = (name: string) => name.split(/,| \/\/ /)[0] ?? name;
const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString("es", { maximumFractionDigits: 1 })}K` : String(n);

/**
 * /mazos/nuevo: crear un mazo eligiendo el comandante (el mazo medio de EDHREC, general o de un
 * tema, o vacío para montarlo desde cero) o importando una lista. El nombre se propone solo:
 * "<colores> - <de qué va>".
 */
export function NewDeckWizard() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const [commanders, setCommanders] = useState<CardDTO[]>([]);
  const [pairing, setPairing] = useState(false);
  const [info, setInfo] = useState<CommanderInfoDTO | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [mode, setMode] = useState<Mode>("average");
  const [theme, setTheme] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [visibility, setVisibility] = useState<DeckVisibility>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al cambiar de comandante(s): sus temas en EDHREC.
  const ids = commanders.map((c) => c.oracleId).join(",");
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al elegir comandante
    setLoadingInfo(true);
    setError(null);
    api<CommanderInfoDTO>(`/api/commanders?ids=${encodeURIComponent(ids)}`)
      .then((i) => !cancelled && setInfo(i))
      .catch((e: unknown) => {
        if (cancelled) return;
        setInfo(null);
        setError(e instanceof ApiError ? e.message : "No se pudo consultar EDHREC");
      })
      .finally(() => !cancelled && setLoadingInfo(false));
    return () => {
      cancelled = true;
    };
  }, [ids]);

  // Nombre propuesto: "<colores> - <tema elegido o los dos más jugados>" (o el comandante, vacío).
  const chosenTheme = info?.themes.find((t) => t.slug === theme);
  const proposed =
    commanders.length === 0
      ? ""
      : suggestedDeckName(
          COLORS.filter((c) => commanders.some((x) => x.colorIdentity.includes(c))),
          mode === "empty"
            ? []
            : chosenTheme
              ? [chosenTheme.name]
              : (info?.themes ?? []).map((t) => t.name),
          shortName(commanders[0]?.name ?? ""),
        );
  const finalName = nameTouched ? name : proposed;

  function pick(card: CardDTO) {
    setCommanders((prev) => (pairing ? [...prev.slice(0, 1), card] : [card]));
    setPairing(false);
    setTheme("");
    setNameTouched(false);
  }

  async function create() {
    if (commanders.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<NewDeckResponse>("/api/decks/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commanderIds: commanders.map((c) => c.oracleId),
          mode,
          ...(mode === "average" && theme ? { theme } : {}),
          ...(finalName.trim() ? { name: finalName.trim() } : {}),
          visibility,
        }),
      });
      const tab = mode === "empty" ? "lista&editar=1" : "falta";
      if (res.saved && res.id) {
        notifyDecksChanged();
        router.push(`/decks/${res.id}?tab=${tab}`);
      } else {
        // Sin cuenta: se abre en el analizador (el mazo queda en este navegador).
        storage.set("deck-doctor:mazo", {
          input: res.input,
          theme: res.theme ?? "",
          name: res.name,
          locked: [],
          excluded: [],
          deckId: null,
          useOtherDecks: true,
          visibility: "public",
        });
        router.push(`/mazo?analizar=1&tab=${tab}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo crear el mazo");
      setBusy(false);
    }
  }

  return (
    <main className="page max-w-[980px]" style={{ gap: 20 }}>
      <div className="flex flex-col gap-1">
        <h1 className="h1">Nuevo mazo</h1>
        <p className="muted text-[13px]">
          Elige el comandante y te monto el mazo con lo que juega la comunidad en EDHREC, o empieza
          desde cero. ¿Ya tienes la lista? <Link href="/mazo?nuevo=1">Impórtala</Link>.
        </p>
      </div>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">1 · El comandante</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          {commanders.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {commanders.map((c) => (
                <div key={c.oracleId} className="relative" style={{ width: 150 }}>
                  <CardImage card={c} />
                  <button
                    type="button"
                    className="btn btn-icon absolute"
                    style={{ top: 6, right: 6, width: 26, height: 26 }}
                    aria-label={`Quitar ${c.name}`}
                    onClick={() => {
                      setCommanders((prev) => prev.filter((x) => x.oracleId !== c.oracleId));
                      setInfo(null);
                    }}
                  >
                    <IconX size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {(commanders.length === 0 || pairing) && (
            <div style={{ maxWidth: 420 }}>
              <CardSearch
                id="commander"
                label={
                  pairing ? "Segundo comandante (partner, background…)" : "Busca tu comandante"
                }
                filters={{ commander: true }}
                autoFocus
                clearOnPick
                onPick={pick}
              />
            </div>
          )}
          {commanders.length === 1 && !pairing && (
            <button
              type="button"
              className="btn btn-ghost self-start"
              onClick={() => setPairing(true)}
            >
              Añadir un segundo comandante (partner, background…)
            </button>
          )}
        </div>
      </section>

      {commanders.length > 0 && (
        <section className="panel fade">
          <div className="panel-h">
            <span className="h2">2 · Cómo lo montas</span>
            {info?.totalDecks !== null && info?.totalDecks !== undefined && (
              <span className="subtle text-xs">{fmt(info.totalDecks)} mazos en EDHREC</span>
            )}
          </div>
          <div className="flex flex-col gap-4 p-3.5">
            <div
              className="grid-1-sm grid gap-3"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              {(
                [
                  [
                    "average",
                    "Con el mazo medio de EDHREC",
                    "Las ~99 cartas que juega de media la gente con este comandante. Después te digo qué tienes, qué te falta y qué cambiar.",
                  ],
                  [
                    "empty",
                    "Desde cero",
                    "Solo el comandante. Añades tú las cartas una a una, con sugerencias de tu colección.",
                  ],
                ] as const
              ).map(([m, title, text]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className="flex cursor-pointer flex-col gap-1 rounded-lg p-3 text-left"
                  style={{
                    border: `1px solid ${mode === m ? "var(--color-accent)" : "var(--color-line)"}`,
                    background: mode === m ? "var(--color-hover)" : "transparent",
                    color: "inherit",
                  }}
                >
                  <span className="h2">{title}</span>
                  <span className="muted text-[13px]">{text}</span>
                </button>
              ))}
            </div>

            {mode === "average" && (
              <div className="field">
                <span className="label">Tema de EDHREC</span>
                {loadingInfo ? (
                  <Loading>Consultando EDHREC…</Loading>
                ) : (
                  <div className="chips" role="radiogroup" aria-label="Tema">
                    {[
                      { slug: "", name: "General", count: info?.totalDecks ?? null },
                      ...(info?.themes ?? []).slice(0, 14),
                    ].map((t) => (
                      <button
                        key={t.slug || "general"}
                        type="button"
                        role="radio"
                        aria-checked={theme === t.slug}
                        className={`chipbtn ${theme === t.slug ? "is-on" : ""}`}
                        onClick={() => setTheme(t.slug)}
                      >
                        {t.name}
                        {t.count !== null && <span className="n">{compact(t.count)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="field" style={{ maxWidth: 480 }}>
              <label className="label" htmlFor="deck-name">
                Nombre
              </label>
              <div className="flex items-center gap-2">
                <ColorPips colors={[...new Set(commanders.flatMap((c) => c.colorIdentity))]} />
                <input
                  id="deck-name"
                  className="input"
                  value={finalName}
                  maxLength={120}
                  onChange={(e) => {
                    setNameTouched(true);
                    setName(e.target.value);
                  }}
                />
              </div>
              <span className="hint">Colores - de qué va el mazo. Puedes cambiarlo.</span>
            </div>

            {loggedIn ? (
              <VisibilityPicker value={visibility} onChange={setVisibility} />
            ) : (
              <Banner tone="info">
                Sin cuenta, el mazo se abre en el analizador y se queda en este navegador.{" "}
                <Link href="/registro?next=/mazos/nuevo">Crea una cuenta</Link> para guardarlo.
              </Banner>
            )}

            {error && <Banner tone="out">{error}</Banner>}
            <div className="flex justify-end border-t border-line pt-3">
              <button
                type="button"
                className="btn btn-primary btn-lg full-sm"
                disabled={busy || (mode === "average" && loadingInfo)}
                onClick={() => void create()}
              >
                {busy ? "Creando…" : mode === "average" ? "Crear con el mazo medio" : "Crear vacío"}
              </button>
            </div>
            {busy && mode === "average" && (
              <Loading>Montando el mazo medio con los datos de EDHREC…</Loading>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
