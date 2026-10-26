import type { Metadata, Viewport } from "next";
import { LoyaltyLanding } from "@/components/marketing/LoyaltyLanding";

export const metadata: Metadata = {
  title: { absolute: "iautomexa Loyalty · Digital loyalty for businesses" },
  description: "Loyalty by iautomexa helps businesses create digital loyalty programs. Record purchases, recognize customers, and give them a reason to return—no app required.",
  applicationName: "iautomexa Loyalty",
  alternates: { canonical: "/en", languages: { "es-MX": "/", en: "/en" } },
  openGraph: { locale: "en_US", type: "website", siteName: "iautomexa Loyalty", title: "Loyalty · Technology by iautomexa", description: "Digital loyalty for businesses: cards, visits, and clear rewards in one experience." },
};

export const viewport: Viewport = { themeColor: "#fbfcff", width: "device-width", initialScale: 1 };

export default function EnglishLanding() {
  return <LoyaltyLanding locale="en" />;
}
