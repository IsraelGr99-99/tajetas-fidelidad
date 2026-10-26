import { expect, test } from "@playwright/test";

test("la portada presenta Loyalty como tecnología de iautomexa y enlaza al piloto", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/iautomexa Loyalty/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Haz que cada visita cuente");
  await expect(page.getByRole("link", { name: "Una tecnología de iautomexa", exact: true })).toHaveAttribute("href", "https://iautomexa.com/");
  await expect(page.getByRole("link", { name: "Agenda una demo" }).first()).toHaveAttribute("href", "https://iautomexa.com/contacto/");
  await expect(page.getByRole("figure", { name: /Ejemplo de tarjeta digital de lealtad/ })).toContainText("Vista ilustrativa");
  await expect(page.getByRole("link", { name: /Conoce el piloto Café Nómada/ })).toHaveAttribute("href", "/c/cafe-nomada");
  await page.getByRole("button", { name: /Restaurantes/ }).click();
  await expect(page.getByText("Cada mesa cuenta")).toBeVisible();
});

test("la versión en inglés cambia contenido e idioma del documento", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Make every visit count");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: /Technology by iautomexa/ }).first()).toHaveAttribute("href", "https://iautomexa.com/");
  await page.getByRole("link", { name: "Ver en español" }).click();
  await expect(page).toHaveURL("/");
});

test("la página de Café Nómada presenta el programa con CTA hacia iautomexa", async ({ page }) => {
  await page.goto("/c/cafe-nomada");
  await expect(page).toHaveTitle(/Café Nómada/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Historias que se cuentan taza a taza");
  // En escritorio también está en el encabezado; en celular, en el pie (siempre visible).
  await expect(page.getByRole("link", { name: "Hecho con iautomexa" })).toHaveAttribute("href", "https://iautomexa.com");
  // La tarjeta de la portada está marcada como ejemplo (no simula datos reales).
  await expect(page.getByRole("figure", { name: /Tarjeta de fidelidad de ejemplo/ })).toBeVisible();
  // El registro lleva al acceso con código.
  await expect(page.getByRole("link", { name: "Crear mi tarjeta" })).toHaveAttribute("href", "/tarjeta/acceso");
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
  // Nonce distinto por respuesta y sin 'unsafe-inline' en scripts.
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  const other = (await request.get("/")).headers()["content-security-policy"];
  expect(other).not.toBe(h["content-security-policy"]);
  expect(h["x-powered-by"]).toBeUndefined();
});

test("404 con estilo y regreso al inicio", async ({ page }) => {
  const res = await page.goto("/no-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
});

test("las páginas principales cargan sin violaciones de CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(m.text())) violations.push(m.text());
  });
  for (const path of ["/", "/c/cafe-nomada", "/tarjeta/acceso", "/entrar", "/privacidad"]) {
    await page.goto(path);
    await expect(page.locator("#contenido")).toBeVisible();
  }
  // La app hidrata: un botón interactivo responde (si los scripts se bloquearan, no lo haría).
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Código por correo" }).click();
  await expect(page.getByLabel("Correo con el que te invitaron")).toBeVisible();
  expect(violations).toEqual([]);
});
