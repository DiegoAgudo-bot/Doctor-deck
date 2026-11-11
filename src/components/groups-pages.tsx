"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CardDTO, MyProfileDTO } from "@/server/dto";
import type { GroupCardDTO, GroupDTO, GroupDeckDTO, GroupSummaryDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { CardSearch } from "./card-search";
import { DeckTile } from "./deck-tile";
import { Avatar, GameCard, MemberLink, playedOn, Standings } from "./games-ui";
import { MyGameStats } from "./my-game-stats";
import { IconCopy, IconLink, IconPlus, IconTrash, IconUsers } from "./icons";
import { LendDialog } from "./loans-page";
import { RecordGameDialog } from "./record-game-dialog";
import { ago, Banner, Dialog, EmptyState, fmt, Loading, TilesSkeleton } from "./ui";
import {
  Link,
  useIntlLocale,
  useLocale,
  useLocalePath,
  useRouter,
  useT,
  type T,
} from "@/components/i18n";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** /groups: mis grupos de juego y crear uno. */
export function GroupsPage() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [groups, setGroups] = useState<GroupSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<GroupSummaryDTO[]>("/api/groups")
      .then(setGroups)
      .catch((e: unknown) =>
        setError(errorText(e, t("No se pudieron cargar tus grupos", "Couldn't load your groups"))),
      );
  }, [t]);

  async function create() {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/groups", {
        method: "POST",
        ...json({ name, description }),
      });
      router.push(`/groups/${id}`);
    } catch (e) {
      setError(errorText(e, t("No se pudo crear el grupo", "Couldn't create the group")));
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="stack-sm flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="h1">{t("Grupos de juego", "Playgroups")}</h1>
          <p className="muted text-[13px]">
            {t(
              "La gente con la que juegas: sus mazos, quién tiene cada carta para dejártela, las partidas y la clasificación.",
              "The people you play with: their decks, who has each card to lend you, the games and the standings.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn" href="/play">
            {t("Contador de vidas", "Life counter")}
          </Link>
          {groups && groups.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <IconPlus size={14} /> {t("Nuevo grupo", "New group")}
            </button>
          )}
        </div>
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {!groups && !error && (
        <TilesSkeleton
          count={4}
          height={76}
          label={t("Cargando tus grupos…", "Loading your groups…")}
        />
      )}
      {groups && groups.length === 0 && (
        <div className="panel">
          <EmptyState
            title={t("Aún no estás en ningún grupo", "You're not in any group yet")}
            action={
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                {t("Crear un grupo", "Create a group")}
              </button>
            }
          >
            {t(
              "Crea uno y comparte el enlace de invitación con tus amigos, o pídeles el suyo.",
              "Create one and share the invite link with your friends, or ask them for theirs.",
            )}
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
                  {g.members} {g.members === 1 ? t("miembro", "member") : t("miembros", "members")}{" "}
                  · {fmt(g.games, locale)}{" "}
                  {g.games === 1 ? t("partida", "game") : t("partidas", "games")}
                  {g.lastGameAt ? ` · ${t("última", "last")} ${ago(g.lastGameAt, locale)}` : ""}
                </span>
                {g.description && (
                  <span className="muted truncate text-[13px]">{g.description}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}

      <MyGameStats />

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={t("Nuevo grupo", "New group")}
        width={440}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCreating(false)}>
              {t("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              {t("Crear", "Create")}
            </button>
          </>
        }
      >
        <label className="field">
          <span className="label">{t("Nombre", "Name")}</span>
          <input
            className="input"
            placeholder={t("Los del jueves", "Thursday crew")}
            value={name}
            maxLength={60}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">{t("Descripción (opcional)", "Description (optional)")}</span>
          <input
            className="input"
            placeholder={t(
              "Commander casual en la tienda, bracket 2–3",
              "Casual Commander at the store, bracket 2–3",
            )}
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="subtle text-xs">
          {t(
            "Los miembros ven los mazos públicos y ocultos de los demás y quién tiene cada carta (no la colección entera).",
            "Members see each other's public and unlisted decks and who has each card (not the whole collection).",
          )}
        </p>
      </Dialog>
    </main>
  );
}

type Tab = "games" | "members" | "decks" | "cards";
const tabs = (t: T): [Tab, string][] => [
  ["games", t("Partidas", "Games")],
  ["cards", t("Quién tiene qué", "Who has what")],
  ["decks", t("Mazos", "Decks")],
  ["members", t("Miembros", "Members")],
];

/** /groups/{id}: un grupo. */
export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const lp = useLocalePath();
  const TABS = tabs(t);
  const tab = (TABS.find(([k]) => k === search.get("tab"))?.[0] ?? "games") as Tab;
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
      .catch((e: unknown) =>
        setError(errorText(e, t("No se pudo cargar el grupo", "Couldn't load the group"))),
      );
  }, [id, t]);
  useEffect(() => {
    load();
    api<MyProfileDTO>("/api/me/profile", undefined, { silent: true })
      .then((p) => setMe(p.username))
      .catch(() => undefined);
  }, [load]);

  const setTab = (next: Tab) =>
    router.replace(`/groups/${id}${next === "games" ? "" : `?tab=${next}`}`, { scroll: false });

  if (!group) {
    return (
      <main className="page">
        {error ? (
          <Banner tone="out">{error}</Banner>
        ) : (
          <Loading>{t("Cargando el grupo…", "Loading the group…")}</Loading>
        )}
      </main>
    );
  }

  const invite =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${lp(`/groups/join/${group.inviteCode}`)}`;
  async function copyInvite() {
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
        await navigator.share({
          title: t(`Únete a ${group!.name} en Doctor Deck`, `Join ${group!.name} on Doctor Deck`),
          url: invite,
        });
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
      setError(errorText(e, t("No se pudo guardar", "Couldn't save")));
    }
  }
  async function remove(username: string) {
    try {
      await api(`/api/groups/${id}/members/${username}`, { method: "DELETE" });
      if (username === me) router.push("/groups");
      else load();
    } catch (e) {
      setError(errorText(e, t("No se pudo quitar", "Couldn't remove")));
    }
  }

  const leader = group.stats.players[0];
  return (
    <main className="page">
      <section className="grouphero">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link className="subtle text-[13px]" href="/groups">
            ← {t("Grupos", "Groups")}
          </Link>
          <h1 className="h1">{group.name}</h1>
          {group.description && <p className="muted text-[13.5px]">{group.description}</p>}
          <div className="grouphero-stats">
            <span>
              <b>{group.members.length}</b>{" "}
              {group.members.length === 1 ? t("miembro", "member") : t("miembros", "members")}
            </span>
            <span>
              <b>{fmt(group.stats.games, locale)}</b>{" "}
              {group.stats.games === 1 ? t("partida", "game") : t("partidas", "games")}
            </span>
            {leader && leader.wins > 0 && (
              <span>
                ♛ {t("Lidera", "Leading:")} <b>{leader.name}</b>
              </span>
            )}
          </div>
          <div className="avatarstack" aria-label={t("Miembros", "Members")}>
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
            <IconPlus size={14} /> {t("Registrar partida", "Record game")}
          </button>
          <Link className="btn" href="/play">
            {t("Contador de vidas", "Life counter")}
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => void copyInvite()}>
            {copied ? (
              t("¡Enlace copiado!", "Link copied!")
            ) : (
              <>
                <IconLink size={14} /> {t("Invitar", "Invite")}
              </>
            )}
          </button>
        </div>
      </section>

      {error && <Banner tone="out">{error}</Banner>}

      <nav className="tabs" aria-label={t("Secciones del grupo", "Group sections")}>
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={tab === k ? "is-active" : ""}
            onClick={() => setTab(k)}
          >
            {label}
            {k === "members" && <span className="n">{group.members.length}</span>}
            {k === "games" && <span className="n">{group.stats.games}</span>}
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
              <h2 className="h2">{t("Clasificación", "Standings")}</h2>
              <div className="chips">
                <button
                  type="button"
                  className={`chipbtn ${kind === "player" ? "is-on" : ""}`}
                  onClick={() => setKind("player")}
                >
                  {t("Jugadores", "Players")}
                </button>
                <button
                  type="button"
                  className={`chipbtn ${kind === "deck" ? "is-on" : ""}`}
                  onClick={() => setKind("deck")}
                >
                  {t("Mazos", "Decks")}
                </button>
              </div>
            </div>
            <Standings
              rows={kind === "player" ? group.stats.players : group.stats.decks}
              kind={kind}
              empty={t(
                "Aún no hay partidas. Registra la primera desde aquí o desde el contador de vidas.",
                "No games yet. Record the first one here or from the life counter.",
              )}
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="h2">{t("Últimas partidas", "Latest games")}</h2>
            {group.stats.recent.length === 0 ? (
              <div className="panel">
                <EmptyState
                  title={t("Sin partidas", "No games")}
                  action={
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setRecord(true)}
                    >
                      {t("Registrar partida", "Record game")}
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
            <span className="label">{t("Enlace de invitación", "Invite link")}</span>
            <div className="flex gap-2">
              <input
                className="input mono flex-1"
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className="btn" onClick={() => void copyInvite()}>
                <IconCopy size={14} /> {copied ? t("Copiado", "Copied") : t("Copiar", "Copy")}
              </button>
            </div>
            <p className="subtle text-xs">
              {t(
                "Quien lo abra puede entrar en el grupo.",
                "Anyone who opens it can join the group.",
              )}
              {group.isOwner &&
                t(
                  " Si se ha compartido de más, genera uno nuevo y el anterior deja de valer.",
                  " If it's been shared too widely, generate a new one and the old one stops working.",
                )}
            </p>
            {group.isOwner && (
              <button
                type="button"
                className="btn btn-ghost btn-sm self-start"
                onClick={() => void patch({ newInvite: true })}
              >
                {t("Generar un enlace nuevo", "Generate a new link")}
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
                    <MemberLink m={m} /> · {t("desde", "since")} {playedOn(m.joinedAt, intl)}
                  </span>
                </span>
                {m.isOwner && <span className="pill">{t("Creador", "Creator")}</span>}
                {!m.isOwner && (m.isMe || group.isOwner) && m.username && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void remove(m.username!)}
                  >
                    {m.isMe ? t("Salir del grupo", "Leave the group") : t("Quitar", "Remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {group.isOwner && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                {t("Cambiar nombre", "Rename")}
              </button>
              <button type="button" className="btn btn-out" onClick={() => setConfirmDelete(true)}>
                <IconTrash size={13} /> {t("Borrar el grupo", "Delete the group")}
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
        title={t("Borrar el grupo", "Delete the group")}
        width={420}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              {t("Cancelar", "Cancel")}
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
              {t("Borrar con sus partidas", "Delete with its games")}
            </button>
          </>
        }
      >
        <p className="text-[13.5px]">
          {t(
            `Se borran el grupo y sus ${group.stats.games} partidas. Los mazos y colecciones de cada uno no se tocan.`,
            `The group and its ${group.stats.games} games are deleted. Everyone's decks and collections are untouched.`,
          )}
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
  const t = useT();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Editar el grupo", "Edit the group")}
      width={440}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancelar", "Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => onSave(name, description)}
          >
            {t("Guardar", "Save")}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="label">{t("Nombre", "Name")}</span>
        <input
          className="input"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="label">{t("Descripción", "Description")}</span>
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
  const t = useT();
  const [decks, setDecks] = useState<GroupDeckDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<GroupDeckDTO[]>(`/api/groups/${groupId}/decks`)
      .then(setDecks)
      .catch((e: unknown) =>
        setError(errorText(e, t("No se pudieron cargar los mazos", "Couldn't load the decks"))),
      );
  }, [groupId, t]);
  if (error) return <Banner tone="out">{error}</Banner>;
  if (!decks)
    return <Loading>{t("Cargando los mazos del grupo…", "Loading the group's decks…")}</Loading>;
  if (decks.length === 0) {
    return (
      <div className="panel">
        <EmptyState title={t("Nadie tiene mazos públicos todavía", "Nobody has public decks yet")}>
          {t(
            "Los mazos privados no salen aquí; los públicos y ocultos, sí.",
            "Private decks don't show here; public and unlisted ones do.",
          )}
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
  const t = useT();
  return (
    <ul className="holders">
      {row.holders.map((h) => (
        <li key={h.member.username ?? h.member.name}>
          <Avatar m={h.member} size={24} />
          <MemberLink m={h.member} />
          <span className="mono subtle text-xs">
            {h.free}/{h.owned} {t("libres", "free")}
          </span>
          {h.usedIn.length > 0 && (
            <span className="subtle truncate text-xs" title={h.usedIn.join(", ")}>
              {t("en", "in")} {h.usedIn.join(", ")}
            </span>
          )}
          {onAsk && h.member.username === me && h.free > 0 && (
            <button type="button" className="btn btn-sm ml-auto" onClick={() => onAsk(row.card)}>
              {t("Prestar", "Lend")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Quién tiene qué": lo que me falta y alguien del grupo tiene libre, y buscar una carta. */
function GroupCards({ groupId }: { groupId: string }) {
  const t = useT();
  const [canLend, setCanLend] = useState<GroupCardDTO[] | null>(null);
  const [found, setFound] = useState<GroupCardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [lend, setLend] = useState<CardDTO | null>(null);
  const { data } = authClient.useSession();

  useEffect(() => {
    api<GroupCardDTO[]>(`/api/groups/${groupId}/can-lend`)
      .then(setCanLend)
      .catch((e: unknown) =>
        setError(errorText(e, t("No se pudo cruzar el grupo", "Couldn't match the group"))),
      );
  }, [groupId, t]);
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
      setError(errorText(e, t("No se pudo buscar", "Couldn't search")));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="panel flex flex-col gap-3 p-3.5">
        <CardSearch
          id="group-card"
          label={t("¿Quién del grupo tiene…?", "Who in the group has…?")}
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
                <p className="muted text-[13px]">
                  {t("Nadie del grupo la tiene.", "Nobody in the group has it.")}
                </p>
              ) : (
                <HolderList row={found} me={me} onAsk={setLend} />
              )}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="h2">{t("Te lo pueden dejar", "They can lend it to you")}</h2>
          <p className="subtle text-xs">
            {t(
              "Lo que te falta para tus mazos (o está en tu lista de deseos) y alguien del grupo tiene libre: pídeselo prestado.",
              "What you're missing for your decks (or have on your wishlist) that someone in the group has free: ask to borrow it.",
            )}
          </p>
        </div>
        {error && <Banner tone="out">{error}</Banner>}
        {!canLend && !error && (
          <Loading>
            {t("Cruzando las colecciones del grupo…", "Matching the group's collections…")}
          </Loading>
        )}
        {canLend && canLend.length === 0 && (
          <p className="muted text-[13px]">
            {t(
              "Nadie del grupo tiene libre lo que te falta.",
              "Nobody in the group has what you're missing free.",
            )}
          </p>
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
                    {r.wanted === 1
                      ? t("Te falta 1 copia", "You need 1 copy")
                      : t(`Te faltan ${r.wanted} copias`, `You need ${r.wanted} copies`)}
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
  const t = useT();
  const lp = useLocalePath();
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
      .catch((e: unknown) =>
        setError(errorText(e, t("Ese enlace no vale", "That link isn't valid"))),
      );
  }, [code, t]);

  async function join() {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>(`/api/groups/join/${code}`, { method: "POST" });
      router.push(`/groups/${id}`);
    } catch (e) {
      setError(errorText(e, t("No se pudo entrar en el grupo", "Couldn't join the group")));
      setBusy(false);
    }
  }

  return (
    <main className="page" style={{ paddingTop: 48 }}>
      {error && <Banner tone="out">{error}</Banner>}
      {!preview && !error && (
        <Loading>{t("Abriendo la invitación…", "Opening the invite…")}</Loading>
      )}
      {preview && (
        <div className="panel invitecard mx-auto flex w-full max-w-[480px] flex-col items-center gap-3 p-6 text-center">
          <span className="groupcard-icon" style={{ width: 56, height: 56 }}>
            <IconUsers size={26} />
          </span>
          <span className="muted text-[13px]">
            {t("Te han invitado a", "You've been invited to")}
          </span>
          <h1 className="h1">{preview.group.name}</h1>
          {preview.group.description && <p className="muted">{preview.group.description}</p>}
          <span className="subtle text-[13px]">
            {preview.group.members}{" "}
            {preview.group.members === 1 ? t("miembro", "member") : t("miembros", "members")} ·{" "}
            {preview.group.games}{" "}
            {preview.group.games === 1 ? t("partida", "game") : t("partidas", "games")}
          </span>
          {preview.member ? (
            <Link className="btn btn-primary btn-lg" href={`/groups/${preview.group.id}`}>
              {t("Ya estás dentro: abrir el grupo", "You're already in: open the group")}
            </Link>
          ) : isPending ? null : data?.user ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={busy}
              onClick={() => void join()}
            >
              {t("Entrar en el grupo", "Join the group")}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                className="btn btn-primary btn-lg"
                href={`/signup?next=${encodeURIComponent(lp(`/groups/join/${code}`))}`}
              >
                {t("Crear cuenta y entrar", "Create an account and join")}
              </Link>
              <Link
                className="btn"
                href={`/login?next=${encodeURIComponent(lp(`/groups/join/${code}`))}`}
              >
                {t("Ya tengo cuenta", "I already have an account")}
              </Link>
            </div>
          )}
          <p className="subtle text-xs">
            {t(
              "Los miembros ven tus mazos públicos y ocultos y quién tiene cada carta (no tu colección entera). Puedes salir cuando quieras.",
              "Members see your public and unlisted decks and who has each card (not your whole collection). You can leave whenever you want.",
            )}
          </p>
        </div>
      )}
    </main>
  );
}
