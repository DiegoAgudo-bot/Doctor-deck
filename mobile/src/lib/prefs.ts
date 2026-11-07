import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "./api";
import {
  type CollectionLook,
  parseCollectionLook,
  type Pref,
  withCollectionLook,
} from "./collection-look";

export { naturalDesc } from "./collection-look";

interface PrefsResponse {
  prefs: Partial<Record<"cards" | "collection", Pref>>;
}

/**
 * Orden y vista de la colección compartidos con la web (`/api/me/prefs`): al abrir se aplica lo
 * guardado con la cuenta y cada cambio de aquí se guarda allí.
 */
export function useSharedCollectionLook(
  /** Cuando ya se ha leído lo guardado en el móvil (si no, lo pisaría al llegar). */
  ready: boolean,
  look: CollectionLook,
  sorts: readonly string[],
  apply: (p: Partial<CollectionLook>) => void,
) {
  const qc = useQueryClient();
  const prefs = useQuery({
    queryKey: ["prefs"],
    queryFn: () => api<PrefsResponse>("/api/me/prefs"),
    staleTime: 5 * 60_000,
  });
  const save = useMutation({
    mutationFn: (pref: Pref) => api("/api/me/prefs/collection", { method: "PUT", body: pref }),
    onMutate: (pref) =>
      qc.setQueryData<PrefsResponse>(["prefs"], (old) => ({
        prefs: { ...old?.prefs, collection: pref },
      })),
  });
  const applied = useRef(false);
  const server = prefs.data?.prefs.collection;

  useEffect(() => {
    if (applied.current || !ready || !prefs.data) return;
    applied.current = true;
    const p = parseCollectionLook(server, sorts);
    if (Object.keys(p).length > 0) apply(p);
  }, [ready, prefs.data, server, sorts, apply]);

  const { sort, desc, grid } = look;
  useEffect(() => {
    if (!applied.current) return;
    const p = parseCollectionLook(server, sorts);
    if (p.sort === sort && p.desc === desc && p.grid === grid) return;
    save.mutate(withCollectionLook(server, { sort, desc, grid }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia lo de aquí
  }, [sort, desc, grid]);
}
