import type { SwapDTO } from "@/server/dto";
import { CardImage } from "./card-image";

export type Decision = "accepted" | "rejected";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);

export function SwapItem({
  swap,
  decision,
  onDecide,
}: {
  swap: SwapDTO;
  decision: Decision | undefined;
  onDecide: (d: Decision | undefined) => void;
}) {
  const border =
    decision === "accepted"
      ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30"
      : decision === "rejected"
        ? "border-zinc-200 opacity-50 dark:border-zinc-800"
        : "border-zinc-200 dark:border-zinc-800";
  return (
    <li className={`flex flex-col gap-3 rounded-xl border p-3 ${border}`}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <figure className="flex flex-col gap-1">
          <CardImage card={swap.out.card} className="w-full" />
          <figcaption className="text-xs">
            <span className="font-medium text-red-700 dark:text-red-400">Sale</span> ·{" "}
            {pct(swap.out.inclusion)}
          </figcaption>
        </figure>
        <span aria-hidden className="text-2xl text-zinc-400">
          →
        </span>
        <figure className="flex flex-col gap-1">
          <CardImage card={swap.in.card} className="w-full" />
          <figcaption className="text-xs">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Entra</span> ·{" "}
            {pct(swap.in.inclusion)}
          </figcaption>
        </figure>
      </div>
      <p className="text-sm">{swap.reason}</p>
      <div className="flex gap-2">
        {decision ? (
          <button type="button" className="text-sm underline" onClick={() => onDecide(undefined)}>
            Deshacer ({decision === "accepted" ? "aceptado" : "descartado"})
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onDecide("accepted")}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Aceptar
            </button>
            <button
              type="button"
              onClick={() => onDecide("rejected")}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Descartar
            </button>
          </>
        )}
      </div>
    </li>
  );
}
