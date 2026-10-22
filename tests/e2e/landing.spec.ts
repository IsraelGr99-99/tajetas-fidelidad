import { expect, test } from "@playwright/test";

test("la landing presenta el programa con CTA hacia iautomexa", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Café Nómada/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Historias que se cuentan taza a taza");
  await expect(page.getByRole("link", { name: "Conoce iautomexa" })).toHaveAttribute("href", "https://iautomexa.com");
  await expect(page.getByRole("link", { name: "Conoce la tecnología detrás" })).toHaveAttribute("href", "https://iautomexa.com");
  // La tarjeta de la portada está marcada como ejemplo (no simula datos reales).
  await expect(page.getByRole("figure", { name: /Tarjeta de fidelidad de ejemplo/ })).toBeVisible();
  // El registro aún no está habilitado y se dice con claridad.
  await expect(page.getByText("Piloto en preparación")).toBeVisible();
});

test("navegación por teclado: enlace para saltar al contenido", async ({ page, isMobile }) => {
  test.skip(isMobile, "Solo aplica con teclado físico");
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

test("sin desbordamiento horizontal en móvil", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("cabeceras de seguridad presentes", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("404 con estilo y regreso al inicio", async ({ page }) => {
  const res = await page.goto("/no-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
});
