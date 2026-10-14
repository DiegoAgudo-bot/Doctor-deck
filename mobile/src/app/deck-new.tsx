import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { CatalogPageDTO } from "@/server/card-dto";
import type { CardDTO, CollectionViewResponse, NewDeckResponse } from "@/server/dto";
import { CardThumb } from "~/components/card-bits";
import { OptionRow } from "~/components/sheet";
import { toast } from "~/components/toast";
import { Banner, Button, Chip, Field, Loading, SearchField, Segmented, T } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { useDebounced } from "~/lib/hooks";
import { takePendingImport } from "~/lib/shared";
import { colors, radius } from "~/lib/theme";

const VISIBILITY = [
  { key: "public", label: "Público" },
  { key: "unlisted", label: "Oculto" },
  { key: "private", label: "Privado" },
] as const;
type Visibility = (typeof VISIBILITY)[number]["key"];

const MODES = [
  {
    key: "average",
    label: "Mazo medio de EDHREC",
    detail: "Lo que más se juega con este comandante",
  },
  {
    key: "owned",
    label: "Con mis cartas",
    detail: "Las recomendadas que tienes libres en tu colección",
  },
  { key: "empty", label: "Vacío", detail: "Solo el comandante, para montarlo tú" },
] as const;
type Mode = (typeof MODES)[number]["key"];

/**
 * Nuevo mazo, como en la web: desde un comandante (mazo medio de EDHREC, con mis cartas o vacío)
 * o pegando la lista / un enlace de Moxfield o Archidekt (también lo compartido desde ManaBox).
 */
export default function DeckNew() {
  const params = useLocalSearchParams<{ name?: string; fromShare?: string; commander?: string }>();
  const [from, setFrom] = useState<"commander" | "list">(params.fromShare ? "list" : "commander");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [name, setName] = useState(params.name ?? "");

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Segmented<"commander" | "list">
        options={[
          { key: "commander", label: "Desde un comandante" },
          { key: "list", label: "Pegar lista o enlace" },
        ]}
        value={from}
        onChange={setFrom}
      />
      {from === "commander" ? (
        <FromCommander
          initialId={params.commander}
          name={name}
          setName={setName}
          visibility={visibility}
          setVisibility={setVisibility}
        />
      ) : (
        <FromList
          fromShare={Boolean(params.fromShare)}
          name={name}
          setName={setName}
          visibility={visibility}
          setVisibility={setVisibility}
        />
      )}
    </ScrollView>
  );
}

interface Common {
  name: string;
  setName: (v: string) => void;
  visibility: Visibility;
  setVisibility: (v: Visibility) => void;
}

function NameAndVisibility({ name, setName, visibility, setVisibility }: Common) {
  return (
    <>
      <Field
        label="Nombre (opcional)"
        value={name}
        onChangeText={setName}
        placeholder="Se propone solo"
      />
      <T variant="label">Quién lo ve</T>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {VISIBILITY.map((v) => (
          <Chip
            key={v.key}
            label={v.label}
            active={visibility === v.key}
            onPress={() => setVisibility(v.key)}
          />
        ))}
      </View>
    </>
  );
}

function useOpenNewDeck() {
  const qc = useQueryClient();
  return (id: string, tab?: string) => {
    tapFeedback();
    qc.invalidateQueries({ queryKey: ["decks"] });
    router.replace(`/deck/${id}${tab ? `?tab=${tab}` : ""}`);
  };
}

function FromCommander({ initialId, ...common }: Common & { initialId?: string | undefined }) {
  const [commander, setCommander] = useState<CardDTO | null>(null);
  const [mode, setMode] = useState<Mode>("average");
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const open = useOpenNewDeck();

  // Desde la ficha de una carta («Crear un mazo con ella»).
  const initial = useQuery({
    queryKey: ["card", initialId],
    enabled: Boolean(initialId) && !commander,
    queryFn: () => api<{ card: CardDTO }>(`/api/cards/${initialId}`),
  });
  const chosen = commander ?? (initialId ? (initial.data?.card ?? null) : null);

  const results = useQuery({
    queryKey: ["catalog", "commander", query],
    enabled: !chosen && query.length > 1,
    queryFn: () =>
      api<CatalogPageDTO>(`/api/cards?commander=1&q=${encodeURIComponent(query)}&limit=20`),
  });
  // Atajo: mis cartas que pueden ser comandante.
  const mine = useQuery({
    queryKey: ["collection", "commanders"],
    enabled: !chosen,
    queryFn: () =>
      api<CollectionViewResponse>("/api/collection/view", {
        body: { filters: { commander: true }, by: "card", sort: "valor", offset: 0, limit: 12 },
      }),
  });
  const hasCollection = (mine.data?.overall.cards ?? 0) > 0;

  const create = useMutation({
    mutationFn: () =>
      api<NewDeckResponse>("/api/decks/new", {
        body: {
          commanderIds: [chosen!.oracleId],
          mode,
          visibility: common.visibility,
          ...(common.name.trim() ? { name: common.name.trim() } : {}),
        },
      }),
    onSuccess: (r) => {
      if (!r.id) return;
      if (r.warning) toast(r.warning);
      open(r.id, mode === "average" ? undefined : "list");
    },
  });

  if (initialId && !commander && initial.isPending) return <Loading />;

  if (!chosen) {
    const list = query.length > 1 ? (results.data?.items ?? []) : [];
    return (
      <View style={{ gap: 12 }}>
        <SearchField
          placeholder="Busca el comandante"
          value={q}
          onChangeText={setQ}
          onClear={() => setQ("")}
          autoFocus
        />
        {query.length > 1 ? (
          results.isPending ? (
            <Loading />
          ) : list.length === 0 ? (
            <T variant="muted">Ningún comandante se llama así.</T>
          ) : (
            list.map((c) => (
              <CommanderRow key={c.oracleId} card={c} onPress={() => setCommander(c)} />
            ))
          )
        ) : (
          (mine.data?.items.length ?? 0) > 0 && (
            <View style={{ gap: 8 }}>
              <T variant="label">De tu colección</T>
              {mine.data!.items.map((c) => (
                <CommanderRow key={c.key} card={c.card} onPress={() => setCommander(c.card)} />
              ))}
            </View>
          )
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.panel,
          borderRadius: radius.md,
          padding: 10,
        }}
      >
        <CardThumb uri={chosen.imageUrl} width={48} name={chosen.name} />
        <View style={{ flex: 1 }}>
          <T variant="small">Comandante</T>
          <T style={{ fontWeight: "700" }} numberOfLines={2}>
            {chosen.name}
          </T>
        </View>
        <Button
          label="Cambiar"
          kind="ghost"
          onPress={() => {
            setCommander(null);
            if (initialId) router.setParams({ commander: "" });
          }}
        />
      </View>
      <T variant="label">Cómo empezarlo</T>
      <View style={{ gap: 2 }}>
        {MODES.filter((m) => m.key !== "owned" || hasCollection || mine.isPending).map((m) => (
          <OptionRow
            key={m.key}
            label={m.label}
            detail={m.detail}
            selected={mode === m.key}
            onPress={() => setMode(m.key)}
          />
        ))}
      </View>
      <NameAndVisibility {...common} />
      {create.error && <Banner text={create.error.message} />}
      <Button
        label="Crear mazo"
        icon="add"
        onPress={() => create.mutate()}
        busy={create.isPending}
      />
      {create.isPending && mode !== "empty" && (
        <T variant="small" style={{ textAlign: "center" }}>
          Pidiendo a EDHREC lo que se juega con {chosen.name}…
        </T>
      )}
    </View>
  );
}

function CommanderRow({ card, onPress }: { card: CardDTO; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 8,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.hover : colors.panel,
      })}
    >
      <CardThumb uri={card.imageUrl} width={40} name={card.name} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: "600" }} numberOfLines={1}>
          {card.name}
        </T>
        <T variant="small" numberOfLines={1}>
          {card.typeLine}
        </T>
      </View>
    </Pressable>
  );
}

function FromList({ fromShare, ...common }: Common & { fromShare: boolean }) {
  const [input, setInput] = useState(() => (fromShare ? (takePendingImport()?.text ?? "") : ""));
  const open = useOpenNewDeck();
  const save = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/decks", {
        body: {
          input: input.trim(),
          visibility: common.visibility,
          ...(common.name.trim() ? { name: common.name.trim() } : {}),
        },
      }),
    onSuccess: (deck) => open(deck.id),
  });

  return (
    <View style={{ gap: 14 }}>
      <T variant="muted">
        Pega la lista (como la exporta ManaBox, Moxfield o Archidekt) o el enlace del mazo. El
        comandante va en una sección «Commander» o marcado con *CMDR*.
      </T>
      {save.error && <Banner text={save.error.message} />}
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
        accessibilityLabel="Lista o enlace"
        style={{
          minHeight: 200,
          backgroundColor: colors.raised,
          color: colors.text,
          borderRadius: radius.md,
          padding: 12,
          fontSize: 14,
          fontFamily: "monospace",
        }}
      />
      <NameAndVisibility {...common} />
      <Button
        label="Guardar mazo"
        onPress={() => save.mutate()}
        busy={save.isPending}
        disabled={!input.trim()}
      />
    </View>
  );
}
