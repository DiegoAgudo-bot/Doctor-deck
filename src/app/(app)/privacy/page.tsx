import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LegalPage, Pending } from "@/components/legal";
import { loadEnv } from "@/config/env";

export const metadata: Metadata = {
  title: "Privacidad · Doctor Deck",
  description: "Qué datos guarda Doctor Deck, para qué, cuánto tiempo y cómo borrarlos.",
  alternates: { canonical: "/privacy" },
};

/** Titular y contacto: se leen al servir la página (vienen del .env del servidor). */
async function Owner({ field }: { field: "owner" | "email" }) {
  await connection();
  const env = loadEnv();
  if (field === "owner") return env.LEGAL_OWNER ?? <Pending what="titular" />;
  return env.LEGAL_EMAIL ? (
    <a href={`mailto:${env.LEGAL_EMAIL}`}>{env.LEGAL_EMAIL}</a>
  ) : (
    <Pending what="email de contacto" />
  );
}

export default function Page() {
  return (
    <LegalPage title="Política de privacidad" updated="12 de octubre de 2026">
      <h2>Quién es el responsable</h2>
      <p>
        <Suspense fallback="…">
          <Owner field="owner" />
        </Suspense>
        . Para cualquier cuestión sobre tus datos escribe a{" "}
        <Suspense fallback="…">
          <Owner field="email" />
        </Suspense>
        .
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <b>Tu cuenta</b>: email, nombre, nombre de usuario y la contraseña cifrada (o el
          identificador de Google si entras con Google).
        </li>
        <li>
          <b>Lo que subes o creas</b>: tu colección (cartas, edición, foil, idioma y estado), tus
          mazos, listas de deseos y de intercambio, propuestas de intercambio, correcciones de
          roles, a quién sigues y tus «me gusta».
        </li>
        <li>
          <b>Técnicos</b>: la sesión (fecha, navegador y dirección IP) para mantenerte conectado y
          proteger la cuenta.
        </li>
        <li>
          <b>App móvil</b>: si activas las notificaciones, un identificador del móvil para mandarlas
          (con el sistema y la versión de la app). Se borra al cerrar sesión en la app o al
          desinstalarla. Lo que compartes con la app desde otras apps solo se usa para importarlo.
        </li>
      </ul>
      <p>Sin cuenta, tu colección y tu mazo se guardan solo en tu navegador, no en el servidor.</p>

      <h2>Para qué y con qué base</h2>
      <ul>
        <li>
          <b>Darte el servicio</b> (analizar tus mazos con tu colección, guardarlos, intercambiar):
          ejecución del servicio que pides al crear la cuenta.
        </li>
        <li>
          <b>Lo que eliges hacer público</b> (mazos públicos, colección pública, listas de
          intercambio): tu consentimiento, que retiras cuando quieras desde{" "}
          <Link href="/settings">Ajustes</Link> o en cada mazo.
        </li>
        <li>
          <b>Avisos</b> en la web y, si lo permites en el móvil, como notificaciones de la app
          (bajadas de precio, cruces, propuestas): los configuras en Ajustes y en el propio móvil.
        </li>
      </ul>
      <p>No hay publicidad, no se venden datos y no se hacen perfiles comerciales.</p>

      <h2>Quién más los ve</h2>
      <ul>
        <li>Otros usuarios: solo lo que hagas público y tu nombre de usuario. El email, nunca.</li>
        <li>
          Proveedores necesarios para que funcione: el alojamiento del servidor, el envío de emails
          (para verificar el email y recuperar la contraseña), Google si entras con Google y
          Firebase Cloud Messaging (Google) para entregar las notificaciones de la app.
        </li>
        <li>
          Para buscar recomendaciones y combos se consultan servicios externos de datos de cartas
          con la lista de cartas del mazo, sin ningún dato tuyo.
        </li>
      </ul>

      <h2>Cuánto tiempo</h2>
      <p>
        Mientras tengas la cuenta. Si la borras se elimina todo al momento; de las copias de
        seguridad desaparece en un máximo de 14 días.
      </p>

      <h2>Cookies y almacenamiento</h2>
      <p>
        Solo una cookie técnica de sesión, imprescindible para mantenerte conectado (en la app se
        guarda cifrada en el móvil). En tu navegador se guardan además tus preferencias (tema
        claro/oscuro, el último mazo analizado y, sin cuenta, tu colección). No usamos cookies de
        análisis ni de publicidad, por eso no te pedimos consentimiento.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, corregirlos, llevártelos y borrarlos. Desde{" "}
        <Link href="/settings">Ajustes</Link> descargas todos tus datos (JSON), exportas tu
        colección (CSV) y borras tu cuenta. Para lo demás, escríbenos. Si crees que no tratamos bien
        tus datos, puedes reclamar ante la{" "}
        <a href="https://www.aepd.es" rel="noopener">
          Agencia Española de Protección de Datos
        </a>
        .
      </p>
    </LegalPage>
  );
}
