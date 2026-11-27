import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Só para a avaliação (npm run avaliar): resolve "@/" e neutraliza "server-only". */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: raiz("../src/") },
      { find: /^server-only$/, replacement: raiz("./server-only.ts") },
    ],
  },
  test: { include: ["avaliacao/**/*.test.ts"], testTimeout: 60 * 60_000, hookTimeout: 60_000 },
});
