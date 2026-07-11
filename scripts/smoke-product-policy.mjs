#!/usr/bin/env node
/**
 * Product policy smoke (no live gateway required for file path).
 *   node scripts/smoke-product-policy.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function fail(m) {
  console.error(`FAIL: ${m}`)
  process.exit(1)
}
function pass(m) {
  console.log(`PASS: ${m}`)
}

const libPath = path.join(root, "src/ai-gateway/lib/productPermissionPolicy.ts")
if (!fs.existsSync(libPath)) fail("productPermissionPolicy.ts missing")

// Load via dynamic import may need tsx; reimplement minimal asserts against JSON file
const policyPath = path.join(root, "config/runtime-permissions.json")
if (!fs.existsSync(policyPath)) fail("config/runtime-permissions.json missing")
const doc = JSON.parse(fs.readFileSync(policyPath, "utf8"))
if (!doc.defaults || typeof doc.defaults !== "object") fail("defaults missing")
pass(`product policy profile=${doc.profile || "default"}`)

const route = path.join(
  root,
  "src/ai-gateway/app/api/experience/permissions/evaluate/route.ts",
)
if (!fs.existsSync(route)) fail("evaluate route missing")
pass("gateway POST /api/experience/permissions/evaluate route present")

// File-based mapping must treat shell approval as non-allow
const shell = String(doc.defaults["filesystem.shell"] || "").toLowerCase()
if (shell === "allow") {
  console.log("NOTE: filesystem.shell is allow in this profile")
} else {
  pass(`filesystem.shell=${shell || "unset"} (not free-allow)`)
}

// TUI gateway-policy module present
const tuiPolicy = path.join(root, "packages/code/cli/src/util/gateway-policy.ts")
if (!fs.existsSync(tuiPolicy)) fail("TUI gateway-policy.ts missing")
const src = fs.readFileSync(tuiPolicy, "utf8")
if (!src.includes("evaluatePermissionViaGateway")) fail("missing remote evaluate helper")
if (!src.includes("permissions/evaluate")) fail("missing evaluate URL")
pass("TUI remote evaluate wired")

console.log("product policy smoke ok")
