import type { Metadata } from "next";
import { PILOT_BUSINESS_SLUG } from "@/lib/business";
import { CustomerAccessView } from "./view";

export const metadata: Metadata = { title: "Accede a tu tarjeta" };

export default function CustomerAccessPage({ searchParams }: { searchParams: Promise<{ salida?: string; eliminada?: string; desactivada?: string }> }) {
  return CustomerAccessView({ businessSlug: PILOT_BUSINESS_SLUG, searchParams });
}
