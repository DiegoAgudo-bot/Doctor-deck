"use client";

import { useState } from "react";
import { api, ApiError, storage } from "./api-client";
import { Banner, Dialog } from "./ui";
import { goTo, useT } from "@/components/i18n";

/** Confirmar el borrado de la cuenta escribiendo el email y la contraseña (o, con Google, sin ella). */
export function DeleteAccountDialog({
  open,
  email,
  onClose,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ confirm, ...(password ? { password } : {}) }),
      });
      storage.remove("deck-doctor:mazo");
      goTo("/?account=deleted");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo borrar la cuenta", "Couldn't delete the account"),
      );
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Borrar mi cuenta", "Delete my account")}
      width={460}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancelar", "Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-out"
            disabled={!matches || busy}
            onClick={() => void remove()}
          >
            {busy ? t("Borrando…", "Deleting…") : t("Borrar para siempre", "Delete forever")}
          </button>
        </>
      }
    >
      <p className="text-[13.5px]">
        {t(
          "Se borrarán tu perfil, tu colección, tus mazos, tus listas de intercambio, tus propuestas y tus avisos. Si quieres conservar algo, descarga antes tus datos.",
          "Your profile, collection, decks, trade lists, proposals and notifications will be deleted. If you want to keep anything, download your data first.",
        )}
      </p>
      <div className="field">
        <label className="label" htmlFor="confirm-email">
          {t("Escribe tu email para confirmar:", "Type your email to confirm:")} <b>{email}</b>
        </label>
        <input
          id="confirm-email"
          className="input"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="confirm-password">
          {t("Tu contraseña", "Your password")}
        </label>
        <input
          id="confirm-password"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="hint">
          {t(
            "Si entras solo con Google, déjala vacía (te pedirá volver a entrar si hace rato que lo hiciste).",
            "If you only sign in with Google, leave it empty (you'll be asked to sign in again if it's been a while).",
          )}
        </span>
      </div>
      {error && <Banner tone="out">{error}</Banner>}
    </Dialog>
  );
}
