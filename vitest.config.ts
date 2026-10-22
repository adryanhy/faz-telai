import { defineConfig } from "vitest/config";

// Testes unitários e de integração (Node). Os testes de navegador ficam em e2e/ com o Playwright.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "shared", include: ["shared/src/**/*.test.ts"], environment: "node" } },
      { test: { name: "server", include: ["server/src/**/*.test.ts"], environment: "node" } },
      { test: { name: "client", include: ["client/src/**/*.test.ts"], environment: "node" } },
    ],
  },
});
