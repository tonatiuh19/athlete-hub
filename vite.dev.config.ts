import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";
import { expressPlugin } from "./vite.express-plugin";

/** Local dev: Vite + Express API on :8081, proxied from :8080. */
export default mergeConfig(
  base,
  defineConfig({
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: "http://localhost:8081",
          changeOrigin: true,
          secure: false,
        },
      },
      fs: {
        allow: [".", "./client", "./shared"],
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
      },
    },
    plugins: [expressPlugin()],
  }),
);
