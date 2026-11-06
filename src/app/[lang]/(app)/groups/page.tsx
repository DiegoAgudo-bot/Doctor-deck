import { Suspense } from "react";
import { GroupsPage } from "@/components/groups-pages";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Grupos", "Groups"] });

export default function Page() {
  return (
    <Suspense>
      <GroupsPage />
    </Suspense>
  );
}
