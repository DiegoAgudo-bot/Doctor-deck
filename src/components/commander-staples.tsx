"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { CommanderStaplesDTO, StapleDTO } from "@/server/card-dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { Banner, fmt, Loading } from "./ui";

type Show = "all" | "owned" | "missing";

const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));

function StapleTile({ s }: { s: StapleDTO }) {
  const inc = pct(s.inclusion);
  const syn = pct(s.synergy);
  return (
    <Link href={`/cards/${s.card.oracleId}`} className="staple">
      <span className="cardbtn">
        <CardImage card={s.card} />
      </span>
      {s.mine && (
        <span
          className={`staple-own ${s.mine.free > 0 ? "free" : "busy"}`}
          title={
            s.mine.free > 0
              ? `Tienes ${s.mine.owned} (${s.mine.free} libres)`
              : `Tienes ${s.mine.owned}, todas en mazos o prestadas`
          }
        >
          {s.mine.free > 0 ? "La tienes" : "En tus mazos"}
        </span>
      )}
      <span className="staple-name truncate">{s.card.name}</span>
      {inc !== null && (
        <span className="staple-bar" style={{ ["--w" as string]: `${inc}%` }}>
          <span>{inc} % de mazos</span>
        </span>
      )}
      <span className="staple-meta">
        {syn !== null && (
          <span className={syn > 0 ? "text-in" : syn < 0 ? "text-out" : "subtle"}>
            {syn > 0 ? "+" : ""}
            {syn} % sinergia
          </span>
        )}
        <span className="mono subtle ml-auto">{s.price !== null ? formatEuros(s.price) : "—"}</span>
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
        if (!cancelled) setError(e instanceof ApiError ? e.message : "No se pudo consultar EDHREC");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
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
    <section className="flex flex-col gap-3" id="edhrec">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="h2" style={{ fontSize: 18 }}>
            Lo que se juega con {short}
          </h2>
          <span className="subtle text-[13px]">
            Según EDHREC
            {data?.totalDecks ? ` · ${fmt(data.totalDecks)} mazos` : ""}. Pulsa una carta para ver
            su ficha.
          </span>
        </div>
        {data && (
          <a
            className="text-[13px]"
            href={`https://edhrec.com/commanders/${data.slug}${data.theme ? `/${data.theme}` : ""}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver en EDHREC
          </a>
        )}
      </div>

      {data && data.themes.length > 0 && (
        <div className="chips" role="radiogroup" aria-label="Tema">
          <button
            type="button"
            role="radio"
            aria-checked={theme === ""}
            className={`chipbtn ${theme === "" ? "is-on" : ""}`}
            onClick={() => setTheme("")}
          >
            General
          </button>
          {data.themes.slice(0, 10).map((t) => (
            <button
              key={t.slug}
              type="button"
              role="radio"
              aria-checked={theme === t.slug}
              className={`chipbtn ${theme === t.slug ? "is-on" : ""}`}
              onClick={() => setTheme(t.slug)}
            >
              {t.name}
              {t.count !== null && <span className="n">{fmt(t.count)}</span>}
            </button>
          ))}
        </div>
      )}

      {error && (
        <Banner tone="warn">
          {error} Puedes verlo directamente en{" "}
          <a href="https://edhrec.com" target="_blank" rel="noreferrer">
            EDHREC
          </a>
          .
        </Banner>
      )}
      {data?.warning && <Banner tone="warn">{data.warning}</Banner>}
      {loading && !data && !error && <Loading>Consultando EDHREC…</Loading>}

      {data && (
        <>
          <nav className="staplenav" aria-label="Listas">
            {sections.map((s) => (
              <a key={s.key} href={`#edhrec-${s.key}`} className="chipbtn">
                {s.label} <span className="n">{s.cards.length}</span>
              </a>
            ))}
            {loggedIn && (
              <select
                className="select ml-auto"
                style={{ width: "auto", height: 28 }}
                aria-label="Qué cartas enseñar"
                value={show}
                onChange={(e) => setShow(e.target.value as Show)}
              >
                <option value="all">Todas</option>
                <option value="owned">Las que tengo</option>
                <option value="missing">Las que me faltan</option>
              </select>
            )}
          </nav>
          <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.5 : 1 }}>
            {sections.length === 0 && (
              <p className="muted text-[13px]">No hay cartas que enseñar con este filtro.</p>
            )}
            {sections.map((s) => (
              <div
                key={s.key}
                id={`edhrec-${s.key}`}
                className="flex flex-col gap-2"
                style={{ scrollMarginTop: 70 }}
              >
                <h3 className="staplehead">
                  {s.label} <span className="subtle">{s.cards.length}</span>
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
