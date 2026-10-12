import { cleanReport, errorFingerprint, type ErrorReport } from "@/domain/errors/report";
import type { ErrorLog, ErrorLogEntry } from "@/domain/ports/error-log";
import type { Db } from "./prisma";

/** Errores distintos que se guardan como mucho (se borran los que hace más que no pasan). */
const MAX_ROWS = 500;

export class PrismaErrorLog implements ErrorLog {
  constructor(private readonly db: Db) {}

  async record(report: ErrorReport, at = new Date()) {
    const r = cleanReport(report);
    const fingerprint = errorFingerprint(r);
    const data = {
      message: r.message,
      stack: r.stack ?? null,
      path: r.path ?? null,
      userAgent: r.userAgent ?? null,
      lastAt: at,
    };
    await this.db.errorLog.upsert({
      where: { fingerprint },
      create: { fingerprint, source: r.source, firstAt: at, ...data },
      update: { ...data, count: { increment: 1 } },
    });
    const total = await this.db.errorLog.count();
    if (total > MAX_ROWS) {
      const old = await this.db.errorLog.findMany({
        orderBy: { lastAt: "asc" },
        take: total - MAX_ROWS,
        select: { id: true },
      });
      await this.db.errorLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  }

  async list(limit: number): Promise<ErrorLogEntry[]> {
    const rows = await this.db.errorLog.findMany({ orderBy: { lastAt: "desc" }, take: limit });
    return rows.map((r) => ({
      id: r.id,
      source: r.source === "server" ? "server" : "client",
      message: r.message,
      stack: r.stack,
      path: r.path,
      userAgent: r.userAgent,
      count: r.count,
      firstAt: r.firstAt,
      lastAt: r.lastAt,
    }));
  }

  async clear(id?: number) {
    await this.db.errorLog.deleteMany(id === undefined ? undefined : { where: { id } });
  }
}
