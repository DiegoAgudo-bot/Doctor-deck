"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/components/error-reporter";

/** Si una página falla al pintarse: aviso, reintentar y el error al registro. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <main className="page">
      <div className="panel flex flex-col items-center gap-3 px-5 py-10 text-center">
        <span className="h2">Algo ha fallado al cargar esta página</span>
        <span className="muted max-w-[440px] text-[13px]">
          Ya nos ha llegado el aviso. Prueba otra vez; si sigue fallando, vuelve al inicio.
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Reintentar
          </button>
          <Link className="btn" href="/">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
