import { Suspense } from "react";
import { JoinGroupPage } from "@/components/groups-pages";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Invitación a un grupo", "Group invitation"],
});

export default function Page() {
  return (
    <Suspense>
      <JoinGroupPage />
    </Suspense>
  );
}
