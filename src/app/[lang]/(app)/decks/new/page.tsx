import { NewDeckWizard } from "@/components/new-deck-wizard";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Crear un mazo de Commander", "Create a Commander deck"],
  description: [
    "Elige un comandante y empieza con el mazo medio de la comunidad, con las cartas que ya tienes o desde cero. También puedes importar una lista o un enlace.",
    "Pick a commander and start from the community's average deck, from the cards you already own or from scratch. You can also import a list or a link.",
  ],
  path: "/decks/new",
});

export default function Page() {
  return <NewDeckWizard />;
}
