declare module "./server/vite-plugin.mjs" {
  import type { Plugin } from "vite";
  export function adminAuthPlugin(): Plugin;
  export function resolveApiBaseUrl(): string;
}

declare module "../server/vite-plugin.mjs" {
  import type { Plugin } from "vite";
  export function adminAuthPlugin(): Plugin;
  export function resolveApiBaseUrl(): string;
}
