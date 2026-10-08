"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { Alert, buttonClass } from "./ui";

const SOURCE_LABEL: Record<string, string> = {
  text: "texto",
  archidekt: "Archidekt",
  moxfield: "Moxfield",
};

export function SavedDecks() {
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SavedDeckSummaryDTO[]>("/api/decks")
      .then(setDecks)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "No se pudieron cargar los mazos"),
      );
  }, []);

  async function remove(d: SavedDeckSummaryDTO) {
    if (!window.confirm(`¿Borrar «${d.name}»?`)) return;
    try {
      await fetch(`/api/decks/${d.id}`, { method: "DELETE" });
      setDecks((list) => list?.filter((x) => x.id !== d.id) ?? null);
    } catch {
      setError("No se pudo borrar el mazo");
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!decks) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (decks.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Aún no has guardado ningún mazo. Analiza uno en{" "}
        <Link href="/mazo" className="underline">
          Mazo
        </Link>{" "}
        y pulsa «Guardar en mis mazos».
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {decks.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{d.name}</span>
            <span className="truncate text-xs text-zinc-500">
              {d.commanderNames.join(" + ")} · {d.cardCount} cartas ·{" "}
              {SOURCE_LABEL[d.source] ?? d.source} ·{" "}
              {new Date(d.updatedAt).toLocaleDateString("es")}
            </span>
          </div>
          <Link href={`/mazo?id=${d.id}`} className={buttonClass.secondary}>
            Abrir
          </Link>
          <button
            type="button"
            onClick={() => void remove(d)}
            aria-label={`Borrar ${d.name}`}
            className="rounded-lg px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            Borrar
          </button>
        </li>
      ))}
    </ul>
  );
}
