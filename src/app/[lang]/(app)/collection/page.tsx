import { CollectionPage } from "@/components/collection-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Gestiona tu colección de Magic", "Manage your Magic collection"],
  description: [
    "Importa el CSV de tu colección de Magic o añade cartas a mano (edición, foil, idioma y estado): su valor, el histórico de precios y en qué mazos usas cada carta.",
    "Import your Magic collection CSV or add cards by hand (set, foil, language and condition): its value, price history and which decks use each card.",
  ],
  path: "/collection",
});

export default function Page() {
  return <CollectionPage />;
}
