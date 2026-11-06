import { connection } from "next/server";
import { Suspense } from "react";
import { FanContentNotice, LegalPage, Pending } from "@/components/legal";
import { loadEnv } from "@/config/env";
import { Link } from "@/components/i18n";
import { paramLocale, pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Aviso legal", "Legal notice"],
  description: [
    "Titular, condiciones de uso y propiedad intelectual de Doctor Deck.",
    "Owner, terms of use and intellectual property of Doctor Deck.",
  ],
  path: "/legal",
});

async function OwnerData({ en = false }: { en?: boolean }) {
  await connection();
  const env = loadEnv();
  return (
    <ul>
      <li>
        {en ? "Owner" : "Titular"}: {env.LEGAL_OWNER ?? <Pending what={en ? "owner" : "titular"} />}
      </li>
      <li>
        {en ? "Contact" : "Contacto"}:{" "}
        {env.LEGAL_EMAIL ? (
          <a href={`mailto:${env.LEGAL_EMAIL}`}>{env.LEGAL_EMAIL}</a>
        ) : (
          <Pending what={en ? "contact email" : "email de contacto"} />
        )}
      </li>
    </ul>
  );
}

export default async function Page({ params }: PageProps<"/[lang]">) {
  return (await paramLocale(params)) === "en" ? <PageEn /> : <PageEs />;
}

function PageEn() {
  return (
    <LegalPage title="Legal notice" updated="6 November 2026">
      <h2>Owner</h2>
      <Suspense fallback={<p>…</p>}>
        <OwnerData en />
      </Suspense>

      <h2>What Doctor Deck is</h2>
      <p>
        A free tool for Magic: The Gathering players: it suggests upgrades for your Commander decks
        with the cards you already own, keeps track of your collection and helps you trade cards
        with other players. Trades are agreed between users: Doctor Deck doesn&apos;t sell, charge
        for or ship anything and isn&apos;t responsible for what the parties agree.
      </p>

      <h2>Use</h2>
      <ul>
        <li>You are responsible for what you publish (deck names, lists, profile).</li>
        <li>
          You may not use the site to impersonate others, publish illegal or offensive content, or
          overload it with automated requests.
        </li>
        <li>We may remove content or accounts that break these rules.</li>
      </ul>
      <p>
        Prices are approximate (European market reference) and recommendations come from what the
        community plays: use them as a guide, with no guarantee.
      </p>

      <h2>Intellectual property</h2>
      <p>
        Magic: The Gathering, its cards, names, symbols and illustrations are property of Wizards of
        the Coast LLC.
      </p>
      <FanContentNotice />

      <h2>Privacy</h2>
      <p>
        How we handle your data is explained in the <Link href="/privacy">privacy policy</Link>.
        These terms are written originally in Spanish; if the two versions differ, the Spanish one
        prevails.
      </p>
    </LegalPage>
  );
}

function PageEs() {
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
        intercambiar cartas con otros jugadores. Los intercambios se acuerdan entre usuarios: Doctor
        Deck no vende, no cobra ni envía nada y no responde de lo que acuerden las partes.
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
