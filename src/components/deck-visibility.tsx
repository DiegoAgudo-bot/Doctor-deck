"use client";

import type { ComponentType } from "react";
import { DECK_VISIBILITIES, type DeckVisibility } from "@/domain/deck/visibility";
import { useLocale, useT } from "./i18n";
import { IconEye, IconEyeOff, IconLink } from "./icons";

export const VISIBILITY: Record<
  DeckVisibility,
  { label: string; hint: string; Icon: ComponentType<{ size?: number }> }
> = {
  public: {
    label: "Público",
    hint: "Sale en tu perfil y en Comunidad, y avisa a quien te sigue.",
    Icon: IconEye,
  },
  unlisted: {
    label: "Oculto",
    hint: "Solo quien tenga el enlace. No sale en tu perfil ni en Comunidad.",
    Icon: IconLink,
  },
  private: { label: "Privado", hint: "Solo lo ves tú.", Icon: IconEyeOff },
};

const VISIBILITY_EN: Record<DeckVisibility, { label: string; hint: string }> = {
  public: {
    label: "Public",
    hint: "Shows on your profile and in Community, and notifies your followers.",
  },
  unlisted: {
    label: "Unlisted",
    hint: "Only people with the link. Not on your profile or in Community.",
  },
  private: { label: "Private", hint: "Only you can see it." },
};

/** `VISIBILITY` con los textos en el idioma de la página. */
export function useVisibility(): typeof VISIBILITY {
  const locale = useLocale();
  if (locale !== "en") return VISIBILITY;
  return {
    public: { ...VISIBILITY.public, ...VISIBILITY_EN.public },
    unlisted: { ...VISIBILITY.unlisted, ...VISIBILITY_EN.unlisted },
    private: { ...VISIBILITY.private, ...VISIBILITY_EN.private },
  };
}

/** El siguiente estado al pulsar el botón de visibilidad de una tarjeta. */
export const nextVisibility = (v: DeckVisibility): DeckVisibility =>
  DECK_VISIBILITIES[(DECK_VISIBILITIES.indexOf(v) + 1) % DECK_VISIBILITIES.length] ?? "public";

/** Selector de visibilidad (público / oculto / privado) con la explicación debajo. */
export function VisibilityPicker({
  value,
  onChange,
}: {
  value: DeckVisibility;
  onChange: (v: DeckVisibility) => void;
}) {
  const t = useT();
  const VISIBILITY = useVisibility();
  return (
    <div className="field">
      <span className="label">{t("Visibilidad", "Visibility")}</span>
      <div className="chips" role="radiogroup" aria-label={t("Visibilidad", "Visibility")}>
        {DECK_VISIBILITIES.map((v) => {
          const { label, Icon } = VISIBILITY[v];
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              className={`chipbtn ${value === v ? "is-on" : ""}`}
              onClick={() => onChange(v)}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>
      <span className="hint">{VISIBILITY[value].hint}</span>
    </div>
  );
}

/** Cambia la visibilidad de uno de mis mazos (la API devuelve el nuevo estado). */
export async function setDeckVisibility(
  api: <T>(path: string, init?: RequestInit) => Promise<T>,
  id: string,
  visibility: DeckVisibility,
) {
  return api<{ visibility: DeckVisibility }>(`/api/decks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility }),
  });
}
