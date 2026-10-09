"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dialog } from "./ui";

/** Guardar en "Mis mazos". Sin sesión, invita a entrar (el mazo sigue en el navegador). */
export function SaveDialog({
  open,
  onClose,
  loggedIn,
  deckId,
  defaultName,
  acceptedCount,
  busy,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  loggedIn: boolean;
  deckId: number | null;
  defaultName: string;
  acceptedCount: number;
  busy: boolean;
  onSave: (opts: { name: string; asNew: boolean; includeAccepted: boolean }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [includeAccepted, setIncludeAccepted] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reiniciar el formulario al abrir
    if (open) setName(defaultName);
  }, [open, defaultName]);

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

  const submit = (asNew: boolean) => onSave({ name: name.trim(), asNew, includeAccepted });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={deckId ? "Guardar cambios" : "Guardar mazo"}
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
export function ExportDialog({
  open,
  onClose,
  full,
  changes,
}: {
  open: boolean;
  onClose: () => void;
  full: string;
  changes: string;
}) {
  const [mode, setMode] = useState<"full" | "changes">("full");
  const [copied, setCopied] = useState(false);
  const text = mode === "full" ? full : changes;

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
    a.download = mode === "full" ? "mazo.txt" : "cambios.txt";
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
      <p className="subtle text-[12.5px]">
        {mode === "full"
          ? "Formato de texto que aceptan Moxfield, Archidekt y ManaBox. Incluye los cambios aceptados."
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
