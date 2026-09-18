#!/usr/bin/env node
/**
 * verify-indexes.mjs
 *
 * Cross-checks every installed Bible translation against the bundled semantic
 * indexes in <repo>/resources/index. Verifies that each expected index exists
 * and that its baked verse count matches the translation's verse count.
 *
 * Usage:
 *   node scripts/verify-indexes.mjs
 *   node scripts/verify-indexes.mjs <translationsDir> <indexDir>
 *
 * Exit code: 0 = all OK, 1 = any missing or count-mismatched index.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TRANSLATIONS_DIR = path.join(os.homedir(), ".config", "scripture-caster", "translations");
const INDEX_DIR = path.join(ROOT, "resources", "index");

const translationsDir = process.argv[2] ?? TRANSLATIONS_DIR;
const indexDir = process.argv[3] ?? INDEX_DIR;

function verseCount(raw) {
  return Array.isArray(raw) ? raw.length : raw.data.length;
}

const ids = fs
  .readdirSync(translationsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .sort();

let ok = 0;
let missing = 0;
let mismatched = 0;

for (const id of ids) {
  const meta = path.join(indexDir, `${id}.all-MiniLM-L6-v2.json`);
  const bin = path.join(indexDir, `${id}.all-MiniLM-L6-v2.int8`);
  const label = id.padEnd(5, " ").slice(0, 5);
  if (!fs.existsSync(meta) || !fs.existsSync(bin)) {
    console.log(`MISSING  ${label} no bundled index`);
    missing++;
    continue;
  }
  let baked;
  try {
    baked = JSON.parse(fs.readFileSync(meta, "utf-8")).count;
  } catch {
    console.log(`MISSING  ${label} unreadable meta`);
    missing++;
    continue;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(translationsDir, `${id}.json`), "utf-8"));
  } catch {
    console.log(`MISSING  ${label} unreadable translation`);
    missing++;
    continue;
  }
  if (baked === verseCount(raw)) {
    console.log(`OK       ${label} baked=${baked} json=${verseCount(raw)}`);
    ok++;
  } else {
    console.log(`MISMATCH ${label} baked=${baked} json=${verseCount(raw)}`);
    mismatched++;
  }
}

console.log(`\n${ok} OK, ${mismatched} mismatch(es), ${missing} missing (of ${ids.length})`);
process.exit(missing > 0 || mismatched > 0 ? 1 : 0);