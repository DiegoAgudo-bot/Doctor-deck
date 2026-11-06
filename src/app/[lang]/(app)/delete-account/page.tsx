import { connection } from "next/server";
import { Suspense } from "react";
import { LegalPage, Pending } from "@/components/legal";
import { loadEnv } from "@/config/env";
import { Link } from "@/components/i18n";
import { paramLocale, pageMetadata } from "@/server/i18n";

// Pública y sin sesión: Google Play pide una dirección donde cualquiera vea cómo borrar su cuenta.
export const generateMetadata = pageMetadata({
  title: ["Borrar tu cuenta", "Delete your account"],
  description: [
    "Cómo borrar tu cuenta de Doctor Deck (web y app Android) y qué datos se eliminan.",
    "How to delete your Doctor Deck account (web and Android app) and which data is removed.",
  ],
  path: "/delete-account",
});

async function ContactEmail({ en = false }: { en?: boolean }) {
  await connection();
  const email = loadEnv().LEGAL_EMAIL;
  const subject = en ? "Delete%20my%20account" : "Borrar%20mi%20cuenta";
  return email ? (
    <a href={`mailto:${email}?subject=${subject}`}>{email}</a>
  ) : (
    <Pending what={en ? "contact email" : "email de contacto"} />
  );
}

export default async function Page({ params }: PageProps<"/[lang]">) {
  return (await paramLocale(params)) === "en" ? <PageEn /> : <PageEs />;
}

function PageEn() {
  return (
    <LegalPage title="Delete your account" updated="6 November 2026">
      <p>
        You can delete your <b>Doctor Deck</b> account (website and Android app) whenever you want.
        It is deleted immediately and can&apos;t be undone.
      </p>

      <h2>From the website</h2>
      <ol>
        <li>
          Go to <Link href="/settings">Settings</Link> with your account.
        </li>
        <li>In “Your data”, if you want, first download your data (JSON) or collection (CSV).</li>
        <li>
          Tap “Delete my account” and confirm by typing your email and password (if you sign in with
          Google, having signed in recently is enough).
        </li>
      </ol>

      <h2>From the app</h2>
      <ol>
        <li>Tap the round button with your initial (top right) › Settings.</li>
        <li>At the bottom, “Delete my account”, and confirm.</li>
      </ol>

      <h2>If you can&apos;t sign in</h2>
      <p>
        Write to us from your account&apos;s email at{" "}
        <Suspense fallback="…">
          <ContactEmail en />
        </Suspense>{" "}
        asking us to delete it. We&apos;ll reply within 30 days at most.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your account: email, name, username, password and Google sign-in.</li>
        <li>
          Your collection, decks (with their history), wishlists and trade lists, offers, loans,
          role corrections, preferences and notifications.
        </li>
        <li>
          Social data: who you follow and who follows you, likes, comments, groups you created,
          games you recorded and blocks.
        </li>
        <li>Phones registered for notifications and open sessions.</li>
      </ul>

      <h2>What stays and for how long</h2>
      <ul>
        <li>Encrypted backups: your data disappears from them within 14 days at most.</li>
        <li>
          Cards you already traded belong to the other person: they stay in their collection,
          without your name.
        </li>
      </ul>
      <p>
        More details in the <Link href="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}

function PageEs() {
  return (
    <LegalPage title="Borrar tu cuenta" updated="6 de noviembre de 2026">
      <p>
        Puedes borrar tu cuenta de <b>Doctor Deck</b> (la web y la app para Android) cuando quieras.
        Se borra al momento y no se puede deshacer.
      </p>

      <h2>Desde la web</h2>
      <ol>
        <li>
          Entra en <Link href="/settings">Ajustes</Link> con tu cuenta.
        </li>
        <li>En «Tus datos», si quieres, descarga antes tus datos (JSON) o tu colección (CSV).</li>
        <li>
          Pulsa «Borrar mi cuenta» y confirma escribiendo tu email y tu contraseña (si entras con
          Google, basta con haber entrado hace poco).
        </li>
      </ol>

      <h2>Desde la app</h2>
      <ol>
        <li>Toca el botón redondo con tu inicial (arriba a la derecha) › Ajustes.</li>
        <li>Al final, «Borrar mi cuenta», y confirma.</li>
      </ol>

      <h2>Si no puedes entrar</h2>
      <p>
        Escríbenos desde el email de tu cuenta a{" "}
        <Suspense fallback="…">
          <ContactEmail />
        </Suspense>{" "}
        pidiendo que la borremos. Te contestamos en un plazo máximo de 30 días.
      </p>

      <h2>Qué se borra</h2>
      <ul>
        <li>Tu cuenta: email, nombre, nombre de usuario, contraseña y el acceso con Google.</li>
        <li>
          Tu colección, mazos (con su historial), listas de deseos y de intercambio, propuestas,
          préstamos, roles corregidos, preferencias y avisos.
        </li>
        <li>
          Lo social: a quién sigues y quién te sigue, «me gusta», comentarios, grupos que creaste,
          partidas que registraste y bloqueos.
        </li>
        <li>Los móviles registrados para las notificaciones y las sesiones abiertas.</li>
      </ul>

      <h2>Qué se queda y cuánto tiempo</h2>
      <ul>
        <li>
          Las copias de seguridad cifradas: tus datos desaparecen de ellas en un máximo de 14 días.
        </li>
        <li>
          Las cartas que ya intercambiaste son de la otra persona: siguen en su colección, sin tu
          nombre.
        </li>
      </ul>
      <p>
        Más detalles en la <Link href="/privacy">política de privacidad</Link>.
      </p>
    </LegalPage>
  );
}
