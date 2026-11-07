import { Redirect } from "expo-router";
import { useSession } from "~/lib/auth";
import { useShareInbox } from "~/lib/share-intake";

export default function Index() {
  const { data } = useSession();
  const inbox = useShareInbox();
  if (!data?.user) return <Redirect href="/login" />;
  // Al abrir la app desde «Compartir», directamente a la pantalla de importar.
  return <Redirect href={inbox ? "/share" : "/home"} />;
}
