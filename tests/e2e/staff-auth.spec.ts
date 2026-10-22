import { expect, test } from "@playwright/test";

/**
 * Flujos de acceso del personal sin credenciales reales. El inicio de sesión exitoso
 * se prueba manualmente con una cuenta de personal (no se guardan contraseñas en pruebas).
 */
test("la consola exige sesión y conserva el destino", async ({ page }) => {
  await page.goto("/personal/sucursal");
  await expect(page).toHaveURL(/\/personal\/ingresar\?siguiente=%2Fpersonal%2Fsucursal$/);
  await expect(page.getByRole("heading", { name: "Inicia tu turno" })).toBeVisible();
});

test("un destino externo en ?siguiente se ignora", async ({ page }) => {
  await page.goto("/personal/ingresar?siguiente=https://malicioso.example");
  await expect(page.getByRole("heading", { name: "Inicia tu turno" })).toBeVisible();
});

test("validación local: campos vacíos", async ({ page }) => {
  await page.goto("/personal/ingresar");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Next agrega su propio anunciador de rutas con role="alert"; se busca dentro del formulario.
  await expect(page.locator("form").getByRole("alert")).toHaveText("Escribe tu correo y tu contraseña.");
});

test("credenciales inválidas muestran un mensaje genérico", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Requiere Supabase configurado");
  await page.goto("/personal/ingresar");
  await page.getByLabel("Correo").fill("no-existe@ejemplo.test");
  await page.getByLabel("Contraseña").fill("ContrasenaIncorrecta123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(/Correo o contraseña incorrectos\.|Demasiados intentos/, {
    timeout: 20_000, // viaja a Supabase Auth real
  });
  await expect(page).toHaveURL(/\/personal\/ingresar/);
});

test("sin sesión, la página de sin acceso manda al login", async ({ page }) => {
  await page.goto("/personal/sin-acceso");
  await expect(page).toHaveURL(/\/personal\/ingresar/);
});
