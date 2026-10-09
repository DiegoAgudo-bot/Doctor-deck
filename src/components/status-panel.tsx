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
  const collection = status.collection;
  if (!status.user || !collection) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-zinc-600 dark:text-zinc-400">
          Crea una cuenta para guardar tu colección y tus mazos y no perderlos nunca. Puedes entrar
          con Google o con email y contraseña.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/registro" className={buttonClass.primary}>
            Crear cuenta
          </Link>
          <Link href="/entrar" className={buttonClass.secondary}>
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    );
  }
  const noCollection = collection.rows === 0;
  return (
    <div className="flex flex-col gap-4">
      {noCatalog && (
        <Alert tone="warning">
          El catálogo de Scryfall está vacío. Ejecuta <code>npm run scryfall:sync</code> en el
          servidor antes de importar la colección.
        </Alert>
      )}
      <p className="text-sm text-zinc-500">Hola, {status.user.name}.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cartas en catálogo" value={status.catalog.cards.toLocaleString("es")} />
        <Stat label="Copias en colección" value={collection.totalCards.toLocaleString("es")} />
        <Stat label="Cartas distintas" value={collection.uniqueCards.toLocaleString("es")} />
        <Stat label="Sin emparejar" value={collection.unmatchedRows.toLocaleString("es")} />
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
