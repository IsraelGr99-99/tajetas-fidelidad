import type { Metadata, Viewport } from "next";
import { LoyaltyLanding } from "@/components/marketing/LoyaltyLanding";

export const metadata: Metadata = {
  title: { absolute: "iautomexa Loyalty · Lealtad digital para negocios" },
  description: "Loyalty, tecnología de iautomexa para programas de lealtad digitales. Registra compras, reconoce a tus clientes y dales una razón para volver, sin instalar una app.",
  applicationName: "iautomexa Loyalty",
  alternates: { canonical: "/", languages: { "es-MX": "/", en: "/en" } },
  openGraph: { locale: "es_MX", type: "website", siteName: "iautomexa Loyalty", title: "Loyalty · Tecnología de iautomexa", description: "Lealtad digital para negocios: tarjetas, visitas y recompensas claras en una sola experiencia." },
};

export const viewport: Viewport = { themeColor: "#fbfcff", width: "device-width", initialScale: 1 };

export default function Home() {
  return <LoyaltyLanding locale="es" />;
}
