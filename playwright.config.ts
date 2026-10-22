import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * Testes de ponta a ponta: sobem o app buildado (igual ao Render) e usam Chromium de verdade,
 * com duas "pessoas" (contextos separados) compartilhando e assistindo.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Sem isso o Chromium sem tela bloqueia vídeo com som tocando sozinho.
          args: ["--autoplay-policy=no-user-gesture-required"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: `http://localhost:${PORT}/health`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
