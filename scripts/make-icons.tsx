/**
 * Genera los iconos (favicon, PWA, iOS y app Android) a partir del logo (`LOGO_FACETS`).
 * Uso: npx tsx scripts/make-icons.tsx (solo hace falta si cambia el logo; los ficheros se suben al repo).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";
import { LOGO_FACETS } from "../src/components/icons";

const BG = "radial-gradient(circle at 30% 20%, #23344d 0%, #131313 70%)";

function gem(size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {LOGO_FACETS.map(([d, fill]) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </svg>
  );
}

/** El logo sobre fondo oscuro. `pad` = margen (los "maskable" y el adaptativo de Android necesitan más). */
function icon(size: number, pad: number, rounded: boolean) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rounded ? size * 0.22 : 0,
        background: BG,
      }}
    >
      {gem(size * (1 - pad * 2))}
    </div>,
    { width: size, height: size },
  );
}

/** Favicon en SVG: la gema sobre un cuadrado redondeado oscuro (se ve igual con tema claro u oscuro). */
function faviconSvg() {
  const paths = LOGO_FACETS.map(([d, fill]) => `<path d="${d}" fill="${fill}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="bg" cx="30%" cy="18%" r="85%"><stop offset="0" stop-color="#23344d"/><stop offset=".72" stop-color="#131313"/></radialGradient></defs><rect width="64" height="64" rx="14" fill="url(#bg)"/><g transform="translate(4.5 4.5) scale(2.29)">${paths}</g></svg>\n`;
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  writeFileSync("public/icons/favicon.svg", faviconSvg());
  console.log("public/icons/favicon.svg");
  const out: [string, ImageResponse][] = [
    ["public/icons/icon-192.png", icon(192, 0.12, true)],
    ["public/icons/icon-512.png", icon(512, 0.12, true)],
    // Android recorta los "maskable" en círculo o squircle: logo dentro de la zona segura (80 %).
    ["public/icons/maskable-512.png", icon(512, 0.24, false)],
    ["public/icons/apple-touch-icon.png", icon(180, 0.14, false)],
    // App móvil (Expo): icono normal y primer plano del adaptativo (zona segura = 66 % central).
    ["mobile/assets/icon.png", icon(512, 0.14, true)],
    ["mobile/assets/adaptive-icon.png", icon(512, 0.3, false)],
  ];
  for (const [name, res] of out) {
    writeFileSync(name, Buffer.from(await res.arrayBuffer()));
    console.log(name);
  }
}

void main();
