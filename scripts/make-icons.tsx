/**
 * Genera los iconos de la app (PWA, iOS y favicon grande) en public/icons/ a partir del logo.
 * Uso: npx tsx scripts/make-icons.tsx (solo hace falta si cambia el logo; los PNG se suben al repo).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";

/** El logo (carta con una cruz) sobre fondo oscuro. `pad` = margen (los "maskable" necesitan más). */
function icon(size: number, pad: number, rounded: boolean) {
  const inner = size * (1 - pad * 2);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rounded ? size * 0.22 : 0,
        background: "radial-gradient(circle at 30% 20%, #23344d 0%, #131313 70%)",
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
        <rect x="5" y="2" width="14" height="20" rx="2" stroke="#e8e6e3" strokeWidth="1.8" />
        <path d="M12 8v8M8 12h8" stroke="#6cb0ff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  const out: [string, ImageResponse][] = [
    ["icon-192.png", icon(192, 0.12, true)],
    ["icon-512.png", icon(512, 0.12, true)],
    // Android recorta los "maskable" en círculo o squircle: logo dentro de la zona segura (80 %).
    ["maskable-512.png", icon(512, 0.24, false)],
    ["apple-touch-icon.png", icon(180, 0.14, false)],
  ];
  for (const [name, res] of out) {
    writeFileSync(`public/icons/${name}`, Buffer.from(await res.arrayBuffer()));
    console.log(`public/icons/${name}`);
  }
}

void main();
