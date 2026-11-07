"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/error-reporter";
import { Link, useT } from "@/components/i18n";

/** Si una página falla al pintarse: aviso, reintentar y el error al registro. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <main className="page">
      <div className="panel flex flex-col items-center gap-3 px-5 py-10 text-center">
        <span className="h2">
          {t("Algo ha fallado al cargar esta página", "Something went wrong loading this page")}
        </span>
        <span className="muted max-w-[440px] text-[13px]">
          {t(
            "Ya nos ha llegado el aviso. Prueba otra vez; si sigue fallando, vuelve al inicio.",
            "We've already been notified. Try again; if it keeps failing, go back home.",
          )}
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            {t("Reintentar", "Retry")}
          </button>
          <Link className="btn" href="/">
            {t("Ir al inicio", "Go home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
