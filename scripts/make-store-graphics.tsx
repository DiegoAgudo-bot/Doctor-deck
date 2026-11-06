/**
 * Imágenes de la ficha de Google Play (en `mobile/store/`): el icono de 512×512 (con fondo: la
 * tienda no admite transparencias) y el gráfico destacado de 1024×500.
 * Uso: npx tsx scripts/make-store-graphics.tsx (los ficheros se suben al repo).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";
import { LOGO_FACETS } from "../src/components/icons";

const BG = "radial-gradient(circle at 30% 20%, #23344d 0%, #131313 70%)";
const fonts = [
  {
    name: "Instrument Sans",
    data: readFileSync("assets/fonts/InstrumentSans-Regular.ttf"),
    weight: 400 as const,
  },
  {
    name: "Instrument Sans",
    data: readFileSync("assets/fonts/InstrumentSans-Bold.ttf"),
    weight: 700 as const,
  },
];

const gem = (size: number) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {LOGO_FACETS.map(([d, fill]) => (
      <path key={fill} d={d} fill={fill} />
    ))}
  </svg>
);

function storeIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BG,
      }}
    >
      {gem(360)}
    </div>,
    { width: 512, height: 512 },
  );
}

function featureGraphic() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 80px",
        background: BG,
        color: "#f4f4f5",
        fontFamily: "Instrument Sans",
      }}
    >
      {gem(250)}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>Doctor Deck</span>
        <span style={{ fontSize: 34, color: "#c9ccd2", lineHeight: 1.25, maxWidth: 560 }}>
          Mejora tus mazos de Commander con las cartas que ya tienes
        </span>
      </div>
    </div>,
    { width: 1024, height: 500, fonts },
  );
}

async function main() {
  const out: [string, ImageResponse][] = [
    ["mobile/store/icon-512.png", storeIcon()],
    ["mobile/store/feature-graphic.png", featureGraphic()],
  ];
  for (const [name, res] of out) {
    writeFileSync(name, Buffer.from(await res.arrayBuffer()));
    console.log(`✓ ${name}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
