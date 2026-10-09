"use client";

import Link from "next/link";
import { authClient } from "./auth-client";
import { storage } from "./api-client";

/** Cabecera: "Entrar" o el nombre del usuario con "Salir". */
export function UserMenu() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className="w-14" />;
  if (!data) {
    return (
      <Link
        href="/entrar"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Entrar
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="hidden max-w-32 truncate text-zinc-500 md:inline" title={data.user.email}>
        {data.user.name}
      </span>
      <button
        type="button"
        className="rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={async () => {
          await authClient.signOut();
          storage.remove("deck-doctor:mazo"); // no dejar el mazo abierto en un navegador compartido
          window.location.assign(new URL("/", window.location.origin));
        }}
      >
        Salir
      </button>
    </span>
  );
}
