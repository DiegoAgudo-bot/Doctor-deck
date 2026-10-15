import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { Color } from "@/domain/cards/types";

/** Tamaño estándar de las vistas previas (WhatsApp, Discord, X, Telegram…). */
export const OG_SIZE = { width: 1200, height: 630 };

const MANA: Record<Color, string> = {
  W: "#f8f6d8",
  U: "#8fc0ea",
  B: "#9b8f88",
  R: "#e8855b",
  G: "#7fb86a",
};

const BG = "#111214";

/** Instrument Sans (OFL, `assets/fonts`): la de por defecto de Satori no trae negrita. */
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700 }[]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all(
    (
      [
        ["InstrumentSans-Regular.ttf", 400],
        ["InstrumentSans-Bold.ttf", 700],
      ] as const
    ).map(async ([file, weight]) => ({
      name: "Instrument Sans",
      data: await readFile(path.join(process.cwd(), "assets/fonts", file)),
      weight,
    })),
  ));

/** Fondo sin arte: un degradado con los colores del mazo (o azul si no hay). */
const glow = (colors: readonly Color[]) => {
  const [a, b] = [colors[0], colors[1] ?? colors[0]].map((c) => (c ? MANA[c] : "#6cb0ff"));
  return `linear-gradient(135deg, ${BG} 35%, ${rgba(a!, 0.35)} 72%, ${rgba(b!, 0.7)} 100%)`;
};

/** Satori no entiende los hexadecimales con transparencia (#rrggbbaa). */
const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * Plantilla de las vistas previas: arte a la derecha fundido con el fondo, y a la izquierda la
 * marca, un antetítulo, el título, una línea de detalle y unas etiquetas.
 */
export async function ogImage({
  art,
  kicker,
  title,
  subtitle,
  colors = [],
  tags = [],
}: {
  /** Data URI del arte (o null: fondo con degradado). */
  art: string | null;
  kicker: string;
  title: string;
  subtitle: string;
  colors?: Color[];
  tags?: string[];
}) {
  const titleSize = title.length > 34 ? 52 : title.length > 22 ? 62 : 72;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: BG,
        color: "#e8e6e3",
        fontFamily: "Instrument Sans",
      }}
    >
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori solo entiende <img>
        <img
          src={art}
          alt=""
          width={760}
          height={630}
          style={{ position: "absolute", right: 0, top: 0, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: glow(colors),
          }}
        />
      )}
      {/* Fundido del arte hacia la izquierda para que el texto se lea siempre. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, ${BG} 0%, ${BG} 38%, rgba(19,19,19,0.82) 58%, rgba(19,19,19,0.15) 100%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          width: 760,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28 }}>
          <div
            style={{
              width: 36,
              height: 46,
              borderRadius: 6,
              border: "3px solid #e8e6e3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6cb0ff",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            +
          </div>
          <span style={{ fontWeight: 700, letterSpacing: -0.5 }}>Doctor Deck</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span
            style={{ fontSize: 24, color: "#6cb0ff", textTransform: "uppercase", letterSpacing: 2 }}
          >
            {kicker}
          </span>
          <span
            style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}
          >
            {title}
          </span>
          <span style={{ fontSize: 30, color: "#aba7a1", lineHeight: 1.25 }}>{subtitle}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {colors.map((c) => (
            <div
              key={c}
              style={{
                width: 34,
                height: 34,
                borderRadius: 34,
                background: MANA[c],
                boxShadow: "0 0 0 3px rgba(0,0,0,0.35)",
              }}
            />
          ))}
          {tags.map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "8px 18px",
                borderRadius: 999,
                border: "2px solid #3a3a3a",
                background: "rgba(34,34,34,0.85)",
                fontSize: 24,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
