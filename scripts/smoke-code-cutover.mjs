#!/usr/bin/env node
/**
 * Smoke: Code CLI cutover — monorepo is source of truth; single public bin.
 *
 *   node scripts/smoke-code-cutover.mjs
 *   npm run code:cutover:smoke
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

function pass(msg) {
  console.log(`PASS: ${msg}`)
}

const check = spawnSync(
  process.execPath,
  [path.join(root, "scripts/sync-zavorth-code-from-sibling.mjs"), "--check"],
  { cwd: root, encoding: "utf8" },
)
if (check.status !== 0) {
  console.error(check.stdout || "")
  console.error(check.stderr || "")
  fail("sync --check failed")
}
pass("sync --check (SoT + single bin markers)")

const sot = path.join(root, "packages/code/SOURCE-OF-TRUTH.md")
if (!fs.existsSync(sot)) fail("SOURCE-OF-TRUTH.md missing")
const sotText = fs.readFileSync(sot, "utf8")
if (!/source of truth/i.test(sotText) || !/packages\/code/i.test(sotText)) {
  fail("SOURCE-OF-TRUTH.md content incomplete")
}
pass("SOURCE-OF-TRUTH.md present")

const manifestPath = path.join(root, "packages/code/SYNC-MANIFEST.json")
if (fs.existsSync(manifestPath)) {
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  if (m.sourceOfTruth !== "monorepo") {
    fail(`SYNC-MANIFEST sourceOfTruth=${m.sourceOfTruth}`)
  }
  if (m.binaryPolicy?.separateCodingBin === true) {
    fail("manifest still claims separate coding bin")
  }
  pass("SYNC-MANIFEST.json cutover fields")
} else {
  pass("SYNC-MANIFEST.json optional until first --check write")
}

// Help without direction should exit 2 (no silent overwrite)
const help = spawnSync(
  process.execPath,
  [path.join(root, "scripts/sync-zavorth-code-from-sibling.mjs")],
  { cwd: root, encoding: "utf8" },
)
if (help.status !== 2) {
  fail(`sync without flags should exit 2, got ${help.status}`)
}
if (!/SOURCE OF TRUTH/i.test(help.stderr || help.stdout || "")) {
  fail("sync without flags should mention source of truth")
}
pass("sync without flags refuses silent overwrite")

console.log("code cutover smoke ok")
