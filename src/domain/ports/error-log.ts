import type { ErrorReport } from "../errors/report";

export interface ErrorLogEntry extends ErrorReport {
  id: number;
  count: number;
  firstAt: Date;
  lastAt: Date;
}

/** Registro de errores de la app (lo ven los administradores en /admin/errors). */
export interface ErrorLog {
  /** Suma uno a ese error (por su huella) o lo crea. */
  record(report: ErrorReport, at?: Date): Promise<void>;
  /** Los más recientes primero. */
  list(limit: number): Promise<ErrorLogEntry[]>;
  /** Borra uno (o todos, sin id). */
  clear(id?: number): Promise<void>;
}
