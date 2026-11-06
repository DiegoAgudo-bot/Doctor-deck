"use client";

import type { ReactNode } from "react";
import { LanguageSwitch, Link, useLocale, useT } from "@/components/i18n";

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
  const t = useT();
  return (
    <main className="page">
      <article className="prose max-w-[80ch]">
        <h1 className="h1">{title}</h1>
        <p className="subtle text-xs">
          {t("Última actualización", "Last updated")}: {updated}
        </p>
        {children}
      </article>
    </main>
  );
}

/** Dato del titular que falta configurar en el servidor (LEGAL_OWNER / LEGAL_EMAIL). */
export function Pending({ what }: { what: string }) {
  const t = useT();
  return (
    <span className="pill pill-warn">
      {t("pendiente", "pending")}: {what}
    </span>
  );
}

/** Aviso obligatorio de la Fan Content Policy de Wizards of the Coast. */
export function FanContentNotice({ className = "" }: { className?: string }) {
  return useLocale() === "en" ? (
    <p className={`subtle text-xs ${className}`}>
      Doctor Deck is unofficial Fan Content permitted under the{" "}
      <a href="https://company.wizards.com/en/legal/fancontentpolicy" rel="noopener">
        Fan Content Policy
      </a>
      . Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
      the Coast. ©Wizards of the Coast LLC.
    </p>
  ) : (
    <p className={`subtle text-xs ${className}`}>
      Doctor Deck es contenido de fans no oficial permitido por la{" "}
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
  const t = useT();
  return (
    <footer className="legalfoot">
      <nav>
        <Link href="/privacy">{t("Privacidad", "Privacy")}</Link>
        <Link href="/legal">{t("Aviso legal", "Legal notice")}</Link>
        <LanguageSwitch />
      </nav>
      <FanContentNotice />
    </footer>
  );
}
