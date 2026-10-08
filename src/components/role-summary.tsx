import type { RoleStatDTO } from "@/server/dto";

export function RoleSummary({ roles }: { roles: RoleStatDTO[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {roles.map((r) => {
        const low = r.count < r.min;
        return (
          <li
            key={r.role}
            className={`rounded-full border px-3 py-1 text-sm tabular-nums ${
              low
                ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
                : "border-zinc-200 dark:border-zinc-700"
            }`}
            title={r.min > 0 ? `Mínimo: ${r.min}` : undefined}
          >
            {r.label} <strong>{r.count}</strong>
            {r.min > 0 && <span className="text-zinc-500">/{r.min}</span>}
          </li>
        );
      })}
    </ul>
  );
}
