import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    locale: "ar-SA",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
})
