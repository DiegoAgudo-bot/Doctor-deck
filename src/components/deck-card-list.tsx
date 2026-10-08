import { ROLE_LABELS } from "@/domain/roles/types";
import type { DeckCardDTO } from "@/server/dto";

/** Lista de las 99 con interruptor de bloqueo (las bloqueadas nunca se proponen como corte). */
export function DeckCardList({
  cards,
  locked,
  onToggleLock,
}: {
  cards: DeckCardDTO[];
  locked: ReadonlySet<string>;
  onToggleLock: (oracleId: string) => void;
}) {
  const sorted = [...cards].sort(
    (a, b) => a.primaryRole.localeCompare(b.primaryRole) || a.card.name.localeCompare(b.card.name),
  );
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
      {sorted.map((c) => {
        const isLocked = locked.has(c.card.oracleId);
        return (
          <li key={c.card.oracleId} className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-6 tabular-nums text-zinc-500">{c.quantity}</span>
            <span className="flex-1 truncate">{c.card.name}</span>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              {c.roles.map((r) => ROLE_LABELS[r]).join(", ")}
            </span>
            {c.isBasicLand ? (
              <span className="w-9" />
            ) : (
              <button
                type="button"
                aria-pressed={isLocked}
                aria-label={isLocked ? `Desbloquear ${c.card.name}` : `Bloquear ${c.card.name}`}
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
  );
}
