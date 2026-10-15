import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { CommanderStaplesDTO, StapleDTO } from "@/server/card-dto";
import { CardThumb } from "~/components/card-bits";
import { Banner, Chip, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { euros, thousands } from "~/lib/format";
import { colors, radius } from "~/lib/theme";

type Show = "all" | "owned" | "missing";

const TILE = 108;
const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));

/**
 * En la ficha de un comandante: lo que juega la comunidad con él (`GET
 * /api/cards/{oracleId}/edhrec`), por listas (alta sinergia, las más jugadas, criaturas…), con
 * temas, precio y mis copias. Como `CommanderStaples` de la web; cada lista va en una fila que se
 * desliza de lado.
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
    placeholderData: (prev) => prev,
    staleTime: 10 * 60_000,
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
  // `mine` solo llega con sesión: sin ninguna carta con datos no se ofrece el filtro.
  const hasMine = data?.sections.some((s) => s.cards.some((c) => c.mine !== null)) ?? false;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T variant="label">Lo que se juega con {short}</T>
        {data?.totalDecks ? (
          <T variant="small">En {thousands(data.totalDecks)} mazos de la comunidad</T>
        ) : null}
      </View>

      {data && data.themes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          <Chip label="General" active={theme === ""} onPress={() => setTheme("")} />
          {data.themes.slice(0, 10).map((t) => (
            <Chip
              key={t.slug}
              label={t.count !== null ? `${t.name} · ${thousands(t.count)}` : t.name}
              active={theme === t.slug}
              onPress={() => setTheme(t.slug)}
            />
          ))}
        </ScrollView>
      )}

      {hasMine && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Chip label="Todas" active={show === "all"} onPress={() => setShow("all")} />
          <Chip label="Las tengo" active={show === "owned"} onPress={() => setShow("owned")} />
          <Chip label="Me faltan" active={show === "missing"} onPress={() => setShow("missing")} />
        </View>
      )}

      {q.isError && (
        <Banner text={q.error.message || "No se pudo cargar lo que se juega con este comandante"} />
      )}
      {data?.warning && <Banner text={data.warning} />}
      {q.isPending && <Loading label="Buscando lo que se juega…" />}

      {data && (
        <View style={{ gap: 14, opacity: q.isFetching && q.isPlaceholderData ? 0.5 : 1 }}>
          {sections.length === 0 && (
            <T variant="small">No hay cartas que enseñar con este filtro.</T>
          )}
          {sections.map((s) => (
            <View key={s.key} style={{ gap: 6 }}>
              <T style={{ fontWeight: "600" }}>
                {s.label} <T variant="small">{s.cards.length}</T>
              </T>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {s.cards.map((c) => (
                  <StapleTile key={c.card.oracleId} s={c} />
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StapleTile({ s }: { s: StapleDTO }) {
  const inc = pct(s.inclusion);
  const syn = pct(s.synergy);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.card.name}
      onPress={() => router.push(`/card/${s.card.oracleId}`)}
      style={({ pressed }) => ({ width: TILE, gap: 3, opacity: pressed ? 0.75 : 1 })}
    >
      <View>
        <CardThumb uri={s.card.imageUrl} width={TILE} name={s.card.name} />
        {s.mine && (
          <View
            style={{
              position: "absolute",
              left: 4,
              bottom: 4,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: radius.sm,
              backgroundColor: s.mine.free > 0 ? colors.owned : colors.inuse,
            }}
          >
            <T variant="small" style={{ color: colors.bg, fontWeight: "700", fontSize: 11 }}>
              {s.mine.free > 0 ? "La tienes" : "En tus mazos"}
            </T>
          </View>
        )}
      </View>
      <T variant="small" numberOfLines={1} style={{ color: colors.text }}>
        {s.card.name}
      </T>
      {inc !== null && (
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.raised }}>
          <View
            style={{ width: `${inc}%`, height: 4, borderRadius: 2, backgroundColor: colors.accent }}
          />
        </View>
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T variant="small" style={{ fontSize: 11 }}>
          {inc !== null ? `${inc} %` : ""}
          {syn !== null ? ` · ${syn > 0 ? "+" : ""}${syn}` : ""}
        </T>
        <T variant="mono" style={{ fontSize: 11 }}>
          {euros(s.price)}
        </T>
      </View>
    </Pressable>
  );
}
