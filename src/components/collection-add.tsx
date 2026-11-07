"use client";

import { useRef, useState } from "react";
import { LANGUAGES, languageBadge, languageLabel } from "@/domain/cards/languages";
import type { AddCardsResponse, CardDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardSearch } from "./card-search";
import { CardHover, CardImage } from "./card-image";
import { IconPlus, IconTrash } from "./icons";
import { localCollection, notifyCollectionChanged } from "./local-collection";
import { ManaCost } from "./mana";
import { Banner, ago } from "./ui";
import { useLocale, useT } from "./i18n";

/** Una carta añadida a mano (de la cuenta o del navegador), para listarla y poder quitarla. */
export interface AddedRow {
  id: string;
  card: Pick<CardDTO, "name" | "imageUrl" | "manaCost"> | null;
  name: string;
  quantity: number;
  foil: boolean;
  language?: string | null | undefined;
  addedAt: string;
}

/** Pestaña "Añadir cartas": buscador con autocompletado, cantidad y foil; y lo añadido a mano. */
export function AddCards({
  loggedIn,
  added,
  onRemove,
}: {
  loggedIn: boolean;
  added: AddedRow[];
  onRemove: (id: string) => Promise<void>;
}) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<CardDTO | null>(null);
  /** Cambia tras añadir: vacía el buscador (se vuelve a montar). */
  const [searchKey, setSearchKey] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [foil, setFoil] = useState(false);
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "in" | "out"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function add() {
    const card = selected;
    const qty = Math.min(999, Math.max(1, Math.round(Number(quantity) || 1)));
    if (!card) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<AddCardsResponse>("/api/collection/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: [{ oracleId: card.oracleId, quantity: qty, foil, language }],
        }),
      });
      if (res.saved) {
        notifyCollectionChanged();
      } else {
        localCollection.addCards(
          res.added.map((a) => ({
            oracleId: a.card.oracleId,
            name: a.card.name,
            quantity: a.quantity,
            foil: a.foil,
            language: a.language,
          })),
        );
      }
      setMessage({
        tone: "in",
        text: `${t("Añadida", "Added")}: ${qty} × ${card.name}${foil ? " (foil)" : ""}.`,
      });
      setSelected(null);
      setSearchKey((k) => k + 1);
      setQuantity("1");
      setFoil(false);
    } catch (err) {
      setMessage({
        tone: "out",
        text:
          err instanceof ApiError
            ? err.message
            : t("No se pudo añadir la carta", "Couldn't add the card"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="grid-1-sm grid items-start gap-4"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 260px" }}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <form
          className="panel flex flex-col gap-3 p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div
            className="grid-1-sm grid items-end gap-3"
            style={{ gridTemplateColumns: "minmax(0, 1fr) 90px 130px auto auto" }}
          >
            <CardSearch
              key={searchKey}
              id="add-card"
              autoFocus={searchKey > 0}
              label={t("Carta", "Card")}
              inputRef={inputRef}
              onPick={setSelected}
              onType={() => setSelected(null)}
            />
            <div className="field">
              <label className="label" htmlFor="add-qty">
                {t("Copias", "Copies")}
              </label>
              <input
                id="add-qty"
                className="input mono"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="add-lang">
                {t("Idioma", "Language")}
              </label>
              <select
                id="add-lang"
                className="select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {Object.keys(LANGUAGES).map((code) => (
                  <option key={code} value={code}>
                    {languageLabel(code, locale)}
                  </option>
                ))}
              </select>
            </div>
            <label className="check" style={{ height: 34, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={foil}
                onChange={(e) => setFoil(e.target.checked)}
                style={{ marginTop: 0 }}
              />
              Foil
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: 34 }}
              disabled={!selected || busy}
            >
              <IconPlus size={14} />
              {busy ? t("Añadiendo…", "Adding…") : t("Añadir", "Add")}
            </button>
          </div>
          {message && <Banner tone={message.tone}>{message.text}</Banner>}
          <p className="subtle text-xs">
            {loggedIn
              ? t(
                  "Se guardan en tu cuenta y se suman a lo importado del CSV; reimportar el CSV no las borra.",
                  "They're saved to your account on top of the CSV import; reimporting the CSV doesn't delete them.",
                )
              : t(
                  "Sin cuenta se guardan en este navegador, junto a lo importado del CSV.",
                  "Without an account they're saved in this browser, along with the CSV import.",
                )}
          </p>
        </form>

        <section className="panel">
          <div className="panel-h">
            <span className="h2">
              {t("Añadidas a mano", "Added by hand")}{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {added.length}
              </span>
            </span>
          </div>
          {added.length === 0 ? (
            <p className="muted p-3.5 text-[13px]">
              {t(
                "Aún no has añadido ninguna carta a mano.",
                "You haven't added any cards by hand yet.",
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Carta", "Card")}</th>
                    <th className="r">{t("Copias", "Copies")}</th>
                    <th className="hide-sm">{t("Copia", "Copy")}</th>
                    <th className="r hide-sm">{t("Añadida", "Added")}</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {added.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.card ? (
                          <CardHover card={a.card} className="inline-flex items-center gap-2">
                            {a.name}
                            <ManaCost cost={a.card.manaCost} />
                          </CardHover>
                        ) : (
                          a.name
                        )}
                      </td>
                      <td className="r mono">{a.quantity}</td>
                      <td className="hide-sm">
                        <span className="inline-flex gap-1">
                          {a.foil && <span className="pill pill-warn">foil</span>}
                          {a.language && a.language !== "en" && (
                            <span className="pill" title={languageLabel(a.language, locale)}>
                              {languageBadge(a.language)}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="r mono subtle hide-sm">{ago(a.addedAt, locale)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          style={{ width: 26, height: 26 }}
                          aria-label={t(`Quitar ${a.name}`, `Remove ${a.name}`)}
                          onClick={() => void onRemove(a.id)}
                        >
                          <IconTrash size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="panel hide-sm flex flex-col items-center gap-2 p-3">
        {selected ? (
          <>
            <CardImage card={selected} />
            <span className="subtle text-center text-xs">{selected.typeLine}</span>
          </>
        ) : (
          <>
            <div className="cardimg cardimg-missing" style={{ borderStyle: "dashed" }}>
              {t("Elige una carta", "Pick a card")}
            </div>
            <span className="subtle text-center text-xs">
              {t(
                "También puedes escanearlas con la app de Android.",
                "You can also scan them with the Android app.",
              )}
            </span>
          </>
        )}
      </aside>
    </div>
  );
}
