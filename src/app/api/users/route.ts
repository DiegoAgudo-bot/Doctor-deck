import { connection, type NextRequest } from "next/server";
import { getContainer } from "@/server/container";
import { publicProfileDTO, type UserSummaryDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";

/** Buscar usuarios por nombre o @usuario; sin texto, los que más mazos públicos tienen. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").replace(/^@/, "").slice(0, 40);
    const users = await getContainer().social.search(q, 30);
    const body: UserSummaryDTO[] = users.map((u) => ({
      ...publicProfileDTO(u),
      followers: u.followers,
      publicDecks: u.publicDecks,
    }));
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
