/** Vite plugin: exposes /__app-env in dev from .grok/app-env.json */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function appEnvPlugin() {
  return {
    name: "app-env-plugin",
    configureServer(server) {
      server.middlewares.use("/__app-env", (_req, res) => {
        const p = resolve(process.cwd(), ".grok/app-env.json");
        let body = "{}";
        if (existsSync(p)) {
          try { body = readFileSync(p, "utf8"); } catch {}
        }
        res.setHeader("content-type", "application/json");
        res.end(body);
      });
    },
  };
}
