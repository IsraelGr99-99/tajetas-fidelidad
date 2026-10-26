import { expect, test } from "@playwright/test";

/**
 * Acceso del cliente sin enviar correos reales (para no generar rebotes en el
 * proveedor de correo). El envío y la verificación del código se prueban a mano.
 */
test("la tarjeta exige sesión", async ({ page }) => {
  await page.goto("/tarjeta");
  await expect(page).toHaveURL(/\/tarjeta\/acceso$/);
  await expect(page.getByRole("heading", { name: "Entra o crea tu tarjeta" })).toBeVisible();
});

test("correo por defecto; teléfono deshabilitado mientras no haya SMS", async ({ page }) => {
  await page.goto("/tarjeta/acceso");
  await expect(page.getByRole("radio", { name: "Correo" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Teléfono" })).toBeDisabled();
  await expect(page.getByText("Por ahora el registro es solo con correo.")).toBeVisible();
});

test("valida el correo antes de enviar", async ({ page }) => {
  await page.goto("/tarjeta/acceso");
  await page.getByLabel("Tu correo").fill("ana@");
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Escribe un correo válido");
});

test("el aviso de privacidad está publicado y marcado como borrador", async ({ page }) => {
  await page.goto("/privacidad");
  await expect(page.getByRole("heading", { level: 1, name: "Aviso de privacidad" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("pendiente de revisión legal");
});

test("desde la página de Café Nómada se llega al registro", async ({ page }) => {
  await page.goto("/c/cafe-nomada");
  await page.getByRole("link", { name: "Quiero mi tarjeta" }).click();
  // La página de acceso consulta la sesión en Supabase: dar margen a la red.
  await expect(page).toHaveURL(/\/tarjeta\/acceso$/, { timeout: 15_000 });
});
