#!/usr/bin/env node
/**
 * Atalho para o grupo da Reforma (EC 132/2023 e LC 214/2025). Equivale a:
 *   node scripts/carregar-base.mjs --grupo reforma [--pasta …] [--simular]
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const base = fileURLToPath(new URL("./carregar-base.mjs", import.meta.url));
const r = spawnSync(process.execPath, [base, "--grupo", "reforma", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
