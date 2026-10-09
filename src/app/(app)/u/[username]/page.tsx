import { Suspense } from "react";
import { ProfilePage } from "@/components/profile-page";

/** Perfil público: /u/{username}. El parámetro se lee dentro de Suspense (Cache Components). */
export default function Page() {
  return (
    <Suspense>
      <ProfilePage />
    </Suspense>
  );
}
