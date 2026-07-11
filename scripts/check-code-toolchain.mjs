#!/usr/bin/env node
/**
 * Stable dual-toolchain check for the product terminal.
 *
 * Contract:
 *   - Root monorepo: Node + npm (agent, gateway, Control, public bin)
 *   - packages/code: Bun island (Code TUI)
 *
 *   node scripts/check-code-toolchain.mjs
 *   npm run code:toolchain:check
 *
 * Exit 0 when layout is OK. Missing Bun is a warning unless
 * ZAVORTH_TOOLCHAIN_REQUIRE_BUN=1.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const requireBun =
  process.env.ZAVORTH_TOOLCHAIN_REQUIRE_BUN === "1" ||
  process.env.ZAVORTH_TOOLCHAIN_REQUIRE_BUN === "true"

function pass(msg) {
  console.log(`PASS: ${msg}`)
}
function warn(msg) {
  console.log(`WARN: ${msg}`)
}
function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

const nodeOk = typeof process.versions.node === "string"
if (!nodeOk) fail("Node.js not available")
pass(`node ${process.versions.node}`)

const npmCliCandidates = [
  process.env.npm_execpath,
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
].filter(Boolean)
let npmOk = false
for (const c of npmCliCandidates) {
  if (c && fs.existsSync(c)) {
    npmOk = true
    pass(`npm-cli ${c}`)
    break
  }
}
if (!npmOk) warn("npm-cli.js not resolved next to node (ok if using corepack elsewhere)")

const codePkg = path.join(root, "packages", "code", "package.json")
const codeEntry = path.join(root, "packages", "code", "cli", "src", "index.ts")
if (!fs.existsSync(codePkg)) fail("packages/code/package.json missing")
if (!fs.existsSync(codeEntry)) fail("packages/code/cli/src/index.ts missing")
pass("packages/code layout (Bun island sources)")

const binZ = path.join(root, "bin", "zavorth.js")
if (!fs.existsSync(binZ)) fail("bin/zavorth.js missing")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const bins = pkg.bin || {}
if (Object.keys(bins).length !== 1 || !bins.zavorth) {
  fail(`public bin must be only zavorth, got ${JSON.stringify(bins)}`)
}
pass("single public bin.zavorth")

// Bun presence (no shell)
let bunOk = false
let bunVer = ""
const pathDirs = String(process.env.PATH || process.env.Path || "").split(path.delimiter)
const candidates = []
for (const dir of pathDirs) {
  if (!dir) continue
  for (const base of process.platform === "win32" ? ["bun.exe"] : ["bun"]) {
    const full = path.join(dir, base)
    if (fs.existsSync(full)) candidates.push(full)
  }
  if (process.platform === "win32") {
    const nested = path.join(dir, "node_modules", "bun", "bin", "bun.exe")
    if (fs.existsSync(nested)) candidates.push(nested)
  }
}
if (process.platform === "win32" && process.env.APPDATA) {
  const nested = path.join(process.env.APPDATA, "npm", "node_modules", "bun", "bin", "bun.exe")
  if (fs.existsSync(nested)) candidates.push(nested)
}
for (const bun of candidates) {
  const r = spawnSync(bun, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 4000,
  })
  if (!r.error && r.status === 0) {
    bunOk = true
    bunVer = String(r.stdout || "").trim()
    break
  }
}
// Prebuilt Code binary makes Bun optional at runtime
let binaryOk = false
try {
  const launch = require(path.join(root, "bin/lib/launch-code-tui.cjs"))
  const b = launch.resolveCompiledCodeBinary(root, process.env)
  binaryOk = Boolean(b && fs.existsSync(b))
  if (binaryOk) pass(`Code prebuilt binary: ${path.relative(root, b)}`)
} catch {
  /* ignore */
}

if (bunOk) pass(`bun ${bunVer}${binaryOk ? " (optional — binary present)" : ""}`)
else if (binaryOk) pass("Bun not required (prebuilt Code binary present)")
else if (requireBun) fail("Bun required (ZAVORTH_TOOLCHAIN_REQUIRE_BUN=1) but not found")
else warn("No Bun and no prebuilt Code binary — run npm run code:build or install Bun for source launch")

console.log("code toolchain check ok")
console.log(
  "Contract: root = Node/npm · Code TUI = prebuilt binary (release) or Bun+sources (dev) · public bin = zavorth only",
)
process.exit(0)
