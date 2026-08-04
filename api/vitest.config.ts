import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["../tests/unit/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret-key-minimum-16-chars",
      WEBHOOK_SECRET: "test-webhook-secret",
      RESEND_API_KEY: "re_test_key",
    },
  },
});
