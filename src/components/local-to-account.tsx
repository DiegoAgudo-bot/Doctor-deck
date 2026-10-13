"use client";

import { useEffect, useState } from "react";
import type { StatusResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { uploadCsv } from "./collection-import";
import {
  LOCAL_COLLECTION_EVENT,
  localCollection,
  localCopies,
  notifyCollectionChanged,
  type LocalCollection,
} from "./local-collection";
import { Banner, fmt } from "./ui";

/** Pasa la colección de este navegador (CSV y sueltas) a la cuenta. */
async function moveToAccount(l: LocalCollection) {
  if (l.import?.csv) await uploadCsv(l.import.csv, l.import.fileName, true);
  if (l.added.length > 0) {
    await api("/api/collection/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: l.added.map((a) => ({
          oracleId: a.oracleId,
          quantity: a.quantity,
          foil: a.foil,
          ...(a.language ? { language: a.language } : {}),
        })),
      }),
    });
  }
  localCollection.clear();
  notifyCollectionChanged();
}

/**
 * Con sesión y una colección en este navegador (la de antes de tener cuenta): aviso en cualquier
 * página para pasarla a la cuenta. Si la cuenta ya tiene colección y la del navegador trae un CSV,
 * avisa de que lo sustituye (subir el CSV reemplaza lo importado).
 */
export function LocalCollectionToAccount({ loggedIn }: { loggedIn: boolean }) {
  const [local, setLocal] = useState<LocalCollection | null>(null);
  const [accountCopies, setAccountCopies] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    const read = () => setLocal(localCollection.get());
    read();
    window.addEventListener(LOCAL_COLLECTION_EVENT, read);
    return () => window.removeEventListener(LOCAL_COLLECTION_EVENT, read);
  }, [loggedIn]);

  const hasLocal = local !== null;
  useEffect(() => {
    if (!loggedIn || !hasLocal) return;
    api<StatusResponse>("/api/status", undefined, { silent: true })
      .then((s) => setAccountCopies(s.collection?.totalCards ?? 0))
      .catch(() => setAccountCopies(null));
  }, [loggedIn, hasLocal]);

  if (!loggedIn || !local) return null;
  const tooBig = local.import !== null && !local.import.csv;
  const replaces = Boolean(local.import?.csv) && (accountCopies ?? 0) > 0;

  return (
    <div className="shell-notice">
      <Banner
        tone="info"
        action={
          <div className="flex flex-wrap gap-2">
            {!tooBig && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={moving}
                onClick={async () => {
                  setMoving(true);
                  setError(null);
                  try {
                    await moveToAccount(local);
                  } catch (err) {
                    setError(
                      err instanceof ApiError
                        ? err.message
                        : "No se pudo pasar la colección a tu cuenta",
                    );
                  } finally {
                    setMoving(false);
                  }
                }}
              >
                {moving
                  ? "Guardando…"
                  : replaces
                    ? "Sustituir la de mi cuenta"
                    : "Guardarla en mi cuenta"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={moving}
              onClick={() => localCollection.clear()}
            >
              Olvidarla
            </button>
          </div>
        }
      >
        <b>Tienes una colección guardada en este navegador</b>{" "}
        <span className="muted">
          ({fmt(localCopies(local))} copias
          {local.import ? `, ${local.import.fileName}` : ""}).{" "}
          {tooBig
            ? "Era demasiado grande para guardarla aquí: vuelve a subir el CSV en tu colección."
            : replaces
              ? `Tu cuenta ya tiene ${fmt(accountCopies ?? 0)} copias: el CSV del navegador sustituirá al de tu cuenta (las cartas añadidas a mano se suman).`
              : "Pásala a tu cuenta para tenerla en cualquier dispositivo."}
        </span>
      </Banner>
      {error && <Banner tone="out">{error}</Banner>}
    </div>
  );
}
