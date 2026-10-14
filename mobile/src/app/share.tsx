import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import type { CollectionImportResponse, SharedImportResponse } from "@/server/dto";
import { CardThumb, FoilMark } from "~/components/card-bits";
import { Banner, Button, Empty, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { thousands } from "~/lib/format";
import { setPendingImport, takePendingImport } from "~/lib/shared";
import { colors } from "~/lib/theme";

/**
 * Lo compartido desde ManaBox (o elegido como fichero): se enseña qué cartas son y se elige qué
 * hacer: añadirlas a la colección, crear un mazo con la lista o, con el CSV entero, reemplazar
 * la colección.
 */
export default function ShareScreen() {
  const [pending] = useState(takePendingImport);
  const [preview, setPreview] = useState<SharedImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!pending) return;
    api<SharedImportResponse>("/api/import/shared", { body: { text: pending.text, save: false } })
      .then(setPreview)
      .catch((e: Error) => setError(e.message));
  }, [pending]);

  const done = (message: string) => {
    qc.invalidateQueries({ queryKey: ["collection"] });
    Alert.alert("Hecho", message);
    router.replace("/collection");
  };

  const add = useMutation({
    mutationFn: () =>
      api<SharedImportResponse>("/api/import/shared", {
        body: { text: pending!.text, save: true },
      }),
    onSuccess: (r) => done(`Añadidas ${thousands(r.totalCopies)} copias a tu colección.`),
    onError: (e) => setError(e.message),
  });
  const replace = useMutation({
    mutationFn: () =>
      api<CollectionImportResponse>("/api/collection", { body: pending!.text, raw: true }),
    onSuccess: (r) => done(`Colección reemplazada: ${thousands(r.totalCards)} copias.`),
    onError: (e) => setError(e.message),
  });

  if (!pending) {
    return (
      <Empty
        icon="share-outline"
        title="Nada que importar"
        text="Comparte una lista o el CSV de tu colección con Doctor Deck desde otra app."
      />
    );
  }
  if (error)
    return (
      <View style={{ padding: 16 }}>
        <Banner text={error} />
      </View>
    );
  if (!preview) return <Loading label="Leyendo lo compartido…" />;

  const newDeck = () => {
    setPendingImport(pending.text, pending.source);
    router.replace(
      `/deck-new?fromShare=1${preview.name ? `&name=${encodeURIComponent(preview.name)}` : ""}`,
    );
  };
  const confirmReplace = () =>
    Alert.alert(
      "¿Reemplazar tu colección?",
      "Las cartas que vinieron de un CSV anterior se sustituyen por las de este. Las que añadiste a mano se quedan.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Reemplazar", style: "destructive", onPress: () => replace.mutate() },
      ],
    );

  const actions = (
    <View
      style={{
        gap: 10,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: colors.panel,
      }}
    >
      {preview.looksLikeDeck && (
        <Button label="Crear un mazo con esta lista" icon="layers-outline" onPress={newDeck} />
      )}
      <Button
        label={`Añadir ${thousands(preview.totalCopies)} copias a mi colección`}
        icon="add-circle-outline"
        kind={preview.looksLikeDeck ? "secondary" : "primary"}
        onPress={() => add.mutate()}
        busy={add.isPending}
        disabled={preview.totalCopies === 0}
      />
      {preview.kind === "csv" ? (
        <Button
          label="Reemplazar mi colección con este CSV"
          kind="secondary"
          onPress={confirmReplace}
          busy={replace.isPending}
        />
      ) : (
        !preview.looksLikeDeck && (
          <Button label="Crear un mazo con esta lista" kind="secondary" onPress={newDeck} />
        )
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={preview.added}
        keyExtractor={(a, i) => `${a.card.oracleId}-${i}`}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 10 }}>
            <T variant="h2">{preview.name ?? pending.source}</T>
            <T variant="small">
              {preview.kind === "csv" ? "CSV de colección" : "Lista"} ·{" "}
              {thousands(preview.added.length)} cartas · {thousands(preview.totalCopies)} copias
            </T>
            {preview.notFound.length > 0 && (
              <Banner
                text={`No se han encontrado ${preview.notFound.length}: ${preview.notFound.slice(0, 5).join(", ")}${preview.notFound.length > 5 ? "…" : ""}`}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <T variant="mono" style={{ width: 28, textAlign: "right" }}>
              {item.quantity}
            </T>
            <CardThumb uri={item.card.imageUrl} width={34} name={item.card.name} />
            <View style={{ flex: 1 }}>
              <T numberOfLines={1}>{item.card.name}</T>
              {item.card.printing && (
                <T variant="small">
                  {item.card.printing.setCode.toUpperCase()} #{item.card.printing.collectorNumber}
                  {item.language && item.language !== "en"
                    ? ` · ${item.language.toUpperCase()}`
                    : ""}
                </T>
              )}
            </View>
            {item.foil && <FoilMark />}
          </View>
        )}
      />
      {actions}
    </View>
  );
}
