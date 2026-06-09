import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import http from "node:http";

const API_PORT = 8081;

// https://vitejs.dev/config/
export default defineConfig(() => ({
  envPrefix: ["VITE_", "CLERK_"],
  /** Static assets: `/public` at repo root (logos in `/public/brand/logos/`) */
  publicDir: path.resolve(__dirname, "public"),
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: [".", "./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor",
              test: /node_modules/,
            },
          ],
        },
      },
    },
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    async configureServer() {
      const { createServer } = await import("./api/index");
      const app = createServer();
      http.createServer(app).listen(API_PORT, () => {
        console.log(`✅ Express API → http://localhost:${API_PORT}`);
      });
    },
  };
}
