import type { Metadata, Viewport } from "next";
import { LoyaltyLanding } from "@/components/marketing/LoyaltyLanding";
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd";

export const metadata: Metadata = {
  title: { absolute: "Loyalty by iautomexa · Loyalty, checkout and inventory" },
  description: "More than a digital loyalty card: Loyalty connects checkout, inventory, customers and rewards. Explore a no-signup interactive demo and discover the business dashboard.",
  applicationName: "iautomexa Loyalty",
  alternates: { canonical: "https://loyalty.iautomexa.com/en", languages: { "es-MX": "https://loyalty.iautomexa.com/", en: "https://loyalty.iautomexa.com/en" } },
  robots: { index: true, follow: true },
  openGraph: { url: "https://loyalty.iautomexa.com/en", locale: "en_US", type: "website", siteName: "iautomexa Loyalty", title: "Loyalty · More than a loyalty card", description: "Checkout, inventory, customers and rewards in one workspace. Technology by iautomexa." },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#fbfcff", width: "device-width", initialScale: 1 };

export default function EnglishLanding() {
  return <><MarketingJsonLd locale="en" /><LoyaltyLanding locale="en" /></>;
}
