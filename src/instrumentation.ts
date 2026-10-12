import type { Instrumentation } from "next";

/** Errores del servidor que no recoge `errorResponse` (al pintar páginas): al registro. */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerError } = await import("./server/error-log");
  await reportServerError(err, request.path);
};
