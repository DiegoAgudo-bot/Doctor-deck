"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "./ui";
import { useRouter, useT } from "@/components/i18n";

/**
 * ¿Hay que dejar pasar la tecla? Sí si se está escribiendo en un campo, hay un diálogo abierto o
 * va con Ctrl/Alt/Cmd (atajos del navegador).
 */
export function ignoresShortcut(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return true;
  const el = e.target as HTMLElement | null;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  return document.querySelector("dialog[open]") !== null;
}

/** Tras «g», la tecla que lleva a cada sitio. */
const GO: Record<string, string> = {
  i: "/",
  m: "/decks",
  c: "/collection",
  b: "/cards",
  j: "/play",
  l: "/shopping",
};
/** Las que piden cuenta (sin ella no hacen nada). */
const PRIVATE = new Set(["/decks", "/shopping"]);

/**
 * Atajos de teclado de toda la web: «g» y una letra para ir a un sitio, «n» mazo nuevo y «?» la
 * lista de atajos. («/» enfoca el buscador: lo pone `GlobalSearch`; del 1 al 6, las pestañas de
 * un mazo: lo pone la página del mazo).
 */
export function KeyboardShortcuts({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const t = useT();
  const [help, setHelp] = useState(false);
  /** Momento en que se pulsó «g» (la siguiente letra vale durante un segundo y medio). */
  const pendingGo = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoresShortcut(e)) return;
      const key = e.key.toLowerCase();
      if (Date.now() - pendingGo.current < 1500) {
        pendingGo.current = 0;
        const href = GO[key];
        if (href && (loggedIn || !PRIVATE.has(href))) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      } else if (key === "g") {
        pendingGo.current = Date.now();
      } else if (key === "n") {
        e.preventDefault();
        router.push("/decks/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loggedIn, router]);

  const rows: [string[], string][] = [
    [["/"], t("Buscar cartas, mazos o gente", "Search cards, decks or people")],
    [["n"], t("Nuevo mazo", "New deck")],
    [["g", "i"], t("Ir a Inicio", "Go to Home")],
    ...(loggedIn
      ? ([[["g", "m"], t("Ir a Mis mazos", "Go to My decks")]] as [string[], string][])
      : []),
    [["g", "c"], t("Ir a Mi colección", "Go to My collection")],
    [["g", "b"], t("Ir a Buscar cartas", "Go to Search cards")],
    [["g", "j"], t("Ir a Jugar", "Go to Play")],
    ...(loggedIn
      ? ([[["g", "l"], t("Ir a la Lista de compra", "Go to the Shopping list")]] as [
          string[],
          string,
        ][])
      : []),
    [["1", "…", "6"], t("En un mazo: cambiar de pestaña", "In a deck: switch tab")],
    [["?"], t("Ver estos atajos", "Show these shortcuts")],
  ];

  return (
    <Dialog
      open={help}
      onClose={() => setHelp(false)}
      title={t("Atajos de teclado", "Keyboard shortcuts")}
      width={420}
      footer={
        <button type="button" className="btn" onClick={() => setHelp(false)}>
          {t("Cerrar", "Close")}
        </button>
      }
    >
      <dl className="shortcuts">
        {rows.map(([keys, label]) => (
          <div key={label}>
            <dt>
              {keys.map((k, i) =>
                k === "…" ? (
                  <span key={i} className="subtle">
                    …
                  </span>
                ) : (
                  <kbd key={i}>{k}</kbd>
                ),
              )}
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
