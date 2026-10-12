import { connection } from "next/server";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Mis preferencias de la interfaz: `{prefs: {cards: {...}, collection: {...}}}`. */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    return Response.json({ prefs: await getContainer().prefsFor(user.id).all() });
  } catch (err) {
    return errorResponse(err);
  }
}
