"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CardDTO, MyProfileDTO } from "@/server/dto";
import type { GroupCardDTO, GroupDTO, GroupDeckDTO, GroupSummaryDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { CardSearch } from "./card-search";
import { DeckTile } from "./deck-tile";
import { Avatar, GameCard, MemberLink, playedOn, Standings } from "./games-ui";
import { IconCopy, IconLink, IconPlus, IconTrash, IconUsers } from "./icons";
import { LendDialog } from "./loans-page";
import { RecordGameDialog } from "./record-game-dialog";
import { ago, Banner, Dialog, EmptyState, fmt, Loading } from "./ui";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** /groups: mis grupos de juego y crear uno. */
export function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<GroupSummaryDTO[]>("/api/groups")
      .then(setGroups)
      .catch((e: unknown) => setError(errorText(e, "No se pudieron cargar tus grupos")));
  }, []);

  async function create() {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/groups", {
        method: "POST",
        ...json({ name, description }),
      });
      router.push(`/groups/${id}`);
    } catch (e) {
      setError(errorText(e, "No se pudo crear el grupo"));
      setBusy(false);
    }
  }

  return (
    <main className="page max-w-[960px]">
      <div className="stack-sm flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <span className="eyebrow">Tu mesa</span>
          <h1 className="h1">Grupos de juego</h1>
          <p className="muted text-[13px]">
            La gente con la que juegas: sus mazos, quién tiene cada carta para dejártela, las
            partidas y la clasificación.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn" href="/play">
            Contador de vidas
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <IconPlus size={14} /> Nuevo grupo
          </button>
        </div>
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {!groups && !error && <Loading>Cargando tus grupos…</Loading>}
      {groups && groups.length === 0 && (
        <div className="panel">
          <EmptyState
            title="Aún no estás en ningún grupo"
            action={
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                Crear un grupo
              </button>
            }
          >
            Crea uno y comparte el enlace de invitación con tus amigos, o pídeles el suyo.
          </EmptyState>
        </div>
      )}
      {groups && groups.length > 0 && (
        <div
          className="grid-1-sm grid gap-2.5"
          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          {groups.map((g, i) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="groupcard fade"
              style={{ ["--d" as string]: `${i * 40}ms` }}
            >
              <span className="groupcard-icon">
                <IconUsers size={20} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <b className="truncate">{g.name}</b>
                <span className="subtle text-xs">
                  {g.members} {g.members === 1 ? "miembro" : "miembros"} · {fmt(g.games)}{" "}
                  {g.games === 1 ? "partida" : "partidas"}
                  {g.lastGameAt ? ` · última ${ago(g.lastGameAt)}` : ""}
                </span>
                {g.description && (
                  <span className="muted truncate text-[13px]">{g.description}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo grupo"
        width={440}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              Crear
            </button>
          </>
        }
      >
        <label className="field">
          <span className="label">Nombre</span>
          <input
            className="input"
            placeholder="Los del jueves"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">Descripción (opcional)</span>
          <input
            className="input"
            placeholder="Commander casual en la tienda, bracket 2–3"
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="subtle text-xs">
          Los miembros ven los mazos públicos y ocultos de los demás y quién tiene cada carta (no la
          colección entera).
        </p>
      </Dialog>
    </main>
  );
}

type Tab = "games" | "members" | "decks" | "cards";
const TABS: [Tab, string][] = [
  ["games", "Partidas"],
  ["cards", "Quién tiene qué"],
  ["decks", "Mazos"],
  ["members", "Miembros"],
];

/** /groups/{id}: un grupo. */
export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const tab = (TABS.find(([t]) => t === search.get("tab"))?.[0] ?? "games") as Tab;
  const [group, setGroup] = useState<GroupDTO | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState(false);
  const [kind, setKind] = useState<"player" | "deck">("player");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api<GroupDTO>(`/api/groups/${id}`)
      .then(setGroup)
      .catch((e: unknown) => setError(errorText(e, "No se pudo cargar el grupo")));
  }, [id]);
  useEffect(() => {
    load();
    api<MyProfileDTO>("/api/me/profile", undefined, { silent: true })
      .then((p) => setMe(p.username))
      .catch(() => undefined);
  }, [load]);

  const setTab = (t: Tab) =>
    router.replace(`/groups/${id}${t === "games" ? "" : `?tab=${t}`}`, { scroll: false });

  if (!group) {
    return (
      <main className="page max-w-[1100px]">
        {error ? <Banner tone="out">{error}</Banner> : <Loading>Cargando el grupo…</Loading>}
      </main>
    );
  }

  const invite =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/groups/join/${group.inviteCode}`;
  async function copyInvite() {
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
        await navigator.share({ title: `Únete a ${group!.name} en Deck Doctor`, url: invite });
      } else {
        await navigator.clipboard.writeText(invite);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelado */
    }
  }
  async function patch(body: Record<string, unknown>) {
    try {
      setGroup(await api<GroupDTO>(`/api/groups/${id}`, { method: "PATCH", ...json(body) }));
    } catch (e) {
      setError(errorText(e, "No se pudo guardar"));
    }
  }
  async function remove(username: string) {
    try {
      await api(`/api/groups/${id}/members/${username}`, { method: "DELETE" });
      if (username === me) router.push("/groups");
      else load();
    } catch (e) {
      setError(errorText(e, "No se pudo quitar"));
    }
  }

  const leader = group.stats.players[0];
  return (
    <main className="page max-w-[1100px]">
      <section className="grouphero">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link className="subtle text-[13px]" href="/groups">
            ← Grupos
          </Link>
          <h1 className="h1">{group.name}</h1>
          {group.description && <p className="muted text-[13.5px]">{group.description}</p>}
          <div className="grouphero-stats">
            <span>
              <b>{group.members.length}</b> {group.members.length === 1 ? "miembro" : "miembros"}
            </span>
            <span>
              <b>{fmt(group.stats.games)}</b> {group.stats.games === 1 ? "partida" : "partidas"}
            </span>
            {leader && leader.wins > 0 && (
              <span>
                ♛ Lidera <b>{leader.name}</b>
              </span>
            )}
          </div>
          <div className="avatarstack" aria-label="Miembros">
            {group.members.slice(0, 8).map((m) => (
              <Avatar key={m.username ?? m.name} m={m} size={30} />
            ))}
            {group.members.length > 8 && (
              <span className="subtle text-xs">+{group.members.length - 8}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button type="button" className="btn btn-primary" onClick={() => setRecord(true)}>
            <IconPlus size={14} /> Registrar partida
          </button>
          <Link className="btn" href="/play">
            Contador de vidas
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => void copyInvite()}>
            {copied ? (
              "¡Enlace copiado!"
            ) : (
              <>
                <IconLink size={14} /> Invitar
              </>
            )}
          </button>
        </div>
      </section>

      {error && <Banner tone="out">{error}</Banner>}

      <nav className="tabs" aria-label="Secciones del grupo">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "is-active" : ""}
            onClick={() => setTab(t)}
          >
            {label}
            {t === "members" && <span className="n">{group.members.length}</span>}
            {t === "games" && <span className="n">{group.stats.games}</span>}
          </button>
        ))}
      </nav>

      {tab === "games" && (
        <div
          className="grid-1-sm grid gap-4"
          style={{ gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)" }}
        >
          <section className="panel flex flex-col gap-3 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="h2">Clasificación</h2>
              <div className="chips">
                <button
                  type="button"
                  className={`chipbtn ${kind === "player" ? "is-on" : ""}`}
                  onClick={() => setKind("player")}
                >
                  Jugadores
                </button>
                <button
                  type="button"
                  className={`chipbtn ${kind === "deck" ? "is-on" : ""}`}
                  onClick={() => setKind("deck")}
                >
                  Mazos
                </button>
              </div>
            </div>
            <Standings
              rows={kind === "player" ? group.stats.players : group.stats.decks}
              kind={kind}
              empty="Aún no hay partidas. Registra la primera desde aquí o desde el contador de vidas."
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="h2">Últimas partidas</h2>
            {group.stats.recent.length === 0 ? (
              <div className="panel">
                <EmptyState
                  title="Sin partidas"
                  action={
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setRecord(true)}
                    >
                      Registrar partida
                    </button>
                  }
                />
              </div>
            ) : (
              group.stats.recent.map((g) => <GameCard key={g.id} game={g} showGroup={false} />)
            )}
          </section>
        </div>
      )}

      {tab === "cards" && <GroupCards groupId={id} />}
      {tab === "decks" && <GroupDecks groupId={id} />}

      {tab === "members" && (
        <section className="flex flex-col gap-3">
          <div className="panel flex flex-col gap-2 p-3.5">
            <span className="label">Enlace de invitación</span>
            <div className="flex gap-2">
              <input
                className="input mono flex-1"
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className="btn" onClick={() => void copyInvite()}>
                <IconCopy size={14} /> {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="subtle text-xs">
              Quien lo abra puede entrar en el grupo.
              {group.isOwner &&
                " Si se ha compartido de más, genera uno nuevo y el anterior deja de valer."}
            </p>
            {group.isOwner && (
              <button
                type="button"
                className="btn btn-ghost btn-sm self-start"
                onClick={() => void patch({ newInvite: true })}
              >
                Generar un enlace nuevo
              </button>
            )}
          </div>
          <ul className="panel memberlist">
            {group.members.map((m) => (
              <li key={m.username ?? m.name}>
                <Avatar m={m} size={34} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate">{m.name}</b>
                  <span className="subtle text-xs">
                    <MemberLink m={m} /> · desde {playedOn(m.joinedAt)}
                  </span>
                </span>
                {m.isOwner && <span className="pill">Creador</span>}
                {!m.isOwner && (m.isMe || group.isOwner) && m.username && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void remove(m.username!)}
                  >
                    {m.isMe ? "Salir del grupo" : "Quitar"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {group.isOwner && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                Cambiar nombre
              </button>
              <button type="button" className="btn btn-out" onClick={() => setConfirmDelete(true)}>
                <IconTrash size={13} /> Borrar el grupo
              </button>
            </div>
          )}
        </section>
      )}

      <RecordGameDialog
        open={record}
        onClose={() => setRecord(false)}
        groupId={id}
        me={me}
        onSaved={() => {
          setRecord(false);
          load();
          setTab("games");
        }}
      />
      <EditGroupDialog
        open={editing}
        group={group}
        onClose={() => setEditing(false)}
        onSave={(name, description) => {
          setEditing(false);
          void patch({ name, description });
        }}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Borrar el grupo"
        width={420}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-out"
              onClick={() =>
                void api(`/api/groups/${id}`, { method: "DELETE" }).then(() =>
                  router.push("/groups"),
                )
              }
            >
              Borrar con sus partidas
            </button>
          </>
        }
      >
        <p className="text-[13.5px]">
          Se borran el grupo y sus {group.stats.games} partidas. Los mazos y colecciones de cada uno
          no se tocan.
        </p>
      </Dialog>
    </main>
  );
}

function EditGroupDialog({
  open,
  group,
  onClose,
  onSave,
}: {
  open: boolean;
  group: GroupDTO;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar el grupo"
      width={440}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => onSave(name, description)}
          >
            Guardar
          </button>
        </>
      }
    >
      <label className="field">
        <span className="label">Nombre</span>
        <input
          className="input"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="label">Descripción</span>
        <input
          className="input"
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
    </Dialog>
  );
}

function GroupDecks({ groupId }: { groupId: string }) {
  const [decks, setDecks] = useState<GroupDeckDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<GroupDeckDTO[]>(`/api/groups/${groupId}/decks`)
      .then(setDecks)
      .catch((e: unknown) => setError(errorText(e, "No se pudieron cargar los mazos")));
  }, [groupId]);
  if (error) return <Banner tone="out">{error}</Banner>;
  if (!decks) return <Loading>Cargando los mazos del grupo…</Loading>;
  if (decks.length === 0) {
    return (
      <div className="panel">
        <EmptyState title="Nadie tiene mazos públicos todavía">
          Los mazos privados no salen aquí; los públicos y ocultos, sí.
        </EmptyState>
      </div>
    );
  }
  return (
    <div
      className="grid-1-sm grid gap-2.5"
      style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
    >
      {decks.map((d, i) => (
        <DeckTile key={d.id} deck={d} owner={d.owner} delay={i * 30} />
      ))}
    </div>
  );
}

function HolderList({
  row,
  me,
  onAsk,
}: {
  row: GroupCardDTO;
  me: string | null;
  onAsk?: ((card: CardDTO) => void) | undefined;
}) {
  return (
    <ul className="holders">
      {row.holders.map((h) => (
        <li key={h.member.username ?? h.member.name}>
          <Avatar m={h.member} size={24} />
          <MemberLink m={h.member} />
          <span className="mono subtle text-xs">
            {h.free}/{h.owned} libres
          </span>
          {h.usedIn.length > 0 && (
            <span className="subtle truncate text-xs" title={h.usedIn.join(", ")}>
              en {h.usedIn.join(", ")}
            </span>
          )}
          {onAsk && h.member.username === me && h.free > 0 && (
            <button type="button" className="btn btn-sm ml-auto" onClick={() => onAsk(row.card)}>
              Prestar
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Quién tiene qué": lo que me falta y alguien del grupo tiene libre, y buscar una carta. */
function GroupCards({ groupId }: { groupId: string }) {
  const [canLend, setCanLend] = useState<GroupCardDTO[] | null>(null);
  const [found, setFound] = useState<GroupCardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [lend, setLend] = useState<CardDTO | null>(null);
  const { data } = authClient.useSession();

  useEffect(() => {
    api<GroupCardDTO[]>(`/api/groups/${groupId}/can-lend`)
      .then(setCanLend)
      .catch((e: unknown) => setError(errorText(e, "No se pudo cruzar el grupo")));
  }, [groupId]);
  useEffect(() => {
    if (!data?.user) return;
    api<MyProfileDTO>("/api/me/profile", undefined, { silent: true })
      .then((p) => setMe(p.username))
      .catch(() => undefined);
  }, [data?.user]);

  async function lookup(card: CardDTO) {
    try {
      setFound(
        await api<GroupCardDTO>(
          `/api/groups/${groupId}/cards?oracleId=${encodeURIComponent(card.oracleId)}`,
        ),
      );
    } catch (e) {
      setError(errorText(e, "No se pudo buscar"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="panel flex flex-col gap-3 p-3.5">
        <CardSearch
          id="group-card"
          label="¿Quién del grupo tiene…?"
          onPick={(c) => void lookup(c)}
        />
        {found && (
          <div className="holdercard">
            <div className="w-[88px] flex-none">
              <CardImage card={found.card} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <b>{found.card.name}</b>
              {found.holders.length === 0 ? (
                <p className="muted text-[13px]">Nadie del grupo la tiene.</p>
              ) : (
                <HolderList row={found} me={me} onAsk={setLend} />
              )}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="h2">Te lo pueden dejar</h2>
          <p className="subtle text-xs">
            Lo que te falta para tus mazos (o está en tu lista de deseos) y alguien del grupo tiene
            libre: pídeselo prestado.
          </p>
        </div>
        {error && <Banner tone="out">{error}</Banner>}
        {!canLend && !error && <Loading>Cruzando las colecciones del grupo…</Loading>}
        {canLend && canLend.length === 0 && (
          <p className="muted text-[13px]">Nadie del grupo tiene libre lo que te falta.</p>
        )}
        {canLend && canLend.length > 0 && (
          <div
            className="grid-1-sm grid gap-2"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {canLend.map((r) => (
              <div key={r.card.oracleId} className="holdercard panel p-2.5">
                <div className="w-[64px] flex-none">
                  <CardImage card={r.card} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <b className="truncate">{r.card.name}</b>
                  <span className="subtle text-xs">
                    Te {r.wanted === 1 ? "falta 1 copia" : `faltan ${r.wanted} copias`}
                  </span>
                  <HolderList row={r} me={me} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <LendDialog card={lend} onClose={() => setLend(null)} onDone={() => setLend(null)} />
    </div>
  );
}

/** /groups/join/{code}: entrar en un grupo con el enlace de invitación. */
export function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const [preview, setPreview] = useState<{ group: GroupSummaryDTO; member: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ group: GroupSummaryDTO; member: boolean }>(`/api/groups/join/${code}`, undefined, {
      silent: true,
    })
      .then(setPreview)
      .catch((e: unknown) => setError(errorText(e, "Ese enlace no vale")));
  }, [code]);

  async function join() {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>(`/api/groups/join/${code}`, { method: "POST" });
      router.push(`/groups/${id}`);
    } catch (e) {
      setError(errorText(e, "No se pudo entrar en el grupo"));
      setBusy(false);
    }
  }

  return (
    <main className="page max-w-[480px]" style={{ paddingTop: 48 }}>
      {error && <Banner tone="out">{error}</Banner>}
      {!preview && !error && <Loading>Abriendo la invitación…</Loading>}
      {preview && (
        <div className="panel invitecard flex flex-col items-center gap-3 p-6 text-center">
          <span className="groupcard-icon" style={{ width: 56, height: 56 }}>
            <IconUsers size={26} />
          </span>
          <span className="eyebrow">Te han invitado a</span>
          <h1 className="h1">{preview.group.name}</h1>
          {preview.group.description && <p className="muted">{preview.group.description}</p>}
          <span className="subtle text-[13px]">
            {preview.group.members} {preview.group.members === 1 ? "miembro" : "miembros"} ·{" "}
            {preview.group.games} {preview.group.games === 1 ? "partida" : "partidas"}
          </span>
          {preview.member ? (
            <Link className="btn btn-primary btn-lg" href={`/groups/${preview.group.id}`}>
              Ya estás dentro: abrir el grupo
            </Link>
          ) : isPending ? null : data?.user ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={busy}
              onClick={() => void join()}
            >
              Entrar en el grupo
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <Link className="btn btn-primary btn-lg" href={`/signup?next=/groups/join/${code}`}>
                Crear cuenta y entrar
              </Link>
              <Link className="btn" href={`/login?next=/groups/join/${code}`}>
                Ya tengo cuenta
              </Link>
            </div>
          )}
          <p className="subtle text-xs">
            Los miembros ven tus mazos públicos y ocultos y quién tiene cada carta (no tu colección
            entera). Puedes salir cuando quieras.
          </p>
        </div>
      )}
    </main>
  );
}
