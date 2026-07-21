// Contract sync/drift guard (spec §8.3 — "two divergent copies of an enum is
// the most reliable way to ship a production-only bug").
//
// The backend's server/src/shared/*.ts files are the SINGLE SOURCE OF TRUTH.
// The frontend consumes generated mirrors under src/shared/.
//
//   node scripts/enums-mirror.mjs          → regenerate the mirrors (sync)
//   node scripts/enums-mirror.mjs --check  → fail (exit 1) if a mirror drifted
//
// Wire the --check form into CI so a divergence can never merge.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SENTINEL = "// ─── mirror begins (generated) ───";

/*
 * Each contract file the backend owns and the frontend mirrors. `transform`
 * rewrites the backend source into its frontend form — today only the intra-
 * package import path differs (backend `./enums` → frontend `@/shared/enums`).
 * Everything after the SENTINEL is a byte-for-byte function of the backend
 * source, so the drift check can reconstruct the expected mirror and compare.
 */
const MIRRORS = [
  {
    source: resolve(here, "../server/src/shared/enums.ts"),
    mirror: resolve(here, "../src/shared/enums.ts"),
    transform: (src) => src,
  },
  {
    source: resolve(here, "../server/src/shared/rbac.ts"),
    mirror: resolve(here, "../src/shared/rbac.ts"),
    // The backend imports the enum contract by relative path; the frontend
    // mirror imports the enum *mirror* by alias. Nothing else changes.
    transform: (src) => src.replace(/from "\.\/enums"/g, 'from "@/shared/enums"'),
  },
];

const banner = (sourceRel) => `/*
 * AUTO-GENERATED MIRROR of ${sourceRel} — DO NOT EDIT BY HAND.
 * The backend copy is the single source of truth (spec §8.3).
 *   Regenerate:      npm run sync:enums
 *   CI drift guard:  npm run check:enums
 */
${SENTINEL}
`;

const repoRoot = resolve(here, "..");
const normalize = (s) => s.replace(/\r\n/g, "\n");
const rel = (p) => p.slice(repoRoot.length + 1);

const check = process.argv.includes("--check");
let failed = false;

for (const { source, mirror, transform } of MIRRORS) {
  const expectedBody = transform(normalize(readFileSync(source, "utf8")));
  const expected = banner(rel(source)) + expectedBody;

  if (check) {
    let actual;
    try {
      actual = normalize(readFileSync(mirror, "utf8"));
    } catch {
      console.error(`✗ contract drift: frontend mirror ${rel(mirror)} is missing. Run \`npm run sync:enums\`.`);
      failed = true;
      continue;
    }
    const mirrorBody = actual.split(SENTINEL + "\n")[1] ?? "";
    if (mirrorBody !== expectedBody) {
      console.error(`✗ contract drift: ${rel(mirror)} differs from ${rel(source)}.`);
      console.error("  The backend is the source of truth — run `npm run sync:enums` and review the diff.");
      failed = true;
      continue;
    }
    console.log(`✓ ${rel(mirror)} in sync with ${rel(source)}.`);
  } else {
    writeFileSync(mirror, expected, "utf8");
    console.log(`✓ wrote ${rel(mirror)} from ${rel(source)}.`);
  }
}

if (check && failed) process.exit(1);
