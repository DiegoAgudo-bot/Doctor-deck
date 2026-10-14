import type { NextRequest } from "next/server";
import { z } from "zod";
import { deleteAccount } from "@/application/account";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { confirmIdentity, requireUser } from "@/server/session";
import { readJson } from "@/server/body";

/**
 * Borra mi cuenta y todo lo mío. Cuerpo: `{confirm: "mi@email", password?}` (la contraseña si la
 * cuenta tiene; con solo Google, una sesión reciente).
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { confirm, password } = z
      .object({ confirm: z.string().min(1).max(320), password: z.string().max(200).optional() })
      .parse(await readJson(req));
    await confirmIdentity(req, password);
    await deleteAccount(user.id, confirm, { profiles: getContainer().social });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
