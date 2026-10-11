import { z } from "zod";

/** Una línea de propuesta tal y como la manda la UI (desde el punto de vista de quien la manda). */
export const proposalLinesSchema = z
  .array(
    z.object({
      side: z.enum(["give", "get"]),
      oracleId: z.string().min(1).max(64),
      scryfallId: z.string().min(1).max(64).nullable(),
      foil: z.boolean(),
      language: z.string().min(1).max(8).nullable(),
      quantity: z.number().int().min(1).max(999),
    }),
  )
  .max(500);
