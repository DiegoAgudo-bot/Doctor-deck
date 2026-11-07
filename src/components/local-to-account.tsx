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
import { useLocale, useT } from "./i18n";

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
  const t = useT();
  const locale = useLocale();
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
                        : t(
                            "No se pudo pasar la colección a tu cuenta",
                            "Couldn't move the collection to your account",
                          ),
                    );
                  } finally {
                    setMoving(false);
                  }
                }}
              >
                {moving
                  ? t("Guardando…", "Saving…")
                  : replaces
                    ? t("Sustituir la de mi cuenta", "Replace my account's")
                    : t("Guardarla en mi cuenta", "Save it to my account")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={moving}
              onClick={() => localCollection.clear()}
            >
              {t("Olvidarla", "Forget it")}
            </button>
          </div>
        }
      >
        <b>
          {t(
            "Tienes una colección guardada en este navegador",
            "You have a collection saved in this browser",
          )}
        </b>{" "}
        <span className="muted">
          ({fmt(localCopies(local), locale)} {t("copias", "copies")}
          {local.import ? `, ${local.import.fileName}` : ""}).{" "}
          {tooBig
            ? t(
                "Era demasiado grande para guardarla aquí: vuelve a subir el CSV en tu colección.",
                "It was too big to keep here: upload the CSV again in your collection.",
              )
            : replaces
              ? t(
                  `Tu cuenta ya tiene ${fmt(accountCopies ?? 0, locale)} copias: el CSV del navegador sustituirá al de tu cuenta (las cartas añadidas a mano se suman).`,
                  `Your account already has ${fmt(accountCopies ?? 0, locale)} copies: the browser's CSV will replace your account's (cards added by hand are kept).`,
                )
              : t(
                  "Pásala a tu cuenta para tenerla en cualquier dispositivo.",
                  "Move it to your account to have it on any device.",
                )}
        </span>
      </Banner>
      {error && <Banner tone="out">{error}</Banner>}
    </div>
  );
}
