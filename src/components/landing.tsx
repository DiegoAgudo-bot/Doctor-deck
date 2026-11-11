/* eslint-disable @next/next/no-img-element -- símbolos de maná e imágenes servidos desde nuestro servidor */

import type { ReactNode } from "react";
import { IconArrowRight } from "./icons";
import { SITE_NAME } from "@/config/site";
import { localePath, pick, type Locale } from "@/domain/i18n/locale";
import type { LandingDeck } from "@/server/landing";
import { JsonLd } from "./json-ld";
import { ColorPips, SYMBOL_URL } from "./mana";
import { Link } from "@/components/i18n";

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

type Tr = (es: string, en: string) => string;

/** Preguntas de quien llega por primera vez (respuestas cortas, antes de pedir la cuenta). */
const faq = (t: Tr): { q: string; a: string; more?: ReactNode }[] => [
  {
    q: t("¿Es gratis?", "Is it free?"),
    a: t("Sí, gratis y sin anuncios.", "Yes, free and ad-free."),
  },
  {
    q: t("¿Necesito cuenta?", "Do I need an account?"),
    a: t(
      "No para analizar un mazo: tu colección se queda en este navegador. Con una cuenta guardas tus mazos y tienes la colección en cualquier dispositivo.",
      "Not to analyze a deck: your collection stays in this browser. With an account you save your decks and have your collection on any device.",
    ),
  },
  {
    q: t("¿Cómo traigo mi colección?", "How do I bring my collection?"),
    a: t(
      "Sube el CSV que exporta tu app de colección o añade las cartas a mano, con edición, foil, idioma y estado.",
      "Upload the CSV your collection app exports or add cards by hand, with set, foil, language and condition.",
    ),
  },
  {
    q: t("¿De dónde salen las recomendaciones?", "Where do the recommendations come from?"),
    a: t(
      "De lo que juega la comunidad con tu comandante en miles de mazos. Los precios son los de referencia del mercado europeo.",
      "From what the community plays with your commander across thousands of decks. Prices are European market reference prices.",
    ),
  },
  {
    q: t("¿Qué hacéis con mis datos?", "What do you do with my data?"),
    a: t(
      "Solo los usamos para que la app funcione. Puedes descargarlos o borrar tu cuenta desde Ajustes cuando quieras.",
      "We only use it to make the app work. You can download it or delete your account from Settings whenever you want.",
    ),
    more: (
      <>
        {" "}
        {t("Más en la", "More in the")}{" "}
        <Link href="/privacy">{t("política de privacidad", "privacy policy")}</Link>.
      </>
    ),
  },
];

/** Datos estructurados de la portada: la web (con su buscador), la app y las preguntas. */
function landingJsonLd(base: URL, locale: Locale, t: Tr) {
  const url = new URL(localePath(locale, "/"), base).toString();
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url,
      inLanguage: locale,
      potentialAction: {
        "@type": "SearchAction",
        target: `${new URL(localePath(locale, "/cards"), base).toString()}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: base.toString(),
      logo: new URL("/icons/icon-512.png", base).toString(),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url,
      applicationCategory: "GameApplication",
      operatingSystem: "Web, Android",
      inLanguage: locale,
      description: t(
        "Mejora tus mazos de Commander de Magic: The Gathering con las cartas de tu colección: cambios 1×1, precios, combos e intercambios.",
        "Upgrade your Magic: The Gathering Commander decks with the cards in your collection: 1-for-1 swaps, prices, combos and trades.",
      ),
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq(t).map(({ q, a }) => ({
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
export function Landing({
  decks = [],
  siteUrl,
  locale = "es",
}: {
  decks?: LandingDeck[];
  siteUrl?: URL;
  locale?: Locale;
}) {
  const t: Tr = (es, en) => pick(locale, es, en);
  const FAQ = faq(t);
  return (
    <div className="landing">
      {siteUrl && <JsonLd data={landingJsonLd(siteUrl, locale, t)} />}
      <section className="hero">
        <div className="hero-copy">
          <h1>
            {t(
              "Mejora tus mazos de Commander con las cartas que ya tienes",
              "Upgrade your Commander decks with the cards you already own",
            )}
          </h1>
          <p>
            {t(
              "Doctor Deck cruza tus mazos con tu colección y con lo que juega la comunidad: te dice qué carta sacar y cuál meter, qué te falta y cuánto cuesta, y con quién de la comunidad puedes cambiarla.",
              "Doctor Deck matches your decks against your collection and what the community plays: it tells you which card to cut and which to add, what you're missing and what it costs, and who in the community you can trade with.",
            )}
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" href="/analyze">
              {t("Analizar un mazo", "Analyze a deck")}
            </Link>
            <Link className="btn btn-lg" href="/analyze?sample=1">
              {t("Ver un ejemplo", "See an example")}
            </Link>
          </div>
          <span className="hero-trust">
            {t(
              "Gratis y sin anuncios. Para probarlo no hace falta cuenta.",
              "Free and ad-free. You don't need an account to try it.",
            )}
          </span>
        </div>

        <div
          className="hero-demo"
          aria-label={t("Ejemplo de cambio propuesto", "Example of a suggested swap")}
        >
          <div className="swap">
            <div className="swap-side">
              <span className="swap-label swap-out">{t("Sale", "Out")}</span>
              <MockCard
                name="Mind Stone"
                cost={["2"]}
                type={t("Artefacto", "Artifact")}
                color="c"
                art="C"
                className="tilt-left"
              />
            </div>
            <span className="swap-arrow" aria-hidden>
              <IconArrowRight size={20} />
            </span>
            <div className="swap-side">
              <span className="swap-label swap-in">{t("Entra", "In")}</span>
              <MockCard
                name="Arcane Signet"
                cost={["2"]}
                type={t("Artefacto", "Artifact")}
                color="g"
                art="G"
                className="tilt-right"
              />
            </div>
          </div>
          <div className="swap-reason">
            <span className="pill pill-in">{t("La tienes libre", "You own a spare copy")}</span>
            <span>
              {t(
                "Hace lo mismo (ramp) y la juega el 89 % de los mazos de tu comandante.",
                "Does the same job (ramp), and 89% of decks with your commander play it.",
              )}
            </span>
            <b className="mono">{t("+4,2", "+4.2")}</b>
          </div>
        </div>
      </section>

      <section aria-labelledby="does-title" className="does">
        <h2 id="does-title">{t("Qué hace por ti", "What it does for you")}</h2>
        <dl>
          <div>
            <dt>{t("Te dice qué cambiar", "It tells you what to change")}</dt>
            <dd>
              {t(
                "Cambios de una carta por otra, cada uno con su porqué. Vigila que no te quedes corto de tierras, ramp o robo, y te da el bracket, los combos y las cuentas de tu mano inicial.",
                "One-for-one swaps, each with its reason. It makes sure you don't run short on lands, ramp or draw, and gives you the bracket, the combos and your opening hand odds.",
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Lleva tu colección", "It keeps your collection")}</dt>
            <dd>
              {t(
                "Súbela desde un CSV o carta a carta, con edición, foil, idioma y estado. Sabrás cuánto vale hoy y cómo ha ido cambiando.",
                "Upload it from a CSV or card by card, with set, foil, language and condition. You'll know what it's worth today and how that has changed.",
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Cuadra tus intercambios", "It balances your trades")}</dt>
            <dd>
              {t(
                "Te cruza con quien tiene lo que buscas y busca lo que te sobra, propone un cambio igualado por valor y, al aceptarlo, mueve las cartas de una colección a otra.",
                "It matches you with whoever has what you want and wants what you have spare, proposes a value-balanced trade and, once accepted, moves the cards between collections.",
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Te sienta a la mesa", "It gets you to the table")}</dt>
            <dd>
              {t(
                "Mazos de otros jugadores con lo que ya tienes de cada uno y lo que costaría el resto. Grupos con tus amigos, contador de vidas y la clasificación de vuestras partidas.",
                "Other players' decks with how much of each you already own and what the rest would cost. Groups with your friends, a life counter and the standings of your games.",
              )}
            </dd>
          </div>
        </dl>
      </section>

      {decks.length > 0 ? (
        <section className="landing-decks" aria-labelledby="landing-decks-title">
          <div className="flex items-end justify-between gap-3">
            <h2 id="landing-decks-title" className="h2" style={{ fontSize: 20 }}>
              {t("Lo último de la comunidad", "Latest from the community")}
            </h2>
            <Link href="/community" style={{ fontSize: 13 }}>
              {t("Ver todos", "See all")}
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
                    {d.likes > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        {d.likes === 1
                          ? t("1 me gusta", "1 like")
                          : t(`${d.likes} me gusta`, `${d.likes} likes`)}
                      </>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <p className="muted text-[13px]">
            {t(
              "Al abrir un mazo de otro jugador ves qué cartas ya tienes y cuánto te costaría el resto.",
              "When you open another player's deck you see which cards you already own and what the rest would cost.",
            )}
          </p>
        </section>
      ) : (
        <section className="steps">
          {[
            [
              "1",
              t("Tu colección", "Your collection"),
              t(
                "Sube el CSV de tu colección o añade tus cartas. Sin cuenta, se queda en tu navegador.",
                "Upload your collection CSV or add your cards. Without an account, it stays in your browser.",
              ),
            ],
            [
              "2",
              t("Tu mazo", "Your deck"),
              t(
                "Pega la lista o el enlace del mazo. Detecto el comandante y miro qué juega la comunidad con él.",
                "Paste the list or the deck link. I detect the commander and check what the community plays with it.",
              ),
            ],
            [
              "3",
              t("Los cambios", "The swaps"),
              t(
                "Acepta o descarta cada propuesta y exporta la lista mejorada a donde juegues.",
                "Accept or dismiss each suggestion and export the improved list to wherever you play.",
              ),
            ],
          ].map(([n, title, d]) => (
            <div key={n} className="step">
              <span className="step-n">{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title" className="h2" style={{ fontSize: 20 }}>
          {t("Preguntas frecuentes", "Frequently asked questions")}
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
          <h2>
            {t(
              "Tu próximo mazo ya está en tu colección",
              "Your next deck is already in your collection",
            )}
          </h2>
          <p>
            {t(
              "Gratis, sin anuncios. Tus datos son tuyos y te los llevas cuando quieras.",
              "Free, no ads. Your data is yours and you can take it with you whenever you want.",
            )}
          </p>
        </div>
        <div className="hero-cta">
          <Link className="btn btn-primary btn-lg" href="/analyze">
            {t("Analizar un mazo", "Analyze a deck")}
          </Link>
          <Link className="btn btn-lg" href="/signup">
            {t("Crear cuenta gratis", "Create a free account")}
          </Link>
          <Link className="btn btn-ghost btn-lg" href="/community">
            {t("Ver la comunidad", "Browse the community")}
          </Link>
        </div>
      </section>
    </div>
  );
}
