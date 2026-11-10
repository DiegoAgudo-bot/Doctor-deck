import { Suspense } from "react";
import { ShoppingPage } from "@/components/shopping-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Lista de compra", "Shopping list"] });

export default function Page() {
  return (
    <Suspense>
      <ShoppingPage />
    </Suspense>
  );
}
