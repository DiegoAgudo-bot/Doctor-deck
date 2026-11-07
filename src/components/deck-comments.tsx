"use client";

import { useCallback, useEffect, useState } from "react";
import { COMMENT_MAX_LENGTH, REPORT_REASONS, type ReportReason } from "@/domain/social/comments";
import type { CommentDTO, DeckCommentsDTO, GameStatsDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { Avatar, GameCard, MemberLink } from "./games-ui";
import { IconTrash } from "./icons";
import { ago, Banner, Dialog } from "./ui";
import { Link, useLocale, useLocalePath, useT } from "@/components/i18n";

const REPORT_REASONS_EN: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  abuse: "Insults or harassment",
  other: "Something else",
};

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Partidas jugadas con el mazo (las que puedo ver) y su porcentaje de victorias. */
function DeckRecord({ deckId }: { deckId: string }) {
  const t = useT();
  const locale = useLocale();
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
        {t("En la mesa", "At the table")}{" "}
        <span className="subtle text-[13px] font-normal">
          {t(
            `${deck.wins} de ${deck.games} ${deck.games === 1 ? "partida ganada" : "partidas ganadas"}`,
            `${deck.wins} of ${deck.games} ${deck.games === 1 ? "game won" : "games won"}`,
          )}{" "}
          ({Math.round(deck.winRate * 100)}
          {locale === "en" ? "" : " "}%)
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
  const t = useT();
  const locale = useLocale();
  const lp = useLocalePath();
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
      setError(e instanceof ApiError ? e.message : t("No se pudo publicar", "Couldn't post it"));
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
          ? t(
              "Gracias. El comentario queda oculto hasta que lo revisemos.",
              "Thanks. The comment stays hidden until we review it.",
            )
          : t(
              "Gracias por avisar. Lo revisaremos.",
              "Thanks for letting us know. We'll review it.",
            ),
      );
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("No se pudo denunciar", "Couldn't report it"));
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
            {t("Comentarios", "Comments")}{" "}
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
              {data.open
                ? t("Cerrar comentarios", "Close comments")
                : t("Abrir comentarios", "Open comments")}
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
                    <span className="subtle">· {ago(c.createdAt, locale)}</span>
                    {c.hidden && (
                      <span className="pill pill-warn ml-2">
                        {t("Oculto por denuncias", "Hidden after reports")}
                      </span>
                    )}
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
                      {t("Denunciar", "Report")}
                    </button>
                  )}
                  {c.canDelete && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label={t("Borrar el comentario", "Delete the comment")}
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
              placeholder={t(
                "¿Qué le cambiarías? Sé amable: hay una persona al otro lado.",
                "What would you change? Be kind: there's a person on the other side.",
              )}
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
                {t("Comentar", "Comment")}
              </button>
            </div>
          </div>
        ) : !loggedIn ? (
          <p className="muted text-[13px]">
            <Link href={`/login?next=${encodeURIComponent(lp(`/decks/${deckId}`))}`}>
              {t("Entra", "Sign in")}
            </Link>{" "}
            {t("para comentar.", "to comment.")}
          </p>
        ) : !data.open ? (
          <p className="muted text-[13px]">
            {t("Los comentarios de este mazo están cerrados.", "Comments on this deck are closed.")}
          </p>
        ) : null}
      </section>
      <Dialog
        open={reporting !== null}
        onClose={() => setReporting(null)}
        title={t("Denunciar comentario", "Report comment")}
        width={420}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setReporting(null)}>
              {t("Cancelar", "Cancel")}
            </button>
            <button type="button" className="btn btn-out" onClick={() => void report()}>
              {t("Denunciar", "Report")}
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
              {locale === "en" ? REPORT_REASONS_EN[k] : label}
            </label>
          ))}
        </div>
        <p className="subtle text-xs">
          {t(
            "Con varias denuncias el comentario se oculta hasta que lo revisemos. Si alguien te molesta, también puedes bloquearle desde su perfil.",
            "After several reports the comment is hidden until we review it. If someone bothers you, you can also block them from their profile.",
          )}
        </p>
      </Dialog>
    </>
  );
}
