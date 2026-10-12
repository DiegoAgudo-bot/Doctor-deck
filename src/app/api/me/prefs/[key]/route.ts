import type { NextRequest } from "next/server";
import { AppError } from "@/application/errors";
import { isPrefKey, PREF_MAX_CHARS, validPrefValue } from "@/domain/prefs/prefs";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Guarda una preferencia (el cuerpo es el objeto entero; sustituye al anterior). */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/me/prefs/[key]">) {
  try {
    const user = await requireUser(req);
    const { key } = await ctx.params;
    if (!isPrefKey(key)) throw new AppError("invalid_pref", "Preferencia desconocida", 400);
    const value: unknown = await req.json().catch(() => null);
    if (!validPrefValue(value)) {
      throw new AppError(
        "invalid_pref",
        `La preferencia debe ser un objeto de como mucho ${PREF_MAX_CHARS} caracteres`,
        400,
      );
    }
    await getContainer().prefsFor(user.id).set(key, value);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
