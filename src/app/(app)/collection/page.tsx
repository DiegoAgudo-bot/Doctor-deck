import type { Metadata } from "next";
import { CollectionPage } from "@/components/collection-page";

export const metadata: Metadata = { title: "Mi colección · Deck Doctor" };

export default function Page() {
  return <CollectionPage />;
}
