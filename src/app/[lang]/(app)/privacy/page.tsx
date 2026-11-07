import { connection } from "next/server";
import { Suspense } from "react";
import { LegalPage, Pending } from "@/components/legal";
import { loadEnv } from "@/config/env";
import { Link } from "@/components/i18n";
import { paramLocale, pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Privacidad", "Privacy"],
  description: [
    "Qué datos guarda Doctor Deck, para qué, cuánto tiempo y cómo borrarlos.",
    "What data Doctor Deck keeps, why, for how long and how to delete it.",
  ],
  path: "/privacy",
});

/** Titular y contacto: se leen al servir la página (vienen del .env del servidor). */
async function Owner({ field, en = false }: { field: "owner" | "email"; en?: boolean }) {
  await connection();
  const env = loadEnv();
  if (field === "owner") return env.LEGAL_OWNER ?? <Pending what={en ? "owner" : "titular"} />;
  return env.LEGAL_EMAIL ? (
    <a href={`mailto:${env.LEGAL_EMAIL}`}>{env.LEGAL_EMAIL}</a>
  ) : (
    <Pending what={en ? "contact email" : "email de contacto"} />
  );
}

export default async function Page({ params }: PageProps<"/[lang]">) {
  return (await paramLocale(params)) === "en" ? <PageEn /> : <PageEs />;
}

function PageEn() {
  return (
    <LegalPage title="Privacy policy" updated="6 November 2026">
      <h2>Who is responsible</h2>
      <p>
        <Suspense fallback="…">
          <Owner field="owner" en />
        </Suspense>
        . For any question about your data, write to{" "}
        <Suspense fallback="…">
          <Owner field="email" en />
        </Suspense>
        .
      </p>

      <h2>What data we keep</h2>
      <ul>
        <li>
          <b>Your account</b>: email, name, username and your encrypted password (or your Google
          identifier if you sign in with Google).
        </li>
        <li>
          <b>What you upload or create</b>: your collection (cards, set, foil, language and
          condition), your decks, wishlists and trade lists, trade offers, role corrections, who you
          follow and your likes.
        </li>
        <li>
          <b>Social features, if you use them</b>: play groups, recorded games, loans, comments on
          decks, reports and who you block.
        </li>
        <li>
          <b>Technical</b>: your session (date, browser and IP address) to keep you signed in and
          protect your account, and errors from the website or the app (message, page and browser,
          with no account data) so we can fix them.
        </li>
        <li>
          <b>Mobile app</b>: if you enable notifications, an identifier of your phone to deliver
          them (with the system and app version). It is deleted when you sign out of the app or
          uninstall it. What you share with the app from other apps is only used to import it.
        </li>
        <li>
          <b>Card scanner</b>: the camera is only used while you scan. The image is read on the
          phone itself and never leaves it; only the text that was read (card name, set and number)
          reaches the server to identify the card.
        </li>
      </ul>
      <p>Without an account, your collection and your deck are stored only in your browser.</p>

      <h2>Why, and on what basis</h2>
      <ul>
        <li>
          <b>Providing the service</b> (analyzing your decks with your collection, saving them,
          trading): performance of the service you request when you create the account.
        </li>
        <li>
          <b>What you choose to make public</b> (public decks, public collection, trade lists): your
          consent, which you can withdraw at any time from <Link href="/settings">Settings</Link> or
          on each deck.
        </li>
        <li>
          <b>Notifications</b> on the website and, if you allow it on your phone, as app
          notifications (price drops, trade matches, offers): you configure them in Settings and on
          your phone.
        </li>
      </ul>
      <p>There is no advertising, no data is sold and no commercial profiling is done.</p>

      <h2>Who else sees it</h2>
      <ul>
        <li>Other users: only what you make public and your username. Never your email.</li>
        <li>
          Providers needed to run the service: server hosting (in the European Union), backup
          storage (encrypted), email delivery (to verify your email and reset your password), Google
          if you sign in with Google, and Firebase Cloud Messaging (Google) to deliver app
          notifications.
        </li>
        <li>
          To find recommendations and combos we query external card data services with the deck
          list, without any of your personal data.
        </li>
      </ul>

      <h2>How long</h2>
      <p>
        As long as you keep your account. If you delete it, everything is removed immediately; it
        disappears from backups within 14 days. How to do it:{" "}
        <Link href="/delete-account">Delete your account</Link>.
      </p>

      <h2>Cookies and storage</h2>
      <p>
        Only one technical session cookie, essential to keep you signed in (in the app it is stored
        encrypted on the phone), and one that remembers the language you chose. Your browser also
        stores your preferences (light/dark theme, the last deck you analyzed and, without an
        account, your collection). We don&apos;t use analytics or advertising cookies, so we
        don&apos;t ask for consent.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export and delete your data. From{" "}
        <Link href="/settings">Settings</Link> you can download all your data (JSON), export your
        collection (CSV) and delete your account. For anything else, write to us. If you think we
        are not handling your data properly, you can file a complaint with the Spanish Data
        Protection Agency (
        <a href="https://www.aepd.es/en" rel="noopener">
          AEPD
        </a>
        ) or your local supervisory authority.
      </p>
      <p className="subtle text-xs">
        This policy is written originally in Spanish; if the two versions differ, the Spanish one
        prevails.
      </p>
    </LegalPage>
  );
}

function PageEs() {
  return (
    <LegalPage title="Política de privacidad" updated="6 de noviembre de 2026">
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
          <b>Lo social, si lo usas</b>: grupos de juego, partidas registradas, préstamos,
          comentarios en mazos, denuncias y a quién bloqueas.
        </li>
        <li>
          <b>Técnicos</b>: la sesión (fecha, navegador y dirección IP) para mantenerte conectado y
          proteger la cuenta, y los errores de la web o la app (mensaje, página y navegador, sin
          datos de tu cuenta) para arreglarlos.
        </li>
        <li>
          <b>App móvil</b>: si activas las notificaciones, un identificador del móvil para mandarlas
          (con el sistema y la versión de la app). Se borra al cerrar sesión en la app o al
          desinstalarla. Lo que compartes con la app desde otras apps solo se usa para importarlo.
        </li>
        <li>
          <b>Escáner de cartas</b>: la cámara solo se usa mientras escaneas. La imagen se lee en el
          propio móvil y nunca sale de él; al servidor solo llega el texto leído (nombre, edición y
          número de la carta) para reconocerla.
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
          Proveedores necesarios para que funcione: el alojamiento del servidor (en la Unión
          Europea), el almacenamiento de las copias de seguridad (cifradas), el envío de emails
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
        seguridad desaparece en un máximo de 14 días. Cómo hacerlo, en{" "}
        <Link href="/delete-account">Borrar tu cuenta</Link>.
      </p>

      <h2>Cookies y almacenamiento</h2>
      <p>
        Solo una cookie técnica de sesión, imprescindible para mantenerte conectado (en la app se
        guarda cifrada en el móvil), y otra que recuerda el idioma que elijas. En tu navegador se
        guardan además tus preferencias (tema claro/oscuro, el último mazo analizado y, sin cuenta,
        tu colección). No usamos cookies de análisis ni de publicidad, por eso no te pedimos
        consentimiento.
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
