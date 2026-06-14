import type { Plugin } from "vite";
import http from "node:http";

const API_PORT = 8081;

/** Dev-only: runs the Express API alongside the Vite dev server. */
export function expressPlugin(): Plugin {
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
