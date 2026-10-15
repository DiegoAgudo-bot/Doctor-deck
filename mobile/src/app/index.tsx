import { Redirect } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { Loading } from "~/components/ui";
import { useSession } from "~/lib/auth";
import { hasPendingImport } from "~/lib/shared";

export default function Index() {
  const { data } = useSession();
  const { hasShareIntent } = useShareIntentContext();
  // Al abrir la app desde «Compartir», el layout lleva a la pantalla de importar: no hay que
  // redirigir a la colección por encima.
  if (data?.user && (hasShareIntent || hasPendingImport())) return <Loading />;
  return <Redirect href={data?.user ? "/collection" : "/login"} />;
}
