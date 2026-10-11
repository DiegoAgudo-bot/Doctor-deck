/**
 * Error de un caso de uso con su código y estado HTTP (fase 21 en adelante; los de antes tienen
 * sus propias clases). `errorResponse` lo traduce a `{error: {code, message}}`.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 429 = 400,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError("not_found", what, 404);
export const forbidden = (message = "No puedes hacer eso.") =>
  new AppError("forbidden", message, 403);
