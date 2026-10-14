import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AddCardsResponse } from "@/server/dto";
import { toast } from "~/components/toast";
import { api } from "./api";
import { conditionShort } from "./copies";
import { tapFeedback } from "./feedback";
import { useStoredState } from "./hooks";

export interface CopySpec {
  oracleId: string;
  /** Edición concreta; si no, el servidor elige. */
  scryfallId?: string | undefined;
  /** Para el aviso: «SET #12». */
  printingLabel?: string | undefined;
  quantity: number;
  foil: boolean;
  language: string;
  condition: string;
}

/** Idioma y estado de la última copia añadida: se proponen en la siguiente (como ManaBox). */
export function useCopyDefaults() {
  return useStoredState("copy.defaults", { language: "en", condition: "near_mint" });
}

/** Añadir copias a la colección, con aviso y vibración, refrescando lo que las enseña. */
export function useAddCopies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: CopySpec) =>
      api<AddCardsResponse>("/api/collection/cards", {
        body: {
          cards: [
            {
              ...(c.scryfallId ? { scryfallId: c.scryfallId } : { oracleId: c.oracleId }),
              quantity: c.quantity,
              foil: c.foil,
              language: c.language,
              condition: c.condition,
            },
          ],
        },
      }),
    onSuccess: (_res, c) => {
      tapFeedback();
      const detail = [
        c.printingLabel,
        c.foil ? "foil" : null,
        c.language !== "en" ? c.language.toUpperCase() : null,
        conditionShort(c.condition),
      ]
        .filter(Boolean)
        .join(" · ");
      toast(
        `${c.quantity === 1 ? "Añadida 1 copia" : `Añadidas ${c.quantity} copias`} (${detail})`,
      );
      qc.invalidateQueries({ queryKey: ["lines", c.oracleId] });
      qc.invalidateQueries({ queryKey: ["card", c.oracleId] });
      qc.invalidateQueries({ queryKey: ["collection"] });
    },
    onError: (e) => toast(`No se ha podido añadir: ${e.message}`),
  });
}
