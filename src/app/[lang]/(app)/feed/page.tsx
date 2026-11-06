import { Suspense } from "react";
import { FeedPage } from "@/components/feed-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Actividad", "Activity"] });

export default function Page() {
  return (
    <Suspense>
      <FeedPage />
    </Suspense>
  );
}
