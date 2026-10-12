import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsPage } from "@/components/settings-page";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Ajustes · Doctor Deck" };

/** Qué se puede vincular o verificar depende de la configuración en tiempo de ejecución. */
async function Settings() {
  await connection();
  const { google, passwordReset } = getContainer().authFeatures;
  return <SettingsPage google={google} mail={passwordReset} />;
}

export default function Page() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
