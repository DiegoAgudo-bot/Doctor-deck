import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FanContentNotice, LegalPage, Pending } from "@/components/legal";
import { loadEnv } from "@/config/env";

export const metadata: Metadata = {
  title: "Aviso legal · Doctor Deck",
  description: "Titular, condiciones de uso y propiedad intelectual de Doctor Deck.",
};

async function OwnerData() {
  await connection();
  const env = loadEnv();
  return (
    <ul>
      <li>Titular: {env.LEGAL_OWNER ?? <Pending what="titular" />}</li>
      <li>
        Contacto:{" "}
        {env.LEGAL_EMAIL ? (
          <a href={`mailto:${env.LEGAL_EMAIL}`}>{env.LEGAL_EMAIL}</a>
        ) : (
          <Pending what="email de contacto" />
        )}
      </li>
    </ul>
  );
}

export default function Page() {
  return (
    <LegalPage title="Aviso legal" updated="12 de octubre de 2026">
      <h2>Titular</h2>
      <Suspense fallback={<p>…</p>}>
        <OwnerData />
      </Suspense>

      <h2>Qué es Doctor Deck</h2>
      <p>
        Una herramienta gratuita para jugadores de Magic: The Gathering: propone mejoras para tus
        mazos de Commander con las cartas que ya tienes, lleva tu colección y te ayuda a
        intercambiar cartas con otros jugadores. Los intercambios se acuerdan entre usuarios: Deck
        Doctor no vende, no cobra ni envía nada y no responde de lo que acuerden las partes.
      </p>

      <h2>Uso</h2>
      <ul>
        <li>Eres responsable de lo que publicas (nombres de mazos, listas, perfil).</li>
        <li>
          No está permitido usar la web para suplantar a otros, publicar contenido ilegal u
          ofensivo, ni sobrecargarla con peticiones automáticas.
        </li>
        <li>Podemos retirar contenido o cuentas que incumplan estas normas.</li>
      </ul>
      <p>
        Los precios son orientativos (referencia del mercado europeo) y las recomendaciones salen de
        lo que juega la comunidad: úsalos como guía, sin garantía.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Magic: The Gathering, sus cartas, nombres, símbolos e ilustraciones son propiedad de Wizards
        of the Coast LLC.
      </p>
      <FanContentNotice />

      <h2>Privacidad</h2>
      <p>
        Cómo tratamos tus datos está en la <Link href="/privacy">política de privacidad</Link>.
      </p>
    </LegalPage>
  );
}
