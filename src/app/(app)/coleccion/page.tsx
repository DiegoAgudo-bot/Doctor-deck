import type { Metadata } from "next";
import { CollectionImport } from "@/components/collection-import";

export const metadata: Metadata = { title: "Mi colección · Deck Doctor" };

export default function CollectionPage() {
  return <CollectionImport />;
}
