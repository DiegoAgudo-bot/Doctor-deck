"use client";

/* eslint-disable @next/next/no-img-element -- símbolos de maná servidos desde /symbols */

import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight, IconCollection, IconDecks, IconSwap, IconUsers } from "./icons";
import { SYMBOL_URL } from "./mana";

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

/** Portada para quien llega sin cuenta: qué hace Deck Doctor, enseñado más que contado. */
export function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Para jugadores de Commander</span>
          <h1>
            Mejora tus mazos con las cartas <em>que ya tienes</em>
          </h1>
          <p>
            Deck Doctor cruza tus mazos con tu colección y con los datos de EDHREC: te dice qué
            carta sacar y cuál meter, qué te falta y cuánto cuesta, y con quién de la comunidad
            puedes cambiarla.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" href="/analyze">
              Analizar un mazo
              <IconArrowRight size={15} />
            </Link>
            <Link className="btn btn-lg" href="/signup">
              Crear cuenta gratis
            </Link>
          </div>
          <span className="hero-trust">
            Cartas de Scryfall · Recomendaciones de EDHREC · Combos de Commander Spellbook
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
          Importa ManaBox o añade cartas a mano, con edición, foil, idioma y estado. Su valor real y
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

      <section className="steps">
        {[
          [
            "1",
            "Tu colección",
            "Sube el CSV de ManaBox o añade tus cartas. Sin cuenta, se queda en tu navegador.",
          ],
          [
            "2",
            "Tu mazo",
            "Pega la lista o un enlace de Archidekt o Moxfield. Detecto el comandante y leo EDHREC.",
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

      <section className="cta-band">
        <div>
          <h2>Tu próximo mazo ya está en tu colección</h2>
          <p>Gratis, sin anuncios. Tus datos son tuyos y te los llevas cuando quieras.</p>
        </div>
        <div className="hero-cta">
          <Link className="btn btn-primary btn-lg" href="/signup">
            Crear cuenta
          </Link>
          <Link className="btn btn-lg" href="/community">
            Ver la comunidad
          </Link>
        </div>
      </section>
    </div>
  );
}
