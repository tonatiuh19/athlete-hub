process.env.ATHLETE_HUB_TEST_MODE = "1";
process.env.DB_HOST = "test-local";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "test";
process.env.JWT_SECRET = "vitest-jwt-secret-not-for-production";
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_PUBLISHABLE_KEY = "";
process.env.VITE_STRIPE_PUBLISHABLE_KEY = "";
process.env.STRIPE_TEST_SECRET_KEY = "";
process.env.STRIPE_TEST_PUBLISHABLE_KEY = "";
process.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_smoke";
process.env.CRON_SECRET = "";

import { vi } from "vitest";

vi.stubEnv("NODE_ENV", "test");
