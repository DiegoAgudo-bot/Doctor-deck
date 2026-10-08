"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StatusResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { Alert, Stat, buttonClass } from "./ui";

export function StatusPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<StatusResponse>("/api/status")
      .then(setStatus)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "Error al cargar el estado"),
      );
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!status) return <p className="text-sm text-zinc-500">Cargando…</p>;

  const noCatalog = status.catalog.cards === 0;
  const noCollection = status.collection.rows === 0;
  return (
    <div className="flex flex-col gap-4">
      {noCatalog && (
        <Alert tone="warning">
          El catálogo de Scryfall está vacío. Ejecuta <code>npm run scryfall:sync</code> en el
          servidor antes de importar la colección.
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cartas en catálogo" value={status.catalog.cards.toLocaleString("es")} />
        <Stat
          label="Copias en colección"
          value={status.collection.totalCards.toLocaleString("es")}
        />
        <Stat label="Cartas distintas" value={status.collection.uniqueCards.toLocaleString("es")} />
        <Stat label="Sin emparejar" value={status.collection.unmatchedRows.toLocaleString("es")} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/coleccion"
          className={noCollection ? buttonClass.primary : buttonClass.secondary}
        >
          {noCollection ? "Importar colección" : "Reimportar colección"}
        </Link>
        <Link href="/mazo" className={noCollection ? buttonClass.secondary : buttonClass.primary}>
          Analizar un mazo
        </Link>
      </div>
    </div>
  );
}
