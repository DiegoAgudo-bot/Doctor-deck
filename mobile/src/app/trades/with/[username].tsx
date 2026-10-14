import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import type { TradeCalculatorDTO } from "@/server/dto";
import { TradeEditor } from "~/components/trade-editor";
import { Banner, Button, ErrorView, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { linesForApi, toLines, type TradeLine } from "~/lib/trade-lines";

/** Calculadora con otro usuario: propuesta inicial cuadrada por valor, que se ajusta y se envía. */
export default function TradeCalculator() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const qc = useQueryClient();
  const calc = useQuery({
    queryKey: ["trade-calculator", username],
    queryFn: () =>
      api<TradeCalculatorDTO>(`/api/trades/calculator?username=${encodeURIComponent(username)}`),
    staleTime: 0,
  });
  const [lines, setLines] = useState<TradeLine[]>([]);
  useEffect(() => {
    if (calc.data) setLines(toLines(calc.data.give, calc.data.get));
  }, [calc.data]);

  const create = useMutation({
    mutationFn: (send: boolean) =>
      api<{ id: string }>("/api/trades/proposals", {
        body: { username, lines: linesForApi(lines), send },
      }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      router.replace(`/trades/proposals/${id}`);
    },
  });

  if (calc.isPending) return <Loading label="Cruzando vuestras listas…" />;
  if (calc.isError) return <ErrorView error={calc.error} onRetry={() => calc.refetch()} />;
  const c = calc.data;
  const empty = !lines.some((l) => l.quantity > 0);
  return (
    <>
      <Stack.Screen options={{ title: `Intercambio con @${username}` }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <T variant="small">
          Propuesta inicial: lo que tienes para cambiar que @{username} busca, y al revés, ya
          cuadrada por valor (precio de cada copia según su edición y si es foil). Ajústala y
          envíasela: podrá aceptarla, rechazarla o contraproponer.
        </T>
        {c.openProposalId && (
          <View style={{ gap: 6 }}>
            <Banner tone="info" text="Ya tenéis una propuesta abierta." />
            <Button
              label="Ver la propuesta"
              kind="secondary"
              onPress={() => router.replace(`/trades/proposals/${c.openProposalId}`)}
            />
          </View>
        )}
        {c.give.length === 0 && c.get.length === 0 && (
          <Banner
            tone="info"
            text="Vuestras listas no cruzan ahora mismo. Puedes montar el intercambio a mano con «Añadir más»."
          />
        )}
        {create.isError && <Banner text={create.error.message} />}
        <TradeEditor
          partner={username}
          lines={lines}
          onChange={setLines}
          myCopies={c.myCopies}
          theirCopies={c.theirCopies}
        />
        <Button
          label={`Enviar a @${username}`}
          icon="paper-plane-outline"
          busy={create.isPending && create.variables === true}
          disabled={empty || create.isPending}
          onPress={() => create.mutate(true)}
        />
        <Button
          label="Guardar borrador"
          kind="secondary"
          busy={create.isPending && create.variables === false}
          disabled={empty || create.isPending}
          onPress={() => create.mutate(false)}
        />
      </ScrollView>
    </>
  );
}
