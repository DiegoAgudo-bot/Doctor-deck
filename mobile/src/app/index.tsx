import { Redirect } from "expo-router";
import { useSession } from "~/lib/auth";

export default function Index() {
  const { data } = useSession();
  return <Redirect href={data?.user ? "/collection" : "/login"} />;
}
