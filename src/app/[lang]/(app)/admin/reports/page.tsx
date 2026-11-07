import { Suspense } from "react";
import { AdminReports } from "@/components/admin-reports";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Denuncias", "Reports"] });

export default function Page() {
  return (
    <Suspense>
      <AdminReports />
    </Suspense>
  );
}
