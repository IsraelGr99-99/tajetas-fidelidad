import { expect, test } from "@playwright/test";

/**
 * Flujos de acceso del personal sin credenciales reales. El inicio de sesión exitoso
 * se prueba manualmente con una cuenta de personal (no se guardan contraseñas en pruebas).
 */
test("la consola exige sesión y conserva el destino", async ({ page }) => {
  await page.goto("/negocio/catalogo");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/entrar");
  expect(url.searchParams.get("siguiente")).toBe("/negocio/catalogo");
  await expect(page.getByRole("heading", { name: "Inicia tu turno" })).toBeVisible();
});

test("un destino externo en ?siguiente se ignora", async ({ page }) => {
  await page.goto("/entrar?siguiente=https://malicioso.example");
  await expect(page.getByRole("heading", { name: "Inicia tu turno" })).toBeVisible();
});

test("validación local: campos vacíos", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Next agrega su propio anunciador de rutas con role="alert"; se busca dentro del formulario.
  await expect(page.locator("form").getByRole("alert")).toHaveText("Escribe tu correo y tu contraseña.");
});

test("credenciales inválidas muestran un mensaje genérico", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Requiere Supabase configurado");
  test.skip(Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), "CAPTCHA real activo; usar llaves de prueba para CI");
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill("no-existe@ejemplo.test");
  await page.getByLabel("Contraseña").fill("ContrasenaIncorrecta123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(/Correo o contraseña incorrectos\.|Demasiados intentos/, {
    timeout: 20_000, // viaja a Supabase Auth real
  });
  await expect(page).toHaveURL(/\/entrar/);
});

test("código por correo: misma respuesta para correos no autorizados (no revela quién es personal)", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SECRET_KEY, "Requiere la llave secreta del servidor");
  // Con CAPTCHA real activo, Turnstile puede marcar al navegador automatizado como bot.
  // Para probar este flujo en CI, usar las llaves de prueba de Cloudflare (docs/despliegue.md).
  test.skip(Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), "CAPTCHA real activo");
  await page.goto("/entrar");
  await page.getByRole("tab", { name: "Código por correo" }).click();
  // Correo distinto por corrida: el servidor limita a 5 solicitudes por correo y hora.
  await page.getByLabel("Correo con el que te invitaron").fill(`nadie-${Date.now()}-${Math.floor(Math.random() * 1e6)}@ejemplo.test`);
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByText(/está autorizado para el personal, te llegará un código/)).toBeVisible({ timeout: 20_000 });
});

test("sin sesión, la página de sin acceso manda al login", async ({ page }) => {
  await page.goto("/sin-acceso");
  await expect(page).toHaveURL(/\/entrar/);
});

test.describe("las secciones de la consola requieren sesión", () => {
  for (const path of ["/inicio", "/barra", "/caja", "/movimientos", "/negocio", "/negocio/finanzas", "/negocio/clientes", "/cuenta"]) {
    test(`${path} redirige al login`, async ({ page }) => {
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/entrar");
      expect(url.searchParams.get("siguiente")).toBe(path);
    });
  }
});

test.describe("las rutas anteriores siguen funcionando", () => {
  for (const [from, to] of [
    ["/personal/ingresar", "/entrar"],
    ["/personal/visita", "/barra"],
    ["/personal/admin/campana", "/negocio/programa"],
  ]) {
    test(`${from} → ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect([307, 308]).toContain(res.status());
      expect(new URL(res.headers().location, "http://x").pathname).toBe(to);
    });
  }
});
