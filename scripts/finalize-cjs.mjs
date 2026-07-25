// The package is "type": "module", so the CommonJS build needs its own
// package.json to stop Node reading dist/cjs/*.js as ESM.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, "dist", "cjs");
mkdirSync(target, { recursive: true });
writeFileSync(
  join(target, "package.json"),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
);
