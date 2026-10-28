import type { Metadata } from "next";
import { MyCardView } from "@/app/tarjeta/view";

export const metadata: Metadata = { title: "Mi tarjeta", robots: { index: false } };

export default async function BusinessCardPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bienvenida?: string; reactivada?: string }>;
}) {
  const { slug } = await params;
  return MyCardView({ businessSlug: slug, searchParams });
}
