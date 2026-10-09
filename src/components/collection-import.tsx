"use client";

import { useState } from "react";
import type { CollectionImportResponse, StatusResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { IconFile } from "./icons";
import { localCollection, notifyCollectionChanged, type LocalCollection } from "./local-collection";
import { Banner, Loading, fmt } from "./ui";

type Unmatched = CollectionImportResponse["unmatched"];

interface Shown {
  totalCards: number;
  rows: number;
  unmatchedRows: number;
  when: string | null;
  fileName: string | null;
  unmatched: Unmatched | null;
  errors: CollectionImportResponse["errors"];
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fromImport = (
  r: Omit<CollectionImportResponse, "owned" | "saved">,
  fileName: string,
  at: string,
): Shown => ({
  totalCards: r.totalCards,
  rows: r.rows,
  unmatchedRows: r.unmatched.length,
  when: formatDate(at),
  fileName,
  unmatched: r.unmatched,
  errors: r.errors,
});

/**
 * Sube el CSV de ManaBox. Con cuenta se guarda en ella; sin cuenta, el servidor lo empareja y el
 * navegador guarda el resultado. Devuelve false si falla (el error ya lo muestra el componente).
 */
export async function uploadCsv(csv: string, fileName: string, loggedIn: boolean) {
  const res = await api<CollectionImportResponse>("/api/collection", {
    method: "POST",
    headers: { "Content-Type": "text/csv; charset=utf-8" },
    body: csv,
  });
  const at = new Date().toISOString();
  const { owned, saved, ...summary } = res;
  let stored = true;
  if (!saved && owned && !loggedIn) {
    stored = localCollection.setImport({ owned, summary, fileName, importedAt: at, csv });
  } else if (saved) {
    notifyCollectionChanged();
  }
  return { shown: fromImport(summary, fileName, at), stored };
}

/** Pestaña "Importar CSV": subir el export de ManaBox, resumen y filas sin emparejar. */
export function CsvImport({
  loggedIn,
  status,
  local,
}: {
  loggedIn: boolean;
  status: StatusResponse | null;
  local: LocalCollection | null;
}) {
  const [justImported, setJustImported] = useState<Shown | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function upload(csv: string, fileName: string) {
    setBusy(loggedIn ? "Importando y guardando en tu cuenta…" : "Emparejando con Scryfall…");
    setError(null);
    try {
      const { shown, stored } = await uploadCsv(csv, fileName, loggedIn);
      if (!stored) setError("Tu navegador no ha dejado guardar la colección (¿modo privado?).");
      setJustImported(shown);
      setShowAll(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo importar el CSV");
    } finally {
      setBusy(null);
    }
  }

  // Lo recién importado; si no, lo último guardado (cuenta o navegador).
  const imported = local?.import ?? null;
  const shown: Shown | null =
    justImported ??
    (loggedIn
      ? status?.collection && status.collection.rows > 0
        ? {
            totalCards: status.collection.totalCards,
            rows: status.collection.rows,
            unmatchedRows: status.collection.unmatchedRows,
            when: status.collection.importedAt ? formatDate(status.collection.importedAt) : null,
            fileName: null,
            unmatched: null,
            errors: [],
          }
        : null
      : imported
        ? fromImport(imported.summary, imported.fileName, imported.importedAt)
        : null);

  const matched = shown ? shown.rows - shown.unmatchedRows : 0;
  const unmatched = shown?.unmatched ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div
        className="grid-1-sm grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" }}
      >
        <section className="panel">
          <div className="panel-h">
            <span className="h2">Importar desde ManaBox</span>
            <span className="subtle text-xs">Reemplaza lo importado antes</span>
          </div>
          <div className="flex flex-col gap-3 p-3.5">
            <ol className="muted m-0 flex list-decimal flex-col gap-0.5 pl-[18px] text-[13px]">
              <li>
                En ManaBox:{" "}
                <b style={{ color: "var(--color-text)", fontWeight: 500 }}>
                  Colección › Compartir › Exportar CSV
                </b>
                .
              </li>
              <li>Sube el archivo aquí o arrástralo encima.</li>
              <li>Las cartas que hayas añadido a mano se conservan.</li>
            </ol>
            <label
              className="relative flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-line-strong bg-raised p-3.5"
              aria-busy={busy !== null}
            >
              <IconFile size={20} className="text-text-2" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span style={{ fontWeight: 500 }}>Elegir archivo .csv</span>
                <span className="subtle mono truncate text-[11.5px]">
                  {shown?.fileName ? `Actual: ${shown.fileName}` : "Export de ManaBox (CSV)"}
                </span>
              </span>
              <span className="btn">Examinar…</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy !== null}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Archivo CSV de ManaBox"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) await upload(await file.text(), file.name);
                }}
              />
            </label>
            {busy && <Loading>{busy}</Loading>}
            {error && <Banner tone="out">{error}</Banner>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <span className="h2">{justImported ? "Importación" : "Última importación"}</span>
            {shown?.when && <span className="mono subtle text-xs">{shown.when}</span>}
          </div>
          {shown ? (
            <div className="px-3.5 pt-1 pb-2.5">
              <div className="kv">
                <span className="muted">Copias en el CSV</span>
                <b>{fmt(shown.totalCards)}</b>
              </div>
              <div className="kv flex-col items-stretch gap-1.5" style={{ display: "flex" }}>
                <span className="flex justify-between">
                  <span className="muted">Filas emparejadas</span>
                  <b>
                    {fmt(matched)} / {fmt(shown.rows)}
                  </b>
                </span>
                <div className="role-bar" style={{ height: 5 }}>
                  <i style={{ width: `${shown.rows ? (matched / shown.rows) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="kv">
                <span className="muted">Sin emparejar</span>
                <b style={{ color: shown.unmatchedRows ? "var(--color-warn)" : undefined }}>
                  {fmt(shown.unmatchedRows)}
                </b>
              </div>
              {!loggedIn && imported && (
                <div className="pt-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      localCollection.clearImport();
                      setJustImported(null);
                    }}
                  >
                    Borrar lo importado de este navegador
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="muted p-3.5 text-[13px]">Todavía no has importado ningún CSV.</p>
          )}
        </section>
      </div>

      {shown && shown.errors.length > 0 && (
        <Banner tone="warn">
          <b>{shown.errors.length} filas del CSV no se han podido leer.</b>{" "}
          <span className="muted">
            {shown.errors
              .slice(0, 3)
              .map((e) => `línea ${e.line}: ${e.reason}`)
              .join(" · ")}
          </span>
        </Banner>
      )}

      {unmatched.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <span className="h2">
              Filas sin emparejar{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {unmatched.length}
              </span>
            </span>
            <span className="subtle text-xs">Añádelas a mano si las encuentras</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="r" style={{ width: 64 }}>
                    Fila
                  </th>
                  <th>Nombre en el CSV</th>
                  <th>Edición</th>
                  <th>Nº</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(showAll ? unmatched : unmatched.slice(0, 8)).map((r) => (
                  <tr key={r.line}>
                    <td className="r mono subtle">{r.line}</td>
                    <td>{r.name}</td>
                    <td className="mono">{r.setCode?.toUpperCase() ?? "—"}</td>
                    <td className="mono subtle">{r.collectorNumber ?? "—"}</td>
                    <td className="r">
                      <a
                        className="btn btn-ghost btn-sm"
                        href={`https://scryfall.com/search?q=${encodeURIComponent(r.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buscar en Scryfall ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unmatched.length > 8 && (
            <div className="subtle flex items-center justify-between px-3 py-2">
              <span className="mono text-xs">
                {showAll ? unmatched.length : 8} de {unmatched.length}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Ver menos" : "Ver todas"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
