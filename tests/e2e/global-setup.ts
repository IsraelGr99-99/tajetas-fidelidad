import { chromium, type FullConfig } from "@playwright/test";

/**
 * Calentamiento: en Windows, las primeras navegaciones de un Chromium recién lanzado
 * pueden tardar más de 15 s (el servidor responde en milisegundos a curl). Se abre
 * una vez la app con margen amplio para que las pruebas midan la app y no ese arranque.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const path of ["/", "/tarjeta/acceso", "/entrar"]) {
      await page.goto(baseURL + path, { timeout: 90_000 });
    }
  } finally {
    await browser.close();
  }
}
