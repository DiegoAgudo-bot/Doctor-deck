"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { exportDeck, type ExportableDeck, type ExportFormat } from "@/domain/deck/export";
import type { DeckVisibility } from "@/domain/deck/visibility";
import { VisibilityPicker } from "./deck-visibility";
import { Dialog } from "./ui";

/** Guardar en "Mis mazos". Sin sesión, invita a entrar (el mazo sigue en el navegador). */
export function SaveDialog({
  open,
  onClose,
  loggedIn,
  deckId,
  copyOf,
  visibility: initialVisibility,
  defaultName,
  acceptedCount,
  busy,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  loggedIn: boolean;
  deckId: string | null;
  /** Si es el mazo de otro: se guarda una copia. */
  copyOf: { username: string | null; name: string } | null;
  visibility: DeckVisibility;
  defaultName: string;
  acceptedCount: number;
  busy: boolean;
  onSave: (opts: {
    name: string;
    asNew: boolean;
    includeAccepted: boolean;
    visibility: DeckVisibility;
  }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [includeAccepted, setIncludeAccepted] = useState(true);
  const [visibility, setVisibility] = useState(initialVisibility);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reiniciar el formulario al abrir
    setName(defaultName);
    setVisibility(initialVisibility);
  }, [open, defaultName, initialVisibility]);

  if (!loggedIn) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Guardar mazo"
        width={380}
        footer={
          <>
            <Link className="btn" href="/registro?next=/mazo">
              Crear cuenta
            </Link>
            <Link className="btn btn-primary" href="/entrar?next=/mazo">
              Entrar
            </Link>
          </>
        }
      >
        <p>Para guardar mazos necesitas una cuenta.</p>
        <p className="muted text-[13px]">
          Tu lista, los candados y los descartes se quedan en este navegador: al volver los
          encontrarás tal cual. Los mazos guardados además descuentan sus cartas al analizar otros.
        </p>
      </Dialog>
    );
  }

  const submit = (asNew: boolean) =>
    onSave({ name: name.trim(), asNew, includeAccepted, visibility });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copyOf ? "Guardar una copia" : deckId ? "Guardar cambios" : "Guardar mazo"}
      width={380}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          {deckId && (
            <button type="button" className="btn" disabled={busy} onClick={() => submit(true)}>
              Guardar como nuevo
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => submit(false)}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <div className="field">
          <label className="label" htmlFor="deck-name">
            Nombre
          </label>
          <input
            id="deck-name"
            className="input"
            value={name}
            maxLength={120}
            placeholder="Por defecto, el nombre del comandante"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {copyOf && (
          <p className="muted text-[13px]">
            Es el mazo de {copyOf.username ? `@${copyOf.username}` : copyOf.name}: se guardará una
            copia en tus mazos, con tu nombre.
          </p>
        )}
        <VisibilityPicker value={visibility} onChange={setVisibility} />
        {acceptedCount > 0 && (
          <label className="check muted">
            <input
              type="checkbox"
              checked={includeAccepted}
              onChange={(e) => setIncludeAccepted(e.target.checked)}
            />
            {acceptedCount === 1
              ? "Incluir el cambio aceptado"
              : `Incluir los ${acceptedCount} cambios aceptados`}
          </label>
        )}
      </form>
    </Dialog>
  );
}

/** Exportar la lista (con los cambios aceptados) o solo los cambios. */
const FORMAT: Record<ExportFormat, { label: string; hint: string; file: string }> = {
  text: {
    label: "Texto",
    hint: "El formato que aceptan Moxfield, Archidekt y ManaBox.",
    file: "mazo.txt",
  },
  arena: {
    label: "MTG Arena",
    hint: "En Arena: Mazos › Importar (copia y pulsa Importar). Solo entran las cartas que existen en Arena.",
    file: "mazo-arena.txt",
  },
  mtgo: {
    label: "MTGO",
    hint: "Para Magic Online: el comandante va en el banquillo.",
    file: "mazo-mtgo.txt",
  },
};

export function ExportDialog({
  open,
  onClose,
  deck,
  changes,
}: {
  open: boolean;
  onClose: () => void;
  /** El mazo con los cambios aceptados. */
  deck: ExportableDeck;
  changes: string;
}) {
  const [mode, setMode] = useState<"full" | "changes">("full");
  const [format, setFormat] = useState<ExportFormat>("text");
  const [copied, setCopied] = useState(false);
  const text = mode === "full" ? exportDeck(deck, format) : changes;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === "full" ? FORMAT[format].file : "cambios.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Exportar"
      width={460}
      headerExtra={
        <div className="btn-group" role="group" aria-label="Qué exportar">
          <button
            type="button"
            className={`btn btn-sm ${mode === "full" ? "is-on" : ""}`}
            aria-pressed={mode === "full"}
            onClick={() => setMode("full")}
          >
            Lista completa
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === "changes" ? "is-on" : ""}`}
            aria-pressed={mode === "changes"}
            onClick={() => setMode("changes")}
          >
            Solo cambios
          </button>
        </div>
      }
      footer={
        <>
          {copied && <span className="pill pill-in mr-auto">Copiado</span>}
          <button type="button" className="btn" onClick={download}>
            Descargar .txt
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void copy()}>
            Copiar
          </button>
        </>
      }
    >
      {mode === "full" && (
        <div className="chips" role="radiogroup" aria-label="Formato">
          {(Object.keys(FORMAT) as ExportFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              className={`chipbtn ${format === f ? "is-on" : ""}`}
              onClick={() => setFormat(f)}
            >
              {FORMAT[f].label}
            </button>
          ))}
        </div>
      )}
      <p className="subtle text-[12.5px]">
        {mode === "full"
          ? `${FORMAT[format].hint} Incluye los cambios aceptados.`
          : "Los cambios aceptados: − sale, + entra."}
      </p>
      <textarea
        className="textarea"
        readOnly
        value={text || "(ningún cambio aceptado)"}
        style={{ minHeight: 220 }}
        aria-label="Texto para exportar"
      />
    </Dialog>
  );
}
