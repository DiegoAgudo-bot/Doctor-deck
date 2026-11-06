import { Suspense } from "react";
import { GroupPage } from "@/components/groups-pages";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Grupo", "Group"] });

export default function Page() {
  return (
    <Suspense>
      <GroupPage />
    </Suspense>
  );
}
