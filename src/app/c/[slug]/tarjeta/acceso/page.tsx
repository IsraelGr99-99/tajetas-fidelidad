import type { Metadata } from "next";
import { CustomerAccessView } from "@/app/tarjeta/acceso/view";

export const metadata: Metadata = { title: "Accede a tu tarjeta", robots: { index: false } };

export default async function BusinessCardAccessPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ salida?: string; eliminada?: string; desactivada?: string }>;
}) {
  const { slug } = await params;
  return CustomerAccessView({ businessSlug: slug, searchParams });
}
