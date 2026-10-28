import type { MetadataRoute } from "next";

const base = "https://loyalty.iautomexa.com";
const languages = { "es-MX": `${base}/`, en: `${base}/en` };

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/`, alternates: { languages }, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/en`, alternates: { languages }, changeFrequency: "monthly", priority: 0.8 },
  ];
}
