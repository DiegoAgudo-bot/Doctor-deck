import type { ErrorReport } from "@/domain/errors/report";

/**
 * Guarda un error del servidor en el registro (/admin/errors). Nunca lanza: si no se puede guardar,
 * se queda en la salida de error del proceso. El contenedor se carga al usarlo (evita ciclos).
 */
export async function reportServerError(err: unknown, path?: string | null): Promise<void> {
  // En los tests unitarios no hay BD de la app (y no se debe tocar la de desarrollo).
  if (process.env.VITEST) return;
  const report: ErrorReport = {
    source: "server",
    message: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    stack: err instanceof Error ? (err.stack ?? null) : null,
    path: path ?? null,
  };
  try {
    const { getContainer } = await import("./container");
    await getContainer().errorLog.record(report);
  } catch (e) {
    console.error("No se pudo guardar el error en el registro:", e);
  }
}
