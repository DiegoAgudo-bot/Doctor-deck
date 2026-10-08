"use client";

import { useState } from "react";
import type { CollectionImportResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { Alert, Section, Stat, buttonClass } from "./ui";

export function CollectionImport() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CollectionImportResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      setSummary(
        await api<CollectionImportResponse>("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "text/csv; charset=utf-8" },
          body: text,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo importar el CSV");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>CSV exportado desde ManaBox</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-lg border border-zinc-300 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1 dark:border-zinc-700 dark:file:bg-zinc-800"
          />
        </label>
        <p className="text-xs text-zinc-500">Importar reemplaza la colección guardada.</p>
        <div>
          <button type="submit" disabled={!file || busy} className={buttonClass.primary}>
            {busy ? "Importando…" : "Importar"}
          </button>
        </div>
      </form>

      {error && <Alert tone="error">{error}</Alert>}

      {summary && (
        <Section title="Resumen">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Copias" value={summary.totalCards.toLocaleString("es")} />
            <Stat label="Cartas distintas" value={summary.uniqueCards.toLocaleString("es")} />
            <Stat label="Filas emparejadas" value={`${summary.matchedRows}/${summary.rows}`} />
            <Stat label="Sin emparejar" value={summary.unmatched.length} />
          </div>
          <p className="text-xs text-zinc-500">
            Emparejadas por Scryfall ID: {summary.matchedBy.scryfallId} · por set y número:{" "}
            {summary.matchedBy.setNumber} · por nombre: {summary.matchedBy.name}
          </p>
          {summary.unmatched.length > 0 && (
            <details className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <summary className="cursor-pointer font-medium">
                Cartas sin emparejar ({summary.unmatched.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {summary.unmatched.map((u) => (
                  <li key={u.line}>
                    <span className="text-zinc-500">línea {u.line}:</span> {u.name}{" "}
                    <span className="text-zinc-500">
                      {u.setCode?.toUpperCase()} {u.collectorNumber}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {summary.errors.length > 0 && (
            <Alert tone="warning">
              {summary.errors.length} filas con errores:
              <ul className="mt-1 list-disc pl-5">
                {summary.errors.slice(0, 20).map((e) => (
                  <li key={e.line}>
                    línea {e.line}: {e.reason}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </Section>
      )}
    </div>
  );
}
