"use client";

import { useState } from "react";
import { api, ApiError, storage } from "./api-client";
import { Banner, Dialog } from "./ui";

/** Confirmar el borrado de la cuenta escribiendo el email (vale también para cuentas de Google). */
export function DeleteAccountDialog({
  open,
  email,
  onClose,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      storage.remove("deck-doctor:mazo");
      window.location.assign(new URL("/?account=deleted", window.location.origin));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo borrar la cuenta");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Borrar mi cuenta"
      width={460}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-out"
            disabled={!matches || busy}
            onClick={() => void remove()}
          >
            {busy ? "Borrando…" : "Borrar para siempre"}
          </button>
        </>
      }
    >
      <p className="text-[13.5px]">
        Se borrarán tu perfil, tu colección, tus mazos, tus listas de intercambio, tus propuestas y
        tus avisos. Si quieres conservar algo, descarga antes tus datos.
      </p>
      <div className="field">
        <label className="label" htmlFor="confirm-email">
          Escribe tu email para confirmar: <b>{email}</b>
        </label>
        <input
          id="confirm-email"
          className="input"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <Banner tone="out">{error}</Banner>}
    </Dialog>
  );
}
