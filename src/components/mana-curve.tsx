export function ManaCurve({ curve }: { curve: Record<number, number> }) {
  const entries = Object.entries(curve).map(([k, v]) => [Number(k), v] as const);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="flex h-32 items-end gap-2" role="img" aria-label="Curva de maná">
      {entries.map(([cmc, n]) => (
        <div key={cmc} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs tabular-nums text-zinc-500">{n}</span>
          <div
            className="w-full rounded-t bg-sky-500 dark:bg-sky-400"
            style={{ height: `${(n / max) * 80}px`, minHeight: n > 0 ? 2 : 0 }}
          />
          <span className="text-xs font-medium">{cmc === 7 ? "7+" : cmc}</span>
        </div>
      ))}
    </div>
  );
}
