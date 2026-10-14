import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import type { GroupSummaryDTO } from "@/server/social-dto";
import { Meta } from "~/components/social";
import { Banner, Button, Empty, ErrorView, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";

/** Entrar en un grupo con su enlace de invitación (`/groups/join/{code}`). */
export default function JoinGroup() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const qc = useQueryClient();
  const preview = useQuery({
    queryKey: ["group-invite", code],
    queryFn: () =>
      api<{ group: GroupSummaryDTO; member: boolean }>(
        `/api/groups/join/${encodeURIComponent(code)}`,
      ),
  });
  const join = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/api/groups/join/${encodeURIComponent(code)}`, { body: {} }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      router.replace(`/groups/${id}`);
    },
  });

  if (preview.isPending) return <Loading />;
  if (preview.isError) return <ErrorView error={preview.error} onRetry={() => preview.refetch()} />;
  const { group, member } = preview.data;
  return (
    <>
      <Stack.Screen options={{ title: "Invitación" }} />
      <Empty
        icon="people-outline"
        title={group.name}
        text={group.description || "Te han invitado a este grupo de juego."}
        action={
          <View style={{ gap: 12, alignSelf: "stretch", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Meta icon="people-outline" text={`${group.members} miembros`} />
              <Meta icon="trophy-outline" text={`${group.games} partidas`} />
            </View>
            {join.isError && <Banner text={join.error.message} />}
            {member ? (
              <Button
                label="Ya eres miembro: abrir el grupo"
                style={{ alignSelf: "stretch" }}
                onPress={() => router.replace(`/groups/${group.id}`)}
              />
            ) : (
              <>
                <T variant="small" style={{ textAlign: "center" }}>
                  Los miembros ven los mazos públicos y ocultos de los demás, quién tiene cada carta
                  y las partidas del grupo.
                </T>
                <Button
                  label="Entrar en el grupo"
                  icon="enter-outline"
                  style={{ alignSelf: "stretch" }}
                  busy={join.isPending}
                  onPress={() => join.mutate()}
                />
              </>
            )}
          </View>
        }
      />
    </>
  );
}
