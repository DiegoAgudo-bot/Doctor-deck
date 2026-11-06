import { Suspense } from "react";
import { AdminErrors } from "@/components/admin-errors";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Errores", "Errors"] });

export default function Page() {
  return (
    <Suspense>
      <AdminErrors />
    </Suspense>
  );
}
