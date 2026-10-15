import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import type { CommanderStaplesDTO, StapleDTO } from "@/server/card-dto";
import { CardThumb } from "~/components/card-bits";
import { Banner, Chip, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { euros, thousands } from "~/lib/format";
import { colors, radius } from "~/lib/theme";

type Show = "all" | "owned" | "missing";

const TILE = 112;
const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));

/**
 * En la ficha de un comandante, como en la web: lo que juega la comunidad con él, por listas
 * (alta sinergia, las más jugadas, criaturas, instantáneos…), cada una en una fila que se
 * desliza, con temas, % de mazos, sinergia, precio y si la tengo.
 */
export function CommanderStaples({ oracleId, name }: { oracleId: string; name: string }) {
  const [theme, setTheme] = useState("");
  const [show, setShow] = useState<Show>("all");
  const q = useQuery({
    queryKey: ["staples", oracleId, theme],
    queryFn: () =>
      api<CommanderStaplesDTO>(
        `/api/cards/${encodeURIComponent(oracleId)}/edhrec${theme ? `?theme=${theme}` : ""}`,
      ),
    staleTime: 60 * 60_000,
    placeholderData: (prev) => prev,
  });
  const data = q.data;
  const sections = useMemo(
    () =>
      (data?.sections ?? [])
        .map((s) => ({
          ...s,
          cards: s.cards.filter((c) =>
            show === "owned" ? c.mine !== null : show === "missing" ? c.mine === null : true,
          ),
        }))
        .filter((s) => s.cards.length > 0),
    [data, show],
  );
  const short = name.split(",")[0] ?? name;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T variant="h2">Lo que se juega con {short}</T>
        {data?.totalDecks ? (
          <T variant="small">En {thousands(data.totalDecks)} mazos de la comunidad</T>
        ) : null}
      </View>

      {data && data.themes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip label="General" active={theme === ""} onPress={() => setTheme("")} />
            {data.themes.slice(0, 12).map((t) => (
              <Chip
                key={t.slug}
                label={t.count !== null ? `${t.name} · ${thousands(t.count)}` : t.name}
                active={theme === t.slug}
                onPress={() => setTheme(t.slug)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {data && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Chip label="Todas" active={show === "all"} onPress={() => setShow("all")} />
          <Chip label="Las tengo" active={show === "owned"} onPress={() => setShow("owned")} />
          <Chip label="Me faltan" active={show === "missing"} onPress={() => setShow("missing")} />
        </View>
      )}

      {q.isError && <Banner text={q.error.message} />}
      {data?.warning && <Banner text={data.warning} />}
      {q.isPending && <Loading label="Buscando lo que se juega…" />}
      {data && sections.length === 0 && (
        <T variant="muted">No hay cartas que enseñar con este filtro.</T>
      )}

      <View style={{ gap: 14, opacity: q.isFetching && q.isPlaceholderData ? 0.5 : 1 }}>
        {sections.map((s) => (
          <View key={s.key} style={{ gap: 6 }}>
            <T variant="label">
              {s.label} · {s.cards.length}
            </T>
            <FlatList
              horizontal
              data={s.cards}
              keyExtractor={(c) => c.card.oracleId}
              renderItem={({ item }) => <StapleTile s={item} />}
              ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
              showsHorizontalScrollIndicator={false}
              initialNumToRender={4}
              windowSize={3}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function StapleTile({ s }: { s: StapleDTO }) {
  const inc = pct(s.inclusion);
  const syn = pct(s.synergy);
  return (
    <Pressable
      onPress={() => router.push(`/card/${s.card.oracleId}`)}
      accessibilityRole="button"
      accessibilityLabel={s.card.name}
      style={({ pressed }) => ({ width: TILE, gap: 3, opacity: pressed ? 0.75 : 1 })}
    >
      <View>
        <CardThumb uri={s.card.imageUrl} width={TILE} name={s.card.name} />
        {s.mine && (
          <View
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: radius.sm,
              backgroundColor: s.mine.free > 0 ? colors.owned : colors.inuse,
            }}
          >
            <T variant="small" style={{ color: colors.onAccent, fontWeight: "700", fontSize: 11 }}>
              {s.mine.free > 0 ? "La tienes" : "En tus mazos"}
            </T>
          </View>
        )}
      </View>
      <T numberOfLines={1} style={{ fontSize: 13, fontWeight: "600" }}>
        {s.card.name}
      </T>
      {inc !== null && <T variant="small">{inc} % de mazos</T>}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T
          variant="small"
          style={{
            color:
              syn === null
                ? colors.text3
                : syn > 0
                  ? colors.in
                  : syn < 0
                    ? colors.out
                    : colors.text3,
          }}
        >
          {syn === null ? "" : `${syn > 0 ? "+" : ""}${syn} %`}
        </T>
        <T variant="mono" style={{ fontSize: 12 }}>
          {euros(s.price)}
        </T>
      </View>
    </Pressable>
  );
}
