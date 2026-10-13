import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native";
import { Banner, Button, Chip, Field, T } from "~/components/ui";
import { api } from "~/lib/api";
import { takePendingImport } from "~/lib/shared";
import { colors, radius } from "~/lib/theme";

const VISIBILITY = [
  { key: "public", label: "Público" },
  { key: "unlisted", label: "Oculto" },
  { key: "private", label: "Privado" },
] as const;

/** Nuevo mazo: pegar la lista (o un enlace de Moxfield/Archidekt) y guardarlo. */
export default function DeckNew() {
  const params = useLocalSearchParams<{ name?: string; fromShare?: string }>();
  const [input, setInput] = useState(() =>
    params.fromShare ? (takePendingImport()?.text ?? "") : "",
  );
  const [name, setName] = useState(params.name ?? "");
  const [visibility, setVisibility] = useState<(typeof VISIBILITY)[number]["key"]>("public");
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/decks", {
        body: { input: input.trim(), visibility, ...(name.trim() ? { name: name.trim() } : {}) },
      }),
    onSuccess: (deck) => {
      qc.invalidateQueries({ queryKey: ["decks"] });
      router.replace(`/deck/${deck.id}`);
    },
  });

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <T variant="muted">
        Pega la lista (como la exporta ManaBox, Moxfield o Archidekt) o el enlace del mazo. El
        comandante va en una sección «Commander» o marcado con *CMDR*.
      </T>
      {save.error && <Banner text={save.error.message} />}
      <Field
        label="Nombre (opcional)"
        value={name}
        onChangeText={setName}
        placeholder="Se propone solo"
      />
      <T variant="label">Lista o enlace</T>
      <TextInput
        multiline
        value={input}
        onChangeText={setInput}
        placeholder={"Commander\n1 Bilbo, Thief in the Night\n\nDeck\n1 Sol Ring\n…"}
        placeholderTextColor={colors.text3}
        autoCapitalize="none"
        autoCorrect={false}
        textAlignVertical="top"
        style={{
          minHeight: 220,
          backgroundColor: colors.raised,
          color: colors.text,
          borderRadius: radius.md,
          padding: 12,
          fontSize: 14,
          fontFamily: "monospace",
        }}
      />
      <T variant="label">Quién lo ve</T>
      <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
        {VISIBILITY.map((v) => (
          <Chip
            key={v.key}
            label={v.label}
            active={visibility === v.key}
            onPress={() => setVisibility(v.key)}
          />
        ))}
      </ScrollView>
      <Button
        label="Guardar mazo"
        onPress={() => save.mutate()}
        busy={save.isPending}
        disabled={!input.trim()}
      />
    </ScrollView>
  );
}
