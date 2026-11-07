"use client";

import { useState } from "react";
import type { CollectionImportResponse, StatusResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { IconFile } from "./icons";
import { localCollection, notifyCollectionChanged, type LocalCollection } from "./local-collection";
import { Banner, Loading, fmt } from "./ui";
import { Link, useIntlLocale, useLocale, useT } from "./i18n";

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

export const formatDate = (iso: string, intl = "es-ES") =>
  new Date(iso).toLocaleString(intl, {
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
  intl = "es-ES",
): Shown => ({
  totalCards: r.totalCards,
  rows: r.rows,
  unmatchedRows: r.unmatched.length,
  when: formatDate(at, intl),
  fileName,
  unmatched: r.unmatched,
  errors: r.errors,
});

/**
 * Sube el CSV de ManaBox. Con cuenta se guarda en ella; sin cuenta, el servidor lo empareja y el
 * navegador guarda el resultado. Devuelve false si falla (el error ya lo muestra el componente).
 */
export async function uploadCsv(csv: string, fileName: string, loggedIn: boolean, intl = "es-ES") {
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
  return { shown: fromImport(summary, fileName, at, intl), stored };
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
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const n = (x: number) => fmt(x, locale);
  const [justImported, setJustImported] = useState<Shown | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function upload(csv: string, fileName: string) {
    setBusy(
      loggedIn
        ? t("Importando y guardando en tu cuenta…", "Importing and saving to your account…")
        : t("Buscando tus cartas en el catálogo…", "Looking up your cards in the catalog…"),
    );
    setError(null);
    try {
      const { shown, stored } = await uploadCsv(csv, fileName, loggedIn, intl);
      if (!stored) {
        setError(
          t(
            "Tu navegador no ha dejado guardar la colección (¿modo privado?).",
            "Your browser didn't let us save the collection (private mode?).",
          ),
        );
      }
      setJustImported(shown);
      setShowAll(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo importar el CSV", "Couldn't import the CSV"),
      );
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
            when: status.collection.importedAt
              ? formatDate(status.collection.importedAt, intl)
              : null,
            fileName: null,
            unmatched: null,
            errors: [],
          }
        : null
      : imported
        ? fromImport(imported.summary, imported.fileName, imported.importedAt, intl)
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
            <span className="h2">{t("Importar un CSV", "Import a CSV")}</span>
            <span className="subtle text-xs">
              {t("Reemplaza lo importado antes", "Replaces what was imported before")}
            </span>
          </div>
          <div className="flex flex-col gap-3 p-3.5">
            <ol className="muted m-0 flex list-decimal flex-col gap-0.5 pl-[18px] text-[13px]">
              <li>
                {t(
                  "Exporta tu colección en CSV desde tu app o web de colección (vale el de las más usadas: reconozco sus columnas de nombre, cantidad, edición, foil, idioma y estado).",
                  "Export your collection as CSV from your collection app or site (the most common ones work: I recognize their name, quantity, set, foil, language and condition columns).",
                )}
              </li>
              <li>
                {t(
                  "Sube el archivo aquí o arrástralo encima.",
                  "Upload the file here or drag it on top.",
                )}
              </li>
              <li>
                {t(
                  "Las cartas que hayas añadido a mano se conservan.",
                  "Cards you've added by hand are kept.",
                )}
              </li>
            </ol>
            <label
              className="relative flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-line-strong bg-raised p-3.5"
              aria-busy={busy !== null}
            >
              <IconFile size={20} className="text-text-2" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span style={{ fontWeight: 500 }}>
                  {t("Elegir archivo .csv", "Choose .csv file")}
                </span>
                <span className="subtle mono truncate text-[11.5px]">
                  {shown?.fileName
                    ? `${t("Actual", "Current")}: ${shown.fileName}`
                    : t("CSV de tu colección", "Your collection CSV")}
                </span>
              </span>
              <span className="btn">{t("Examinar…", "Browse…")}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy !== null}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label={t("Archivo CSV de tu colección", "Your collection CSV file")}
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
            <span className="h2">
              {justImported ? t("Importación", "Import") : t("Última importación", "Last import")}
            </span>
            {shown?.when && <span className="mono subtle text-xs">{shown.when}</span>}
          </div>
          {shown ? (
            <div className="px-3.5 pt-1 pb-2.5">
              <div className="kv">
                <span className="muted">{t("Copias en el CSV", "Copies in the CSV")}</span>
                <b>{n(shown.totalCards)}</b>
              </div>
              <div className="kv flex-col items-stretch gap-1.5" style={{ display: "flex" }}>
                <span className="flex justify-between">
                  <span className="muted">{t("Filas emparejadas", "Matched rows")}</span>
                  <b>
                    {n(matched)} / {n(shown.rows)}
                  </b>
                </span>
                <div className="role-bar" style={{ height: 5 }}>
                  <i style={{ width: `${shown.rows ? (matched / shown.rows) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="kv">
                <span className="muted">{t("Sin emparejar", "Unmatched")}</span>
                <b style={{ color: shown.unmatchedRows ? "var(--color-warn)" : undefined }}>
                  {n(shown.unmatchedRows)}
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
                    {t(
                      "Borrar lo importado de este navegador",
                      "Delete the import from this browser",
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="muted p-3.5 text-[13px]">
              {t("Todavía no has importado ningún CSV.", "You haven't imported a CSV yet.")}
            </p>
          )}
        </section>
      </div>

      {shown && shown.errors.length > 0 && (
        <Banner tone="warn">
          <b>
            {t(
              `${shown.errors.length} filas del CSV no se han podido leer.`,
              `${shown.errors.length} CSV rows couldn't be read.`,
            )}
          </b>{" "}
          <span className="muted">
            {shown.errors
              .slice(0, 3)
              .map((e) => (locale === "en" ? `line ${e.line}` : `línea ${e.line}: ${e.reason}`))
              .join(" · ")}
          </span>
        </Banner>
      )}

      {unmatched.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <span className="h2">
              {t("Filas sin emparejar", "Unmatched rows")}{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {unmatched.length}
              </span>
            </span>
            <span className="subtle text-xs">
              {t("Añádelas a mano si las encuentras", "Add them by hand if you find them")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="r" style={{ width: 64 }}>
                    {t("Fila", "Row")}
                  </th>
                  <th>{t("Nombre en el CSV", "Name in the CSV")}</th>
                  <th>{t("Edición", "Set")}</th>
                  <th>{t("Nº", "No.")}</th>
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
                      <Link
                        className="btn btn-ghost btn-sm"
                        href={`/cards?q=${encodeURIComponent(r.name)}`}
                      >
                        {t("Buscar la carta", "Find the card")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unmatched.length > 8 && (
            <div className="subtle flex items-center justify-between px-3 py-2">
              <span className="mono text-xs">
                {showAll ? unmatched.length : 8} {t("de", "of")} {unmatched.length}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? t("Ver menos", "See less") : t("Ver todas", "See all")}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
