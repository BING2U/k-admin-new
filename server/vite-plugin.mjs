import { createAdminAuth, resolveApiBaseUrl } from "./auth.mjs";

export function adminAuthPlugin() {
  const { middleware } = createAdminAuth();
  return {
    name: "k-admin-local-auth",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}

export { resolveApiBaseUrl };
