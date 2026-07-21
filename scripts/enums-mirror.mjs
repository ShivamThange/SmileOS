// Enum contract sync/drift guard (spec §8.3 — "two divergent copies of an enum
// is the most reliable way to ship a production-only bug").
//
// The backend's server/src/shared/enums.ts is the SINGLE SOURCE OF TRUTH.
// The frontend consumes a generated mirror at src/shared/enums.ts.
//
//   node scripts/enums-mirror.mjs          → regenerate the mirror (sync)
//   node scripts/enums-mirror.mjs --check  → fail (exit 1) if the mirror drifted
//
// Wire the --check form into CI so a divergence can never merge.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, "../server/src/shared/enums.ts");
const MIRROR = resolve(here, "../src/shared/enums.ts");
const SENTINEL = "// ─── mirror begins (generated) ───";

const BANNER = `/*
 * AUTO-GENERATED MIRROR of server/src/shared/enums.ts — DO NOT EDIT BY HAND.
 * The backend copy is the single source of truth (spec §8.3).
 *   Regenerate:      npm run sync:enums
 *   CI drift guard:  npm run check:enums
 */
${SENTINEL}
`;

const normalize = (s) => s.replace(/\r\n/g, "\n");

const source = normalize(readFileSync(SOURCE, "utf8"));
const expected = BANNER + source;

if (process.argv.includes("--check")) {
  let actual;
  try {
    actual = normalize(readFileSync(MIRROR, "utf8"));
  } catch {
    console.error("✗ enum drift: frontend mirror src/shared/enums.ts is missing. Run `npm run sync:enums`.");
    process.exit(1);
  }
  const mirrorBody = actual.split(SENTINEL + "\n")[1] ?? "";
  if (mirrorBody !== source) {
    console.error("✗ enum drift: src/shared/enums.ts differs from server/src/shared/enums.ts.");
    console.error("  The backend is the source of truth — run `npm run sync:enums` and review the diff.");
    process.exit(1);
  }
  console.log("✓ enum contract in sync (frontend mirror matches backend source).");
} else {
  writeFileSync(MIRROR, expected, "utf8");
  console.log("✓ wrote src/shared/enums.ts from server/src/shared/enums.ts");
}
