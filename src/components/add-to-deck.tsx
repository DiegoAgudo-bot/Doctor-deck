"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { IconDecks, IconPlus } from "./icons";
import { notifyDecksChanged } from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, Dialog, Loading } from "./ui";

interface AddableCard {
  oracleId: string;
  name: string;
  colorIdentity: readonly string[];
  canBeCommander?: boolean | undefined;
}

/**
 * «Añadir a un mazo» desde fuera del mazo (la colección, la ficha de la carta, la hoja del móvil):
 * elige uno de mis mazos guardados de los colores de la carta y se añade una copia. Si la carta
 * puede ser comandante, también «Crear mazo con ella». Sin sesión no se pinta (sin cuenta no hay
 * mazos guardados).
 */
export function AddToDeck({ card, className = "btn" }: { card: AddableCard; className?: string }) {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  if (!session) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <IconDecks size={14} />
        Añadir a un mazo
      </button>
      {open && <AddToDeckDialog card={card} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddToDeckDialog({ card, onClose }: { card: AddableCard; onClose: () => void }) {
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: string; name: string } | null>(null);
  const loading = decks === null && error === null;

  useEffect(() => {
    api<SavedDeckSummaryDTO[]>("/api/decks")
      .then(setDecks)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "No se pudieron cargar tus mazos"),
      );
  }, []);

  async function add(d: SavedDeckSummaryDTO) {
    setBusy(d.id);
    setError(null);
    setAdded(null);
    try {
      await api(`/api/decks/${encodeURIComponent(d.id)}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oracleId: card.oracleId }),
      });
      setAdded({ id: d.id, name: d.name });
      notifyDecksChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo añadir la carta");
    } finally {
      setBusy(null);
    }
  }

  const fits = (d: SavedDeckSummaryDTO) =>
    card.colorIdentity.every((c) => (d.colorIdentity as readonly string[]).includes(c));
  // Primero los mazos en los que cabe.
  const sorted = [...(decks ?? [])].sort((a, b) => Number(fits(b)) - Number(fits(a)));

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Añadir «${card.name}» a un mazo`}
      width={440}
      footer={
        <>
          {card.canBeCommander && (
            <Link className="btn mr-auto" href={`/decks/new?commander=${card.oracleId}`}>
              <IconPlus size={13} /> Crear mazo con ella
            </Link>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {added && (
          <Banner
            tone="in"
            action={<Link href={`/decks/${added.id}?tab=list`}>Abrir el mazo</Link>}
          >
            Añadida a «{added.name}».
          </Banner>
        )}
        {error && <Banner tone="out">{error}</Banner>}
        {loading && <Loading>Cargando tus mazos…</Loading>}
        {decks?.length === 0 && (
          <p className="muted text-[13px]">
            Aún no tienes mazos guardados.{" "}
            {card.canBeCommander ? (
              "Crea uno con esta carta de comandante."
            ) : (
              <Link href="/decks/new">Crea uno</Link>
            )}
          </p>
        )}
        {sorted.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Tus mazos">
            {sorted.map((d) => {
              const ok = fits(d);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className="deckrow w-full cursor-pointer border-0 bg-transparent text-left"
                    disabled={!ok || busy !== null}
                    onClick={() => void add(d)}
                    style={ok ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
                  >
                    <ColorPips colors={d.colorIdentity} className="pips" />
                    <span className="min-w-0">
                      <span className="nm">{d.name}</span>
                      <span className="cmd">
                        {busy === d.id
                          ? "Añadiendo…"
                          : ok
                            ? d.commanderNames.join(" + ")
                            : "Fuera de los colores del comandante"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
