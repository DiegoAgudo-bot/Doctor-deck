import type { Metadata } from "next";
import { CommunityPage } from "@/components/community-page";

export const metadata: Metadata = { title: "Comunidad · Doctor Deck" };

export default function Page() {
  return <CommunityPage />;
}
