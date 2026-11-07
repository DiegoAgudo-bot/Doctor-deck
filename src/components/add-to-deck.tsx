"use client";

import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { IconDecks, IconPlus } from "./icons";
import { notifyDecksChanged } from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, Dialog, Loading } from "./ui";
import { Link, useT } from "@/components/i18n";

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
  const t = useT();
  if (!session) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <IconDecks size={14} />
        {t("Añadir a un mazo", "Add to a deck")}
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
  const t = useT();

  useEffect(() => {
    api<SavedDeckSummaryDTO[]>("/api/decks")
      .then(setDecks)
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError
            ? e.message
            : t("No se pudieron cargar tus mazos", "Couldn't load your decks"),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` no cambia en la página
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
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo añadir la carta", "Couldn't add the card"),
      );
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
      title={t(`Añadir «${card.name}» a un mazo`, `Add “${card.name}” to a deck`)}
      width={440}
      footer={
        <>
          {card.canBeCommander && (
            <Link className="btn mr-auto" href={`/decks/new?commander=${card.oracleId}`}>
              <IconPlus size={13} /> {t("Crear mazo con ella", "Build a deck with it")}
            </Link>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t("Cerrar", "Close")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {added && (
          <Banner
            tone="in"
            action={
              <Link href={`/decks/${added.id}?tab=list`}>
                {t("Abrir el mazo", "Open the deck")}
              </Link>
            }
          >
            {t(`Añadida a «${added.name}».`, `Added to “${added.name}”.`)}
          </Banner>
        )}
        {error && <Banner tone="out">{error}</Banner>}
        {loading && <Loading>{t("Cargando tus mazos…", "Loading your decks…")}</Loading>}
        {decks?.length === 0 && (
          <p className="muted text-[13px]">
            {t("Aún no tienes mazos guardados.", "You don't have any saved decks yet.")}{" "}
            {card.canBeCommander ? (
              t("Crea uno con esta carta de comandante.", "Create one with this card as commander.")
            ) : (
              <Link href="/decks/new">{t("Crea uno", "Create one")}</Link>
            )}
          </p>
        )}
        {sorted.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label={t("Tus mazos", "Your decks")}>
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
                          ? t("Añadiendo…", "Adding…")
                          : ok
                            ? d.commanderNames.join(" + ")
                            : t(
                                "Fuera de los colores del comandante",
                                "Outside the commander's colors",
                              )}
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
