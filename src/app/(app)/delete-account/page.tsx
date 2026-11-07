import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LegalPage, Pending } from "@/components/legal";
import { loadEnv } from "@/config/env";

// Pública y sin sesión: Google Play pide una dirección donde cualquiera vea cómo borrar su cuenta.
export const metadata: Metadata = {
  title: "Borrar tu cuenta · Doctor Deck",
  description: "Cómo borrar tu cuenta de Doctor Deck (web y app Android) y qué datos se eliminan.",
  alternates: { canonical: "/delete-account" },
};

async function ContactEmail() {
  await connection();
  const email = loadEnv().LEGAL_EMAIL;
  return email ? (
    <a href={`mailto:${email}?subject=Borrar%20mi%20cuenta`}>{email}</a>
  ) : (
    <Pending what="email de contacto" />
  );
}

export default function Page() {
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
