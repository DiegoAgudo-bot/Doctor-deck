import { ROLE_LABELS, ROLES } from "@/domain/roles/types";
import type { DeckCardDTO } from "@/server/dto";

/** Las 99 agrupadas por rol principal, con candado (las bloqueadas nunca se proponen como corte). */
export function DeckCardList({
  cards,
  locked,
  onToggleLock,
}: {
  cards: DeckCardDTO[];
  locked: ReadonlySet<string>;
  onToggleLock: (oracleId: string) => void;
}) {
  const groups = ROLES.map((role) => ({
    role,
    cards: cards
      .filter((c) => c.primaryRole === role)
      .sort((a, b) => a.card.name.localeCompare(b.card.name)),
  })).filter((g) => g.cards.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.role}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {ROLE_LABELS[g.role]} ({g.cards.reduce((n, c) => n + c.quantity, 0)})
          </h3>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {g.cards.map((c) => {
              const isLocked = locked.has(c.card.oracleId);
              const others = c.roles.filter((r) => r !== c.primaryRole);
              return (
                <li key={c.card.oracleId} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-6 tabular-nums text-zinc-500">{c.quantity}</span>
                  <span className="flex-1 truncate">{c.card.name}</span>
                  {others.length > 0 && (
                    <span className="hidden text-xs text-zinc-500 sm:inline">
                      + {others.map((r) => ROLE_LABELS[r]).join(", ")}
                    </span>
                  )}
                  {c.isBasicLand ? (
                    <span className="w-9" />
                  ) : (
                    <button
                      type="button"
                      aria-pressed={isLocked}
                      aria-label={
                        isLocked ? `Desbloquear ${c.card.name}` : `Bloquear ${c.card.name}`
                      }
                      title={isLocked ? "Bloqueada: no se propondrá cortarla" : "Bloquear"}
                      onClick={() => onToggleLock(c.card.oracleId)}
                      className={`w-9 rounded-md py-1 ${isLocked ? "bg-amber-200 dark:bg-amber-800" : "opacity-40 hover:opacity-100"}`}
                    >
                      {isLocked ? "🔒" : "🔓"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
