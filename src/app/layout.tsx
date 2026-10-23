import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Courier_Prime, Figtree, Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Café Nómada · Tarjeta de fidelidad", template: "%s · Café Nómada" },
  description: "Historias que se cuentan taza a taza. Tu tarjeta de fidelidad digital de Café Nómada, San Pedro Cholula.",
  applicationName: "Café Nómada Fidelidad",
  openGraph: { locale: "es_MX", type: "website", siteName: "Café Nómada" },
  // Hasta que se autorice el piloto público, no indexar.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#3D2C24",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // La CSP usa un nonce por petición: todas las páginas se renderizan bajo demanda.
  await connection();
  return (
    <html lang="es-MX" data-scroll-behavior="smooth" className={`${fraunces.variable} ${figtree.variable} ${courier.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-tabaco focus:px-5 focus:py-3 focus:text-crema"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
