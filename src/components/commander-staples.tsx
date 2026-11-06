"use client";

import { useEffect, useMemo, useState } from "react";
import { sectionLabel } from "@/domain/recommendations/sections";
import type { CommanderStaplesDTO, StapleDTO } from "@/server/card-dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { Banner, Loading, useFormat } from "./ui";
import { Link, useLocale, useT } from "@/components/i18n";

type Show = "all" | "owned" | "missing";

const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));

function StapleTile({ s }: { s: StapleDTO }) {
  const inc = pct(s.inclusion);
  const syn = pct(s.synergy);
  const t = useT();
  const { eur } = useFormat();
  return (
    <Link href={`/cards/${s.card.oracleId}`} className="staple">
      <span className="cardbtn">
        <CardImage card={s.card} sizes="(max-width: 760px) 30vw, 160px" />
      </span>
      {s.mine && (
        <span
          className={`staple-own ${s.mine.free > 0 ? "free" : "busy"}`}
          title={
            s.mine.free > 0
              ? t(
                  `Tienes ${s.mine.owned} (${s.mine.free} libres)`,
                  `You own ${s.mine.owned} (${s.mine.free} free)`,
                )
              : t(
                  `Tienes ${s.mine.owned}, todas en mazos o prestadas`,
                  `You own ${s.mine.owned}, all in decks or lent out`,
                )
          }
        >
          {s.mine.free > 0 ? t("La tienes", "Owned") : t("En tus mazos", "In your decks")}
        </span>
      )}
      <span className="staple-name truncate">{s.card.name}</span>
      {inc !== null && (
        <span className="staple-bar" style={{ ["--w" as string]: `${inc}%` }}>
          <span>{t(`${inc} % de mazos`, `${inc}% of decks`)}</span>
        </span>
      )}
      <span className="staple-meta">
        {syn !== null && (
          <span className={syn > 0 ? "text-in" : syn < 0 ? "text-out" : "subtle"}>
            {syn > 0 ? "+" : ""}
            {t(`${syn} % sinergia`, `${syn}% synergy`)}
          </span>
        )}
        <span className="mono subtle ml-auto">{s.price !== null ? eur(s.price) : "—"}</span>
      </span>
    </Link>
  );
}

/**
 * En la ficha de un comandante: lo que juega la comunidad con él según EDHREC, por listas (alta
 * sinergia, las más jugadas, criaturas, instantáneos, conjuros…), con temas, precio y mis copias.
 */
export function CommanderStaples({
  oracleId,
  name,
  loggedIn,
}: {
  oracleId: string;
  name: string;
  loggedIn: boolean;
}) {
  const [theme, setTheme] = useState("");
  const [data, setData] = useState<CommanderStaplesDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState<Show>("all");
  const t = useT();
  const locale = useLocale();
  const { fmt } = useFormat();

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al cambiar de tema
    setLoading(true);
    api<CommanderStaplesDTO>(
      `/api/cards/${encodeURIComponent(oracleId)}/edhrec${theme ? `?theme=${theme}` : ""}`,
      undefined,
      { silent: true },
    )
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiError
              ? e.message
              : t(
                  "No se pudo cargar lo que se juega con este comandante",
                  "Couldn't load what's played with this commander",
                ),
          );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` no cambia en la página
  }, [oracleId, theme]);

  const sections = useMemo(
    () =>
      (data?.sections ?? [])
        .map((s) => ({
          ...s,
          cards: s.cards.filter((c) =>
            show === "owned" ? c.mine !== null : show === "missing" ? c.mine === null : true,
          ),
        }))
        .filter((s) => s.cards.length > 0),
    [data, show],
  );
  const short = name.split(",")[0] ?? name;

  return (
    <section className="flex flex-col gap-3" id="staples">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="h2" style={{ fontSize: 18 }}>
            {t("Lo que se juega con", "What's played with")} {short}
          </h2>
          <span className="subtle text-[13px]">
            {data?.totalDecks
              ? t(
                  `En ${fmt(data.totalDecks)} mazos de la comunidad. `,
                  `Across ${fmt(data.totalDecks)} community decks. `,
                )
              : ""}
            {t("Pulsa una carta para ver su ficha.", "Tap a card to see its page.")}
          </span>
        </div>
      </div>

      {data && data.themes.length > 0 && (
        <div className="chips" role="radiogroup" aria-label={t("Tema", "Theme")}>
          <button
            type="button"
            role="radio"
            aria-checked={theme === ""}
            className={`chipbtn ${theme === "" ? "is-on" : ""}`}
            onClick={() => setTheme("")}
          >
            General
          </button>
          {data.themes.slice(0, 10).map((th) => (
            <button
              key={th.slug}
              type="button"
              role="radio"
              aria-checked={theme === th.slug}
              className={`chipbtn ${theme === th.slug ? "is-on" : ""}`}
              onClick={() => setTheme(th.slug)}
            >
              {th.name}
              {th.count !== null && <span className="n">{fmt(th.count)}</span>}
            </button>
          ))}
        </div>
      )}

      {error && <Banner tone="warn">{error}</Banner>}
      {data?.warning && <Banner tone="warn">{data.warning}</Banner>}
      {loading && !data && !error && (
        <Loading>{t("Buscando lo que se juega…", "Looking up what's played…")}</Loading>
      )}

      {data && (
        <>
          <nav className="staplenav" aria-label={t("Listas", "Lists")}>
            {sections.map((s) => (
              <a key={s.key} href={`#staples-${s.key}`} className="chipbtn">
                {sectionLabel(s.key, locale)} <span className="n">{s.cards.length}</span>
              </a>
            ))}
            {loggedIn && (
              <select
                className="select ml-auto"
                style={{ width: "auto", height: 28 }}
                aria-label={t("Qué cartas enseñar", "Which cards to show")}
                value={show}
                onChange={(e) => setShow(e.target.value as Show)}
              >
                <option value="all">{t("Todas", "All")}</option>
                <option value="owned">{t("Las que tengo", "The ones I own")}</option>
                <option value="missing">{t("Las que me faltan", "The ones I'm missing")}</option>
              </select>
            )}
          </nav>
          <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.5 : 1 }}>
            {sections.length === 0 && (
              <p className="muted text-[13px]">
                {t(
                  "No hay cartas que enseñar con este filtro.",
                  "No cards to show with this filter.",
                )}
              </p>
            )}
            {sections.map((s) => (
              <div
                key={s.key}
                id={`staples-${s.key}`}
                className="flex flex-col gap-2"
                style={{ scrollMarginTop: 70 }}
              >
                <h3 className="staplehead">
                  {sectionLabel(s.key, locale)} <span className="subtle">{s.cards.length}</span>
                </h3>
                <div className="staples">
                  {s.cards.map((c) => (
                    <StapleTile key={c.card.oracleId} s={c} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
