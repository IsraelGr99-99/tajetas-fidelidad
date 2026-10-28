import { expect, test } from "@playwright/test";

test("la portada explica Loyalty y ofrece una demo pública sin cuenta", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Loyalty de iautomexa/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Haz que cada visita cuente");
  await expect(page.getByRole("link", { name: "Una tecnología de iautomexa", exact: true })).toHaveAttribute("href", "https://iautomexa.com/");
  await expect(page.getByRole("link", { name: "Probar demo interactiva" }).first()).toHaveAttribute("href", "#demo-interactiva");
  await expect(page.getByRole("link", { name: "Solicitar información" }).first()).toHaveAttribute("href", "https://iautomexa.com/contacto/");
  await expect(page.getByRole("figure", { name: /Ejemplo de tarjeta digital de lealtad/ })).toContainText("Vista ilustrativa");
  await expect(page.getByRole("heading", { name: "Una compra mueve mucho más que un sello." })).toBeVisible();
  await expect(page.locator("#como-funciona ol > li")).toHaveCount(3);
  await expect(page.getByRole("figure", { name: /Un flujo, no herramientas aisladas/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Ejemplos de tarjetas por giro" }).locator("li")).toHaveCount(5);
  if (isMobile) await expect(page.getByRole("button", { name: "Barberías" })).toBeVisible();
  else await expect(page.locator("#aplicaciones").getByText("Barberías", { exact: true }).first()).toBeVisible();
});

test("la demo ficticia conecta caja, inventario y fidelidad sin escribir datos", async ({ page }) => {
  await page.goto("/");
  const demo = page.locator("#demo-interactiva");
  await expect(demo.getByText("DEMO INTERACTIVA · DATOS FICTICIOS")).toBeVisible();
  const stock = demo.locator("article").filter({ hasText: "Porciones disponibles" });
  await expect(stock.getByText("12", { exact: true })).toBeVisible();
  await demo.getByRole("button", { name: "Simular una compra" }).click();
  await expect(stock.getByText("11", { exact: true })).toBeVisible();
  await expect(demo.getByRole("status")).toContainText("solo en esta pantalla");
  await demo.getByRole("button", { name: "Simular una compra" }).click();
  await expect(demo.getByText("Recompensa disponible en la simulación")).toBeVisible();
  await demo.getByRole("button", { name: "Reiniciar demo" }).click();
  await expect(stock.getByText("12", { exact: true })).toBeVisible();
});

test("las tarjetas avanzan con el scroll y respetan movimiento reducido", async ({ page, isMobile }) => {
  test.skip(isMobile, "ScrollTrigger fijado solo aplica en escritorio");
  await page.goto("/");
  const section = page.locator("#aplicaciones");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveClass(/_animated/);
  await page.mouse.wheel(0, 1200);
  await expect(section.locator('[class*="side"] p')).not.toHaveText("Barberías");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(section).not.toHaveClass(/_animated/);
  await expect(section.getByRole("listitem")).toHaveCount(5);
});

test("SEO público: canonicals, idiomas, datos estructurados y rutas privadas no indexadas", async ({ page, request }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://loyalty.iautomexa.com");
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"SoftwareApplication"');
  await page.goto("/en", { waitUntil: "domcontentloaded" });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://loyalty.iautomexa.com/en");
  await page.goto("/entrar", { waitUntil: "domcontentloaded" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  expect((await (await request.get("/sitemap.xml")).text())).toContain("https://loyalty.iautomexa.com/en");
  expect((await (await request.get("/robots.txt")).text())).toContain("https://loyalty.iautomexa.com/sitemap.xml");
});

test("la versión en inglés cambia contenido e idioma del documento", async ({ page }) => {
  await page.goto("/en", { waitUntil: "domcontentloaded" });
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
  await expect(page.getByRole("link", { name: "Volver a Loyalty" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Esta ruta tomó otro camino." })).toBeVisible();
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
