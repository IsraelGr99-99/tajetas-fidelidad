import type { Metadata, Viewport } from "next";
import { LoyaltyLanding } from "@/components/marketing/LoyaltyLanding";
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd";

export const metadata: Metadata = {
  title: { absolute: "Loyalty de iautomexa · Fidelidad, caja e inventario para negocios" },
  description: "Más que una tarjeta de fidelidad: Loyalty conecta caja, productos, recetas, inventario, reportes y recompensas para una o muchas sucursales. Solicita una demo guiada.",
  applicationName: "iautomexa Loyalty",
  alternates: { canonical: "https://loyalty.iautomexa.com/", languages: { "es-MX": "https://loyalty.iautomexa.com/", en: "https://loyalty.iautomexa.com/en" } },
  robots: { index: true, follow: true },
  openGraph: { url: "https://loyalty.iautomexa.com/", locale: "es_MX", type: "website", siteName: "iautomexa Loyalty", title: "Loyalty · Más que una tarjeta de fidelidad", description: "Caja, inventario, clientes y recompensas en un solo espacio. Tecnología de iautomexa." },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#fbfcff", width: "device-width", initialScale: 1 };

export default function Home() {
  return <><MarketingJsonLd locale="es" /><LoyaltyLanding locale="es" /></>;
}
