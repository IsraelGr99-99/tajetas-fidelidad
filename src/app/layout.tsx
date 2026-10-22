import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Café Nómada | Historias que se cuentan taza a taza",
  description: "Tu tarjeta de fidelidad digital de Café Nómada, San Pedro Cholula.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-MX"><body>{children}</body></html>;
}
