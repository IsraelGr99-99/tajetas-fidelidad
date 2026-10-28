import { headers } from "next/headers";

type Locale = "es" | "en";

export async function MarketingJsonLd({ locale }: { locale: Locale }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const english = locale === "en";
  const url = `https://loyalty.iautomexa.com${english ? "/en" : "/"}`;
  const description = english
    ? "Loyalty by iautomexa connects digital loyalty cards with checkout, inventory, customers, and business insights in one workspace."
    : "Loyalty de iautomexa conecta tarjetas de fidelidad digital con caja, inventario, clientes y datos del negocio en un solo espacio.";
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": "https://iautomexa.com/#organization", name: "iautomexa", url: "https://iautomexa.com/" },
      {
        "@type": "SoftwareApplication", "@id": "https://loyalty.iautomexa.com/#software",
        name: "Loyalty", applicationCategory: "BusinessApplication", operatingSystem: "Web",
        description, provider: { "@id": "https://iautomexa.com/#organization" },
        url: "https://loyalty.iautomexa.com/",
      },
      {
        "@type": "WebPage", "@id": `${url}#webpage`, url,
        name: english ? "Loyalty by iautomexa · Digital loyalty and business operations" : "Loyalty de iautomexa · Fidelidad y operación para negocios",
        description, inLanguage: english ? "en" : "es-MX", about: { "@id": "https://loyalty.iautomexa.com/#software" },
      },
    ],
  };
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
