import type { Metadata } from "next";
import { CommunityPage } from "@/components/community-page";

export const metadata: Metadata = { title: "Comunidad · Deck Doctor" };

export default function Page() {
  return <CommunityPage />;
}
