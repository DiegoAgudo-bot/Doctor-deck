"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { COMMENT_MAX_LENGTH, REPORT_REASONS, type ReportReason } from "@/domain/social/comments";
import type { CommentDTO, DeckCommentsDTO, GameStatsDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { Avatar, GameCard, MemberLink } from "./games-ui";
import { IconTrash } from "./icons";
import { ago, Banner, Dialog } from "./ui";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Partidas jugadas con el mazo (las que puedo ver) y su porcentaje de victorias. */
function DeckRecord({ deckId }: { deckId: string }) {
  const [stats, setStats] = useState<GameStatsDTO | null>(null);
  useEffect(() => {
    api<GameStatsDTO>(`/api/games?deck=${encodeURIComponent(deckId)}`, undefined, { silent: true })
      .then(setStats)
      .catch(() => setStats(null));
  }, [deckId]);
  const deck = stats?.decks.find((d) => d.deckId === deckId);
  if (!stats || !deck) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="h2">
        En la mesa{" "}
        <span className="subtle text-[13px] font-normal">
          {deck.wins} de {deck.games} {deck.games === 1 ? "partida ganada" : "partidas ganadas"} (
          {Math.round(deck.winRate * 100)} %)
        </span>
      </h2>
      <div
        className="grid-1-sm grid gap-2"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        {stats.recent.slice(0, 4).map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
    </section>
  );
}

/** Comentarios de un mazo público u oculto, con denunciar, borrar y (el dueño) cerrarlos. */
export function DeckComments({ deckId, loggedIn }: { deckId: string; loggedIn: boolean }) {
  const [data, setData] = useState<DeckCommentsDTO | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState<CommentDTO | null>(null);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api<DeckCommentsDTO>(`/api/decks/${encodeURIComponent(deckId)}/comments`, undefined, {
      silent: true,
    })
      .then(setData)
      .catch(() => setData(null));
  }, [deckId]);
  useEffect(load, [load]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      setData(
        await api<DeckCommentsDTO>(`/api/decks/${encodeURIComponent(deckId)}/comments`, {
          method: "POST",
          ...json({ body }),
        }),
      );
      setBody("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo publicar");
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: CommentDTO) {
    await api(`/api/comments/${c.id}`, { method: "DELETE" }).catch(() => undefined);
    load();
  }
  async function report() {
    if (!reporting) return;
    try {
      const r = await api<{ hidden: boolean }>(`/api/comments/${reporting.id}/report`, {
        method: "POST",
        ...json({ reason }),
      });
      setNotice(
        r.hidden
          ? "Gracias. El comentario queda oculto hasta que lo revisemos."
          : "Gracias por avisar. Lo revisaremos.",
      );
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo denunciar");
    } finally {
      setReporting(null);
    }
  }
  async function toggleOpen() {
    if (!data) return;
    setData(
      await api<DeckCommentsDTO>(`/api/decks/${encodeURIComponent(deckId)}/comments`, {
        method: "PATCH",
        ...json({ open: !data.open }),
      }),
    );
  }

  if (!data) return null;
  return (
    <>
      {loggedIn && <DeckRecord deckId={deckId} />}
      <section id="comments" className="flex flex-col gap-3" style={{ scrollMarginTop: 80 }}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="h2">
            Comentarios{" "}
            <span className="subtle text-[13px] font-normal">
              {data.comments.filter((c) => !c.hidden).length}
            </span>
          </h2>
          {data.isOwner && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void toggleOpen()}
            >
              {data.open ? "Cerrar comentarios" : "Abrir comentarios"}
            </button>
          )}
        </div>
        {notice && <Banner tone="in">{notice}</Banner>}
        {data.comments.length > 0 && (
          <ul className="panel comments">
            {data.comments.map((c) => (
              <li key={c.id} className={c.hidden ? "is-hidden" : ""}>
                <Avatar m={c.author} size={30} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[12.5px]">
                    <b>
                      <MemberLink m={c.author} />
                    </b>{" "}
                    <span className="subtle">· {ago(c.createdAt)}</span>
                    {c.hidden && <span className="pill pill-warn ml-2">Oculto por denuncias</span>}
                  </span>
                  <p className="comment-body">{c.body}</p>
                </div>
                <div className="flex flex-none gap-1">
                  {loggedIn && !c.mine && !c.hidden && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm subtle"
                      onClick={() => setReporting(c)}
                    >
                      Denunciar
                    </button>
                  )}
                  {c.canDelete && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label="Borrar el comentario"
                      onClick={() => void remove(c)}
                    >
                      <IconTrash size={13} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.canComment ? (
          <div className="panel flex flex-col gap-2 p-3">
            {error && <Banner tone="out">{error}</Banner>}
            <textarea
              className="textarea textarea-sm"
              rows={3}
              placeholder="¿Qué le cambiarías? Sé amable: hay una persona al otro lado."
              value={body}
              maxLength={COMMENT_MAX_LENGTH}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="subtle text-xs">
                {body.length}/{COMMENT_MAX_LENGTH}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !body.trim()}
                onClick={() => void send()}
              >
                Comentar
              </button>
            </div>
          </div>
        ) : !loggedIn ? (
          <p className="muted text-[13px]">
            <Link href={`/login?next=/decks/${deckId}`}>Entra</Link> para comentar.
          </p>
        ) : !data.open ? (
          <p className="muted text-[13px]">Los comentarios de este mazo están cerrados.</p>
        ) : null}
      </section>
      <Dialog
        open={reporting !== null}
        onClose={() => setReporting(null)}
        title="Denunciar comentario"
        width={420}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setReporting(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-out" onClick={() => void report()}>
              Denunciar
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([k, label]) => (
            <label key={k} className="check">
              <input
                type="radio"
                name="reason"
                checked={reason === k}
                onChange={() => setReason(k)}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="subtle text-xs">
          Con varias denuncias el comentario se oculta hasta que lo revisemos. Si alguien te
          molesta, también puedes bloquearle desde su perfil.
        </p>
      </Dialog>
    </>
  );
}
