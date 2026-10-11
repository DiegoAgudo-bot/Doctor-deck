import Link from "next/link";
import type { ReactNode } from "react";

/** Página de texto legal: columna estrecha y legible. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="page max-w-[760px]">
      <article className="prose">
        <h1 className="h1">{title}</h1>
        <p className="subtle text-xs">Última actualización: {updated}</p>
        {children}
      </article>
    </main>
  );
}

/** Dato del titular que falta configurar en el servidor (LEGAL_OWNER / LEGAL_EMAIL). */
export const Pending = ({ what }: { what: string }) => (
  <span className="pill pill-warn">pendiente: {what}</span>
);

/** Aviso obligatorio de la Fan Content Policy de Wizards of the Coast. */
export function FanContentNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`subtle text-xs ${className}`}>
      Deck Doctor es contenido de fans no oficial permitido por la{" "}
      <a href="https://company.wizards.com/es/legal/fancontentpolicy" rel="noopener">
        Política de contenido de fans
      </a>
      . No está aprobado ni respaldado por Wizards. Partes de los materiales utilizados son
      propiedad de Wizards of the Coast. ©Wizards of the Coast LLC.
    </p>
  );
}

/** Pie con los enlaces legales. */
export function LegalFooter() {
  return (
    <footer className="legalfoot">
      <nav>
        <Link href="/privacy">Privacidad</Link>
        <Link href="/legal">Aviso legal</Link>
        <a href="https://scryfall.com" rel="noopener">
          Datos e imágenes: Scryfall
        </a>
        <a href="https://edhrec.com" rel="noopener">
          Recomendaciones: EDHREC
        </a>
      </nav>
      <FanContentNotice />
    </footer>
  );
}
