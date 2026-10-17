/**
 * Genera los iconos (favicon, PWA, iOS y app Android) a partir del logo (`LOGO_FACETS`).
 * Sin fondo (transparentes), salvo los que la plataforma rellena: el "maskable" de la PWA y el de
 * iOS (que pinta de negro lo transparente).
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

/**
 * El logo, sin fondo o (`solid`) sobre fondo oscuro. `pad` = margen (los "maskable" y el adaptativo
 * de Android necesitan más).
 */
function icon(size: number, pad: number, solid = false) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(solid ? { background: BG } : {}),
      }}
    >
      {gem(size * (1 - pad * 2))}
    </div>,
    { width: size, height: size },
  );
}

/** Favicon en SVG: solo la gema, sin fondo. */
function faviconSvg() {
  const paths = LOGO_FACETS.map(([d, fill]) => `<path d="${d}" fill="${fill}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${paths}</svg>\n`;
}

/** `favicon.ico` con PNG dentro (formato ICO admitido desde Windows Vista y por todos los navegadores). */
function ico(pngs: [size: number, png: Buffer][]) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(([size, png], i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs.map(([, png]) => png)]);
}

async function png(res: ImageResponse) {
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  writeFileSync("public/icons/favicon.svg", faviconSvg());
  console.log("public/icons/favicon.svg");
  const sizes = [16, 32, 48];
  writeFileSync(
    "src/app/favicon.ico",
    ico(await Promise.all(sizes.map(async (s) => [s, await png(icon(s, 0))] as [number, Buffer]))),
  );
  console.log("src/app/favicon.ico");
  const out: [string, ImageResponse][] = [
    ["public/icons/icon-192.png", icon(192, 0.06)],
    ["public/icons/icon-512.png", icon(512, 0.06)],
    // Android recorta los "maskable" en círculo o squircle: logo dentro de la zona segura (80 %).
    ["public/icons/maskable-512.png", icon(512, 0.24, true)],
    ["public/icons/apple-touch-icon.png", icon(180, 0.14, true)],
    // App móvil (Expo): icono normal y primer plano del adaptativo (zona segura = 66 % central;
    // el fondo lo pone `adaptiveIcon.backgroundColor`).
    ["mobile/assets/icon.png", icon(512, 0.06)],
    ["mobile/assets/adaptive-icon.png", icon(512, 0.3)],
  ];
  for (const [name, res] of out) {
    writeFileSync(name, await png(res));
    console.log(name);
  }
}

void main();
