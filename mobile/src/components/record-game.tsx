import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import type { GroupDTO, GroupDeckDTO, GroupSummaryDTO } from "@/server/social-dto";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { colors, radius } from "~/lib/theme";
import { Sheet } from "./sheet";
import { toast } from "./toast";
import { Banner, Button, Chip, Field, IconButton, T, styles } from "./ui";

/** Un jugador tal y como llega del contador de vidas: solo un nombre (y si ganó). */
export interface SeatInput {
  name: string;
  winner?: boolean;
}

interface Row {
  /** Usuario de Doctor Deck (sin @) o "" = invitado. */
  who: string;
  guestName: string;
  deckId: string;
  deckName: string;
  winner: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyRow = (): Row => ({ who: "", guestName: "", deckId: "", deckName: "", winner: false });

/**
 * Registrar una partida (como el diálogo de la web): en un grupo (los jugadores con cuenta son
 * sus miembros, cada uno con sus mazos) o suelta (yo y los demás como invitados). Los nombres que
 * coinciden con un miembro (`ana` o `@ana`) se emparejan solos.
 */
export function RecordGameSheet({
  open,
  onClose,
  onSaved,
  groupId: fixedGroup = null,
  seats = [],
  turns: initialTurns = null,
  me,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  groupId?: string | null;
  seats?: SeatInput[];
  turns?: number | null;
  /** Mi nombre de usuario (sin grupo soy el único con cuenta). */
  me: string | null;
}) {
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState<string>(fixedGroup ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(today());
  const [turns, setTurns] = useState(initialTurns ? String(initialTurns) : "");
  const [notes, setNotes] = useState("");

  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<GroupSummaryDTO[]>("/api/groups"),
    enabled: open,
  });
  const myDecks = useQuery({
    queryKey: ["decks"],
    queryFn: () => api<SavedDeckSummaryDTO[]>("/api/decks"),
    enabled: open,
  });
  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api<GroupDTO>(`/api/groups/${groupId}`),
    enabled: open && groupId !== "",
  });
  const groupDecks = useQuery({
    queryKey: ["group-decks", groupId],
    queryFn: () => api<GroupDeckDTO[]>(`/api/groups/${groupId}/decks`),
    enabled: open && groupId !== "",
  });
  const g = groupId ? (group.data ?? null) : null;

  // Filas iniciales a partir de los asientos del contador (o yo + un invitado).
  useEffect(() => {
    if (!open) return;
    const members = new Set(g?.members.map((m) => m.username?.toLowerCase()) ?? []);
    if (me) members.add(me.toLowerCase());
    const base: SeatInput[] = seats.length ? seats : [{ name: me ? `@${me}` : "" }, { name: "" }];
    const next = base.map((s) => {
      const u = s.name.replace(/^@/, "").trim().toLowerCase();
      const isUser = u !== "" && members.has(u) && (groupId !== "" || u === me?.toLowerCase());
      return {
        ...emptyRow(),
        who: isUser ? u : "",
        guestName: isUser ? "" : s.name,
        winner: !!s.winner,
      };
    });
    // Sin grupo tengo que estar entre los jugadores: si ningún nombre es el mío, el primer asiento.
    if (!groupId && me && next[0] && !next.some((r) => r.who)) {
      next[0] = { ...next[0], who: me.toLowerCase(), guestName: "" };
    }
    setRows(next);
    // `seats` llega nuevo en cada render del padre: solo cuenta al abrir o cambiar de grupo.
  }, [open, g, groupId, me]);

  useEffect(() => {
    if (open) setTurns(initialTurns ? String(initialTurns) : "");
  }, [open, initialTurns]);

  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const deckOptions = (who: string): { id: string; name: string }[] => {
    if (!who) return [];
    if (g) return (groupDecks.data ?? []).filter((d) => d.owner.username === who);
    return who === me ? (myDecks.data ?? []) : [];
  };
  const people = g ? g.members.flatMap((m) => (m.username ? [m.username] : [])) : me ? [me] : [];

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
  const save = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/games", {
        body: {
          ...(groupId ? { groupId } : {}),
          playedAt: new Date(`${date}T12:00:00`).toISOString(),
          ...(turns ? { turns: Number(turns) } : {}),
          ...(notes ? { notes } : {}),
          players: rows.map((r) => ({
            ...(r.who ? { username: r.who } : { guestName: r.guestName }),
            ...(r.deckId ? { deckId: r.deckId } : r.deckName ? { deckName: r.deckName } : {}),
            winner: r.winner,
          })),
        },
      }),
    onSuccess: ({ id }) => {
      tapFeedback();
      toast("Partida registrada");
      qc.invalidateQueries({ queryKey: ["games"] });
      qc.invalidateQueries({ queryKey: ["group"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      onSaved(id);
    },
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar partida"
      footer={
        <Button
          label="Guardar partida"
          icon="trophy-outline"
          busy={save.isPending}
          disabled={rows.length < 2 || !validDate}
          onPress={() => save.mutate()}
        />
      }
    >
      {save.isError && <Banner text={save.error.message} />}
      {fixedGroup === null && (groups.data?.length ?? 0) > 0 && (
        <View style={{ gap: 6 }}>
          <T variant="label">Grupo</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Chip label="Sin grupo" active={groupId === ""} onPress={() => setGroupId("")} />
              {groups.data?.map((x) => (
                <Chip
                  key={x.id}
                  label={x.name}
                  active={groupId === x.id}
                  onPress={() => setGroupId(x.id)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      {!groupId && (
        <T variant="small">
          Sin grupo, los demás van como invitados. En un grupo puedes elegir a sus miembros y sus
          mazos, y la partida cuenta para la clasificación.
        </T>
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 2 }}>
          <Field
            label="Fecha (AAAA-MM-DD)"
            value={date}
            onChangeText={(v) => setDate(v.replace(/[^\d-]/g, "").slice(0, 10))}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Turnos"
            value={turns}
            placeholder="—"
            onChangeText={(v) => setTurns(v.replace(/\D/g, "").slice(0, 2))}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <T variant="label">Jugadores · toca la corona del que ganó</T>
      {rows.map((r, i) => {
        const options = deckOptions(r.who);
        return (
          <View
            key={i}
            style={{
              gap: 8,
              padding: 10,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: r.winner ? colors.warn : colors.line,
              backgroundColor: colors.bg,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={r.winner ? "Ganador" : "Marcar como ganador"}
                accessibilityState={{ selected: r.winner }}
                hitSlop={8}
                onPress={() =>
                  setRows((rs) => rs.map((x, j) => ({ ...x, winner: j === i ? !x.winner : false })))
                }
              >
                <T style={{ fontSize: 22, color: r.winner ? colors.warn : colors.text3 }}>♛</T>
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Chip
                    label="Invitado"
                    active={r.who === ""}
                    onPress={() => set(i, { who: "", deckId: "" })}
                  />
                  {people.map((u) => (
                    <Chip
                      key={u}
                      label={`@${u}`}
                      active={r.who === u}
                      onPress={() => set(i, { who: u, deckId: "" })}
                    />
                  ))}
                </View>
              </ScrollView>
              <IconButton
                icon="trash-outline"
                label="Quitar jugador"
                size={18}
                color={rows.length <= 2 ? colors.lineStrong : colors.text3}
                onPress={() => rows.length > 2 && setRows((rs) => rs.filter((_, j) => j !== i))}
              />
            </View>
            {!r.who && (
              <TextInput
                style={[styles.field, { height: 42, fontSize: 15 }]}
                placeholder="Nombre"
                placeholderTextColor={colors.text3}
                value={r.guestName}
                maxLength={40}
                onChangeText={(v) => set(i, { guestName: v })}
              />
            )}
            {options.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Chip
                    label="Sin mazo"
                    active={!r.deckId}
                    onPress={() => set(i, { deckId: "" })}
                  />
                  {options.map((d) => (
                    <Chip
                      key={d.id}
                      label={d.name}
                      active={r.deckId === d.id}
                      onPress={() => set(i, { deckId: d.id })}
                    />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <TextInput
                style={[styles.field, { height: 42, fontSize: 15 }]}
                placeholder="Mazo o comandante"
                placeholderTextColor={colors.text3}
                value={r.deckName}
                maxLength={80}
                onChangeText={(v) => set(i, { deckName: v })}
              />
            )}
          </View>
        );
      })}
      {rows.length < 8 && (
        <Button
          label="Añadir jugador"
          icon="add"
          kind="ghost"
          onPress={() => setRows((rs) => [...rs, emptyRow()])}
        />
      )}
      <Field
        label="Notas"
        placeholder="Combo en el turno 6, mesa muy política…"
        value={notes}
        maxLength={300}
        onChangeText={setNotes}
      />
    </Sheet>
  );
}
