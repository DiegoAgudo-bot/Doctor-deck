"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CollectionImportResponse, StatusResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { IconFile } from "./icons";
import {
  LOCAL_COLLECTION_EVENT,
  localCollection,
  localCopies,
  type LocalCollection,
} from "./local-collection";
import { Banner, Loading, fmt } from "./ui";

type Unmatched = CollectionImportResponse["unmatched"];

interface Shown {
  totalCards: number;
  uniqueCards: number;
  rows: number;
  unmatchedRows: number;
  /** Fecha o texto ("en este navegador"). */
  when: string | null;
  fileName: string | null;
  unmatched: Unmatched | null;
  errors: CollectionImportResponse["errors"];
}

const date = (iso: string) =>
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
  uniqueCards: r.uniqueCards,
  rows: r.rows,
  unmatchedRows: r.unmatched.length,
  when: date(at),
  fileName,
  unmatched: r.unmatched,
  errors: r.errors,
});

export function CollectionImport() {
  const { data, isPending } = authClient.useSession();
  const loggedIn = Boolean(data);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [local, setLocal] = useState<LocalCollection | null>(null);
  const [justImported, setJustImported] = useState<Shown | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (loggedIn) {
      api<StatusResponse>("/api/status")
        .then(setStatus)
        .catch(() => setStatus(null));
    }
    const read = () => setLocal(localCollection.get());
    read();
    window.addEventListener(LOCAL_COLLECTION_EVENT, read);
    return () => window.removeEventListener(LOCAL_COLLECTION_EVENT, read);
  }, [loggedIn, isPending]);

  async function upload(csv: string, fileName: string) {
    setBusy(loggedIn ? "Importando y guardando en tu cuenta…" : "Emparejando con Scryfall…");
    setError(null);
    try {
      const res = await api<CollectionImportResponse>("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "text/csv; charset=utf-8" },
        body: csv,
      });
      const at = new Date().toISOString();
      const { owned, saved, ...summary } = res;
      if (!saved && owned) {
        const ok = localCollection.set({ owned, summary, fileName, importedAt: at, csv });
        if (!ok) setError("Tu navegador no ha dejado guardar la colección (¿modo privado?).");
      } else if (saved) {
        localCollection.clear();
        setStatus(await api<StatusResponse>("/api/status"));
      }
      setJustImported(fromImport(summary, fileName, at));
      setShowAll(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo importar el CSV");
    } finally {
      setBusy(null);
    }
  }

  // Lo que se enseña: lo recién importado; si no, lo guardado (cuenta o navegador).
  const shown: Shown | null =
    justImported ??
    (loggedIn
      ? status?.collection && status.collection.rows > 0
        ? {
            totalCards: status.collection.totalCards,
            uniqueCards: status.collection.uniqueCards,
            rows: status.collection.rows,
            unmatchedRows: status.collection.unmatchedRows,
            when: status.collection.importedAt ? date(status.collection.importedAt) : null,
            fileName: null,
            unmatched: null,
            errors: [],
          }
        : null
      : local
        ? fromImport(local.summary, local.fileName, local.importedAt)
        : null);

  const matched = shown ? shown.rows - shown.unmatchedRows : 0;
  const unmatched = shown?.unmatched ?? [];

  return (
    <main className="page max-w-[1100px]" style={{ gap: 20 }}>
      <h1 className="h1">Mi colección</h1>

      {!isPending && !loggedIn && (
        <Banner
          tone="info"
          action={
            <Link className="btn btn-sm" href="/registro?next=/coleccion">
              Crear cuenta
            </Link>
          }
        >
          <b>Sin cuenta, tu colección se guarda solo en este navegador.</b>{" "}
          <span className="muted">Con una cuenta la tendrás en cualquier dispositivo.</span>
        </Banner>
      )}
      {loggedIn && local && !justImported && (
        <Banner
          tone="info"
          action={
            local.csv ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy !== null}
                onClick={() => void upload(local.csv ?? "", local.fileName)}
              >
                Guardarla en mi cuenta
              </button>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => localCollection.clear()}>
                Olvidarla
              </button>
            )
          }
        >
          <b>Tienes una colección guardada en este navegador</b>{" "}
          <span className="muted">
            ({fmt(localCopies(local))} copias, {local.fileName}).{" "}
            {local.csv
              ? "Puedes pasarla a tu cuenta."
              : "Era demasiado grande para guardarla: vuelve a subir el CSV."}
          </span>
        </Banner>
      )}

      <div
        className="grid-1-sm grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" }}
      >
        <section className="panel">
          <div className="panel-h">
            <span className="h2">Importar desde ManaBox</span>
            <span className="subtle text-xs">Reemplaza la anterior</span>
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
                <span className="muted">Copias</span>
                <b>{fmt(shown.totalCards)}</b>
              </div>
              <div className="kv">
                <span className="muted">Cartas distintas</span>
                <b>{fmt(shown.uniqueCards)}</b>
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
              {!loggedIn && local && (
                <div className="pt-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      localCollection.clear();
                      setJustImported(null);
                    }}
                  >
                    Borrar de este navegador
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="muted p-3.5 text-[13px]">Todavía no has importado ninguna colección.</p>
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
    </main>
  );
}
