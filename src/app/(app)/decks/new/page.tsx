import type { Metadata } from "next";
import { NewDeckWizard } from "@/components/new-deck-wizard";

export const metadata: Metadata = { title: "Nuevo mazo · Deck Doctor" };

export default function Page() {
  return <NewDeckWizard />;
}
