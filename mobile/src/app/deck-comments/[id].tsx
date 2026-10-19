import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CommentDTO, DeckCommentsDTO } from "@/server/social-dto";
import { Avatar, SwitchRow } from "~/components/social";
import { toast } from "~/components/toast";
import { Banner, Empty, ErrorView, IconButton, Loading, T, styles } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { ago } from "~/lib/format";
import { colors } from "~/lib/theme";
import { alert } from "~/components/dialog";

const REASONS = [
  { reason: "spam", label: "Spam" },
  { reason: "abuse", label: "Insultos o acoso" },
  { reason: "other", label: "Otro motivo" },
] as const;

/** Comentarios de un mazo público u oculto: leer, escribir, borrar, denunciar y cerrarlos. */
export default function DeckComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const comments = useQuery({
    queryKey: ["comments", id],
    queryFn: () => api<DeckCommentsDTO>(`/api/decks/${id}/comments`),
  });
  const set = (v: DeckCommentsDTO) => qc.setQueryData(["comments", id], v);

  const post = useMutation({
    mutationFn: () => api<DeckCommentsDTO>(`/api/decks/${id}/comments`, { body: { body: text } }),
    onSuccess: (v) => {
      tapFeedback();
      setText("");
      set(v);
    },
  });
  const toggleOpen = useMutation({
    mutationFn: (open: boolean) =>
      api<DeckCommentsDTO>(`/api/decks/${id}/comments`, { method: "PATCH", body: { open } }),
    onSuccess: set,
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: (c: CommentDTO) => api(`/api/comments/${c.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Comentario borrado");
      comments.refetch();
    },
    onError: (e) => toast(e.message),
  });
  const report = useMutation({
    mutationFn: ({ c, reason }: { c: CommentDTO; reason: string }) =>
      api<{ hidden: boolean }>(`/api/comments/${c.id}/report`, { body: { reason } }),
    onSuccess: (r) => {
      toast(
        r.hidden
          ? "Denunciado: el comentario queda oculto hasta revisarlo"
          : "Gracias, lo revisaremos",
      );
      comments.refetch();
    },
    onError: (e) => toast(e.message),
  });

  if (comments.isPending) return <Loading />;
  if (comments.isError)
    return <ErrorView error={comments.error} onRetry={() => comments.refetch()} />;
  const v = comments.data;

  const menu = (c: CommentDTO) =>
    alert("Comentario", undefined, [
      ...(c.canDelete
        ? [{ text: "Borrar", style: "destructive" as const, onPress: () => remove.mutate(c) }]
        : []),
      ...(!c.mine
        ? REASONS.map((r) => ({
            text: `Denunciar: ${r.label}`,
            onPress: () => report.mutate({ c, reason: r.reason }),
          }))
        : []),
      { text: "Cancelar", style: "cancel" as const },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: `Comentarios · ${v.comments.length}` }} />
      <FlatList
        data={v.comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          v.isOwner ? (
            <SwitchRow
              label="Comentarios abiertos"
              detail="Si los cierras, nadie más puede comentar (los de antes se quedan)."
              value={v.open}
              disabled={toggleOpen.isPending}
              onChange={(o) => toggleOpen.mutate(o)}
            />
          ) : null
        }
        ListEmptyComponent={
          <Empty
            icon="chatbubbles-outline"
            title="Sin comentarios"
            text="Sé el primero en opinar."
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={({ item: c }) => (
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              padding: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              opacity: c.hidden ? 0.6 : 1,
            }}
          >
            <Avatar name={c.author.name} image={c.author.image} size={32} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="small">
                <T variant="small" style={{ fontWeight: "700", color: colors.text }}>
                  {c.author.username ? `@${c.author.username}` : c.author.name}
                </T>{" "}
                · {ago(c.createdAt)}
                {c.hidden ? " · oculto por denuncias" : ""}
              </T>
              <T>{c.body}</T>
            </View>
            {(c.canDelete || !c.mine) && (
              <IconButton
                icon="ellipsis-vertical"
                size={18}
                color={colors.text3}
                label="Opciones del comentario"
                onPress={() => menu(c)}
              />
            )}
          </View>
        )}
      />
      {post.isError && (
        <View style={{ paddingHorizontal: 16 }}>
          <Banner text={post.error.message} />
        </View>
      )}
      {v.canComment ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 10,
            paddingBottom: insets.bottom + 10,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.panel,
          }}
        >
          <TextInput
            style={[
              styles.field,
              { flex: 1, height: undefined, minHeight: 44, maxHeight: 120, paddingVertical: 10 },
            ]}
            placeholder="Escribe un comentario…"
            placeholderTextColor={colors.text3}
            value={text}
            onChangeText={setText}
            maxLength={1000}
            multiline
          />
          <IconButton
            icon="send"
            label="Enviar"
            color={text.trim() ? colors.accent : colors.text3}
            onPress={() => text.trim() && !post.isPending && post.mutate()}
          />
        </View>
      ) : (
        <T
          variant="small"
          style={{ padding: 16, paddingBottom: insets.bottom + 16, textAlign: "center" }}
        >
          {v.open ? "No puedes comentar en este mazo." : "Los comentarios están cerrados."}
        </T>
      )}
    </KeyboardAvoidingView>
  );
}
