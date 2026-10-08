import { StatusPanel } from "@/components/status-panel";

export default function Home() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Deck Doctor</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Importa tu colección de ManaBox, pega un mazo de Commander y te propongo cambios 1×1 con
          cartas que ya tienes, según EDHREC.
        </p>
      </div>
      <StatusPanel />
    </>
  );
}
