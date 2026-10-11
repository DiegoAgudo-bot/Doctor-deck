"use client";

import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import type { GroupDTO, GroupDeckDTO, GroupSummaryDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { IconPlus, IconTrash } from "./icons";
import { Banner, Dialog } from "./ui";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Un jugador tal y como llega del contador de vidas o de la mesa: solo un nombre. */
export interface SeatInput {
  name: string;
  winner?: boolean;
}

interface Row {
  /** "@usuario" (de Deck Doctor) o "" = invitado. */
  who: string;
  guestName: string;
  deckId: string;
  deckName: string;
  winner: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Registrar una partida: en un grupo (los jugadores con cuenta son sus miembros, cada uno con
 * sus mazos) o suelta (yo y los demás como invitados). Los nombres que coinciden con un miembro
 * (`ana` o `@ana`) se emparejan solos.
 */
export function RecordGameDialog({
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
  const [groups, setGroups] = useState<GroupSummaryDTO[] | null>(null);
  const [groupId, setGroupId] = useState<string>(fixedGroup ?? "");
  const [group, setGroup] = useState<GroupDTO | null>(null);
  const [decks, setDecks] = useState<GroupDeckDTO[]>([]);
  const [myDecks, setMyDecks] = useState<SavedDeckSummaryDTO[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(today());
  const [turns, setTurns] = useState<string>(initialTurns ? String(initialTurns) : "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Al abrir: mis grupos y mis mazos.
  useEffect(() => {
    if (!open) return;
    api<GroupSummaryDTO[]>("/api/groups", undefined, { silent: true })
      .then(setGroups)
      .catch(() => setGroups([]));
    api<SavedDeckSummaryDTO[]>("/api/decks", undefined, { silent: true })
      .then(setMyDecks)
      .catch(() => setMyDecks([]));
  }, [open]);

  // Del grupo elegido: miembros y mazos.
  useEffect(() => {
    if (!open || !groupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sin grupo no hay miembros
      setGroup(null);
      setDecks([]);
      return;
    }
    Promise.all([
      api<GroupDTO>(`/api/groups/${groupId}`),
      api<GroupDeckDTO[]>(`/api/groups/${groupId}/decks`),
    ])
      .then(([g, d]) => {
        setGroup(g);
        setDecks(d);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudo cargar"));
  }, [open, groupId]);

  // Filas iniciales a partir de los asientos del contador (o yo + un invitado).
  useEffect(() => {
    if (!open) return;
    const members = new Set(group?.members.map((m) => m.username?.toLowerCase()) ?? []);
    if (me) members.add(me.toLowerCase());
    const base: SeatInput[] = seats.length ? seats : [{ name: me ? `@${me}` : "" }, { name: "" }];
    const rows = base.map((s) => {
      const u = s.name.replace(/^@/, "").trim().toLowerCase();
      const isUser = u !== "" && members.has(u) && (groupId !== "" || u === me?.toLowerCase());
      return {
        who: isUser ? `@${u}` : "",
        guestName: isUser ? "" : s.name,
        deckId: "",
        deckName: "",
        winner: !!s.winner,
      };
    });
    // Sin grupo tengo que estar entre los jugadores: si ningún nombre es el mío, el primer asiento.
    if (!groupId && me && rows[0] && !rows.some((r) => r.who)) {
      rows[0] = { ...rows[0], who: `@${me.toLowerCase()}`, guestName: "" };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se rehacen al abrir o cambiar de grupo
    setRows(rows);
  }, [open, group, groupId, seats, me]);

  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const deckOptions = (who: string) => {
    const u = who.replace(/^@/, "");
    if (!u) return [];
    if (group) return decks.filter((d) => d.owner.username === u);
    return u === me ? myDecks : [];
  };
  const people = group
    ? group.members.flatMap((m) => (m.username ? [m.username] : []))
    : me
      ? [me]
      : [];

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/games", {
        method: "POST",
        ...json({
          groupId: groupId || undefined,
          playedAt: new Date(`${date}T12:00:00`).toISOString(),
          turns: turns ? Number(turns) : undefined,
          notes: notes || undefined,
          players: rows.map((r) => ({
            ...(r.who ? { username: r.who } : { guestName: r.guestName }),
            ...(r.deckId ? { deckId: r.deckId } : r.deckName ? { deckName: r.deckName } : {}),
            winner: r.winner,
          })),
        }),
      });
      onSaved(id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la partida");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar partida"
      width={640}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || rows.length < 2}
            onClick={() => void save()}
          >
            {busy ? "Guardando…" : "Guardar partida"}
          </button>
        </>
      }
    >
      {error && <Banner tone="out">{error}</Banner>}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <label className="field sm:col-span-1">
          <span className="label">Grupo</span>
          <select
            className="select"
            value={groupId}
            disabled={fixedGroup !== null}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Sin grupo</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Fecha</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">Turnos</span>
          <input
            className="input"
            inputMode="numeric"
            placeholder="—"
            value={turns}
            onChange={(e) => setTurns(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </label>
      </div>
      {!groupId && (
        <p className="subtle text-xs">
          Sin grupo, los demás van como invitados. En un grupo puedes elegir a sus miembros y sus
          mazos, y la partida cuenta para la clasificación.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const options = deckOptions(r.who);
          return (
            <div key={i} className={`gamerow ${r.winner ? "is-winner" : ""}`}>
              <button
                type="button"
                className="gamerow-crown"
                aria-pressed={r.winner}
                title={r.winner ? "Ganador" : "Marcar como ganador"}
                onClick={() =>
                  setRows((rs) => rs.map((x, j) => ({ ...x, winner: j === i ? !x.winner : false })))
                }
              >
                ♛
              </button>
              <select
                className="select"
                aria-label="Jugador"
                value={r.who}
                onChange={(e) => set(i, { who: e.target.value, deckId: "" })}
              >
                <option value="">Invitado…</option>
                {people.map((u) => (
                  <option key={u} value={`@${u}`}>
                    @{u}
                  </option>
                ))}
              </select>
              {!r.who && (
                <input
                  className="input"
                  placeholder="Nombre"
                  aria-label="Nombre del invitado"
                  value={r.guestName}
                  maxLength={40}
                  onChange={(e) => set(i, { guestName: e.target.value })}
                />
              )}
              {options.length > 0 ? (
                <select
                  className="select"
                  aria-label="Mazo"
                  value={r.deckId}
                  onChange={(e) => set(i, { deckId: e.target.value })}
                >
                  <option value="">Mazo…</option>
                  {options.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  placeholder="Mazo o comandante"
                  aria-label="Mazo"
                  value={r.deckName}
                  maxLength={80}
                  onChange={(e) => set(i, { deckName: e.target.value })}
                />
              )}
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Quitar jugador"
                disabled={rows.length <= 2}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              >
                <IconTrash size={13} />
              </button>
            </div>
          );
        })}
        {rows.length < 8 && (
          <button
            type="button"
            className="btn btn-ghost self-start"
            onClick={() =>
              setRows((rs) => [
                ...rs,
                { who: "", guestName: "", deckId: "", deckName: "", winner: false },
              ])
            }
          >
            <IconPlus size={13} /> Añadir jugador
          </button>
        )}
      </div>
      <label className="field">
        <span className="label">Notas</span>
        <input
          className="input"
          placeholder="Combo en el turno 6, mesa muy política…"
          value={notes}
          maxLength={300}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
    </Dialog>
  );
}
