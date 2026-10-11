import type { Metadata } from "next";
import { CollectionPage } from "@/components/collection-page";

export const metadata: Metadata = { title: "Mi colección · Doctor Deck" };

export default function Page() {
  return <CollectionPage />;
}
