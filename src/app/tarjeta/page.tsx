import type { Metadata } from "next";
import { PILOT_BUSINESS_SLUG } from "@/lib/business";
import { MyCardView } from "./view";

export const metadata: Metadata = { title: "Mi tarjeta" };

export default function MyCardPage({ searchParams }: { searchParams: Promise<{ bienvenida?: string; reactivada?: string }> }) {
  return MyCardView({ businessSlug: PILOT_BUSINESS_SLUG, searchParams });
}
