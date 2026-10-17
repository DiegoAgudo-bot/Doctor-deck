/* eslint-disable @next/next/no-img-element -- símbolos de maná e imágenes servidos desde nuestro servidor */

import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight, IconCollection, IconDecks, IconSwap, IconUsers } from "./icons";
import { SITE_NAME } from "@/config/site";
import type { LandingDeck } from "@/server/landing";
import { JsonLd } from "./json-ld";
import { ColorPips, SYMBOL_URL } from "./mana";

/** Una carta dibujada con CSS (sin imágenes externas): marco del color, coste, arte y texto. */
function MockCard({
  name,
  cost,
  type,
  color,
  art,
  className = "",
}: {
  name: string;
  cost: string[];
  type: string;
  /** Color del marco: w, u, b, r, g o c. */
  color: "w" | "u" | "b" | "r" | "g" | "c";
  /** Símbolo que hace de "arte". */
  art: string;
  className?: string;
}) {
  return (
    <div className={`mockcard mockcard-${color} ${className}`} aria-hidden>
      <div className="mockcard-title">
        <span>{name}</span>
        <span className="mockcard-cost">
          {cost.map((s, i) => (
            <img key={i} src={`${SYMBOL_URL}${s}.svg`} alt="" />
          ))}
        </span>
      </div>
      <div className="mockcard-art">
        <img src={`${SYMBOL_URL}${art}.svg`} alt="" />
      </div>
      <div className="mockcard-type">{type}</div>
      <div className="mockcard-text">
        <i style={{ width: "92%" }} />
        <i style={{ width: "78%" }} />
        <i style={{ width: "85%" }} />
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  accent,
  children,
}: {
  icon: ReactNode;
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <article className="feature" style={{ ["--accent" as string]: accent }}>
      <span className="feature-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

/** Preguntas de quien llega por primera vez (respuestas cortas, antes de pedir la cuenta). */
const FAQ: { q: string; a: string; more?: ReactNode }[] = [
  { q: "¿Es gratis?", a: "Sí, gratis y sin anuncios." },
  {
    q: "¿Necesito cuenta?",
    a: "No para analizar un mazo: tu colección se queda en este navegador. Con una cuenta guardas tus mazos y tienes la colección en cualquier dispositivo.",
  },
  {
    q: "¿Cómo traigo mi colección?",
    a: "Sube el CSV que exporta tu app de colección o añade las cartas a mano, con edición, foil, idioma y estado.",
  },
  {
    q: "¿De dónde salen las recomendaciones?",
    a: "De lo que juega la comunidad con tu comandante en miles de mazos. Los precios son los de referencia del mercado europeo.",
  },
  {
    q: "¿Qué hacéis con mis datos?",
    a: "Solo los usamos para que la app funcione. Puedes descargarlos o borrar tu cuenta desde Ajustes cuando quieras.",
    more: (
      <>
        {" "}
        Más en la <Link href="/privacy">política de privacidad</Link>.
      </>
    ),
  },
];

/** Datos estructurados de la portada: la web (con su buscador), la app y las preguntas. */
function landingJsonLd(base: URL) {
  const url = base.toString();
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url,
      inLanguage: "es",
      potentialAction: {
        "@type": "SearchAction",
        target: `${new URL("/cards", base).toString()}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url,
      logo: new URL("/icons/icon-512.png", base).toString(),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url,
      applicationCategory: "GameApplication",
      operatingSystem: "Web, Android",
      inLanguage: "es",
      description:
        "Mejora tus mazos de Commander de Magic: The Gathering con las cartas de tu colección: cambios 1×1, precios, combos e intercambios.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];
}

/**
 * Portada para quien llega sin cuenta: qué hace Doctor Deck, enseñado más que contado. Con
 * `siteUrl` (desde el servidor) lleva también los datos estructurados.
 */
export function Landing({ decks = [], siteUrl }: { decks?: LandingDeck[]; siteUrl?: URL }) {
  return (
    <div className="landing">
      {siteUrl && <JsonLd data={landingJsonLd(siteUrl)} />}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Para jugadores de Magic: The Gathering</span>
          <h1>
            Mejora tus mazos de Commander con las cartas <em>que ya tienes</em>
          </h1>
          <p>
            Doctor Deck cruza tus mazos con tu colección y con lo que juega la comunidad: te dice
            qué carta sacar y cuál meter, qué te falta y cuánto cuesta, y con quién de la comunidad
            puedes cambiarla.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" href="/analyze">
              Analizar un mazo
              <IconArrowRight size={15} />
            </Link>
            <Link className="btn btn-lg" href="/analyze?sample=1">
              Ver un ejemplo
            </Link>
          </div>
          <span className="hero-trust">
            <b>Gratis, sin anuncios y sin cuenta para probar.</b>
          </span>
        </div>

        <div className="hero-demo" aria-label="Ejemplo de cambio propuesto">
          <div className="swap">
            <div className="swap-side">
              <span className="swap-label swap-out">Sale</span>
              <MockCard
                name="Mind Stone"
                cost={["2"]}
                type="Artefacto"
                color="c"
                art="C"
                className="tilt-left"
              />
            </div>
            <span className="swap-arrow">
              <IconSwap size={22} />
            </span>
            <div className="swap-side">
              <span className="swap-label swap-in">Entra</span>
              <MockCard
                name="Arcane Signet"
                cost={["2"]}
                type="Artefacto"
                color="g"
                art="G"
                className="tilt-right"
              />
            </div>
          </div>
          <div className="swap-reason">
            <span className="pill pill-in">La tienes libre</span>
            <span>Mismo rol (ramp) · en el 89 % de los mazos de tu comandante</span>
            <b className="mono">+4,2</b>
          </div>
        </div>
      </section>

      <section className="features">
        <Feature icon={<IconDecks size={20} />} title="Mazos mejores" accent="var(--color-accent)">
          Cambios 1×1 explicados, roles y mínimos (tierras, ramp, robo…), bracket, combos y la
          probabilidad de tu mano inicial.
        </Feature>
        <Feature icon={<IconCollection size={20} />} title="Tu colección" accent="#4fc16a">
          Importa tu CSV o añade cartas a mano, con edición, foil, idioma y estado. Su valor real y
          el histórico de precios.
        </Feature>
        <Feature icon={<IconSwap size={20} />} title="Intercambios" accent="#e0ae3f">
          Quién tiene lo que buscas y busca lo que te sobra. Propuestas cuadradas por valor y, al
          aceptar, las cartas cambian de colección solas.
        </Feature>
        <Feature icon={<IconUsers size={20} />} title="Comunidad" accent="#b78cf0">
          Mazos públicos con el % que ya tienes y lo que te costaría el resto. Sigue a otros
          jugadores y comparte tus listas.
        </Feature>
      </section>

      {decks.length > 0 ? (
        <section className="landing-decks" aria-labelledby="landing-decks-title">
          <div className="flex items-end justify-between gap-3">
            <h2 id="landing-decks-title" className="h2" style={{ fontSize: 20 }}>
              Lo último de la comunidad
            </h2>
            <Link href="/community" style={{ fontSize: 13 }}>
              Ver todos
            </Link>
          </div>
          <div className="landing-decks-grid">
            {decks.map((d) => (
              <Link key={d.id} href={`/decks/${d.id}`} className="landing-deck">
                {d.imageUrl ? (
                  <img src={d.imageUrl} alt={d.commanders[0] ?? ""} loading="lazy" />
                ) : (
                  <span className="landing-deck-noimg" aria-hidden />
                )}
                <span className="flex min-w-0 flex-col gap-1">
                  <b className="truncate">{d.name}</b>
                  <span className="muted truncate text-[13px]">{d.commanders.join(" + ")}</span>
                  <span className="subtle flex items-center gap-2 text-xs">
                    <ColorPips colors={d.colors} />@{d.owner}
                    {d.likes > 0 && <> · {d.likes === 1 ? "1 me gusta" : `${d.likes} me gusta`}</>}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <p className="muted text-[13px]">
            Al abrir un mazo de otro jugador ves qué cartas ya tienes y cuánto te costaría el resto.
          </p>
        </section>
      ) : (
        <section className="steps">
          {[
            [
              "1",
              "Tu colección",
              "Sube el CSV de tu colección o añade tus cartas. Sin cuenta, se queda en tu navegador.",
            ],
            [
              "2",
              "Tu mazo",
              "Pega la lista o el enlace del mazo. Detecto el comandante y miro qué juega la comunidad con él.",
            ],
            [
              "3",
              "Los cambios",
              "Acepta o descarta cada propuesta y exporta la lista mejorada a donde juegues.",
            ],
          ].map(([n, t, d]) => (
            <div key={n} className="step">
              <span className="step-n">{n}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title" className="h2" style={{ fontSize: 20 }}>
          Preguntas frecuentes
        </h2>
        {FAQ.map(({ q, a, more }) => (
          <details key={q}>
            <summary>{q}</summary>
            <p className="muted">
              {a}
              {more}
            </p>
          </details>
        ))}
      </section>

      <section className="cta-band">
        <div>
          <h2>Tu próximo mazo ya está en tu colección</h2>
          <p>Gratis, sin anuncios. Tus datos son tuyos y te los llevas cuando quieras.</p>
        </div>
        <div className="hero-cta">
          <Link className="btn btn-primary btn-lg" href="/analyze">
            Analizar un mazo
          </Link>
          <Link className="btn btn-lg" href="/signup">
            Crear cuenta gratis
          </Link>
          <Link className="btn btn-ghost btn-lg" href="/community">
            Ver la comunidad
          </Link>
        </div>
      </section>
    </div>
  );
}
