import type { Metadata } from "next";
import { CollectionImport } from "@/components/collection-import";

export const metadata: Metadata = { title: "Colección · Deck Doctor" };

export default function CollectionPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Colección</h1>
      <CollectionImport />
    </>
  );
}
