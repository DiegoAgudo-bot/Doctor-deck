import { Redirect } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useSession } from "~/lib/auth";

export default function Index() {
  const { data } = useSession();
  const { hasShareIntent } = useShareIntentContext();
  if (!data?.user) return <Redirect href="/login" />;
  // Al abrir la app desde «Compartir», directamente a la pantalla de importar.
  return <Redirect href={hasShareIntent ? "/share" : "/collection"} />;
}
