import { defineConfig, devices } from "@playwright/test";

// Carga `.env.local` si existe (Node 20.12+), para saber si Supabase está configurado.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin `.env.local`: las pruebas que requieren Supabase se omiten.
}

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // En Windows el primer arranque de Chromium en paralelo puede tardar; margen amplio.
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "retain-on-failure",
    navigationTimeout: 45_000,
  },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"] } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Prueba contra el build de producción (requiere `npm run build` antes).
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
