import { defineConfig, devices } from "@playwright/test";

// Each checkout can pick its own port, so parallel e2e runs never share a server.
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://localhost:${port}/whynorun/`;

export default defineConfig({
  testDir: "playground/e2e",
  forbidOnly: !!process.env.CI,
  use: { baseURL },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: {
    command: `vite preview playground --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
