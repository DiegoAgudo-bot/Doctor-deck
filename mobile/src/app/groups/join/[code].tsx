import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import type { GroupSummaryDTO } from "@/server/social-dto";
import { Meta } from "~/components/social";
import { Banner, Button, Empty, ErrorView, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { t } from "~/lib/i18n";

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
      <Stack.Screen options={{ title: t("Invitación", "Invitation") }} />
      <Empty
        icon="people-outline"
        title={group.name}
        text={
          group.description ||
          t("Te han invitado a este grupo de juego.", "You've been invited to this playgroup.")
        }
        action={
          <View style={{ gap: 12, alignSelf: "stretch", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Meta icon="people-outline" text={`${group.members} ${t("miembros", "members")}`} />
              <Meta icon="trophy-outline" text={`${group.games} ${t("partidas", "games")}`} />
            </View>
            {join.isError && <Banner text={join.error.message} />}
            {member ? (
              <Button
                label={t(
                  "Ya eres miembro: abrir el grupo",
                  "You're already a member: open the group",
                )}
                style={{ alignSelf: "stretch" }}
                onPress={() => router.replace(`/groups/${group.id}`)}
              />
            ) : (
              <>
                <T variant="small" style={{ textAlign: "center" }}>
                  {t(
                    "Los miembros ven los mazos públicos y ocultos de los demás, quién tiene cada carta y las partidas del grupo.",
                    "Members see each other's public and unlisted decks, who owns each card and the group's games.",
                  )}
                </T>
                <Button
                  label={t("Entrar en el grupo", "Join the group")}
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
