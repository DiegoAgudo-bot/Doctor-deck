import type { NextRequest } from "next/server";
import { z } from "zod";
import { deleteAccount } from "@/application/account";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Borra mi cuenta y todo lo mío. Cuerpo: `{confirm: "mi@email"}`. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { confirm } = z.object({ confirm: z.string().min(1).max(320) }).parse(await req.json());
    await deleteAccount(user.id, confirm, { profiles: getContainer().social });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
