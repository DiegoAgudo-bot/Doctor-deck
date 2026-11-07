import { SavedDecks } from "@/components/saved-decks";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Mis mazos", "My decks"] });

export default function SavedDecksPage() {
  return <SavedDecks />;
}
