#!/usr/bin/env node
/**
 * Smoke: packaging posture for Code TUI in monorepo.
 *
 *   node scripts/smoke-code-packaging.mjs
 *   npm run code:packaging:smoke
 *
 * Windows-stable: runs `npm pack --dry-run --json` via
 *   spawnSync(process.execPath, [npmCliJs, ...], { shell: false })
 * so paths with spaces / npm.cmd EINVAL do not soft-skip forever.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}
function pass(msg) {
  console.log(`PASS: ${msg}`)
}

/**
 * Resolve npm-cli.js next to the running Node binary (or npm_execpath).
 * Prefer spawning `node npm-cli.js …` over `npm.cmd` so Windows paths with
 * spaces never hit EINVAL when shell is false.
 */
function resolveNpmCliJs() {
  const fromEnv = process.env.npm_execpath
  if (fromEnv && fs.existsSync(fromEnv) && /npm-cli\.js$/i.test(fromEnv)) {
    return path.resolve(fromEnv)
  }

  const base = path.dirname(process.execPath)
  const candidates = [
    // Standard Node install (Windows / Unix prefix)
    path.join(base, "node_modules", "npm", "bin", "npm-cli.js"),
    // Some Unix layouts: <prefix>/bin/node + <prefix>/lib/node_modules/npm
    path.join(base, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ]

  if (fromEnv && fs.existsSync(fromEnv)) {
    candidates.unshift(path.resolve(fromEnv))
  }

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return path.resolve(c)
    } catch {
      /* ignore */
    }
  }
  return null
}

function cleanupPackTarballs() {
  // Never leave accidental pack artifacts in the repo root.
  let removed = 0
  for (const name of fs.readdirSync(root)) {
    if (!/^zavorth(-[\w.-]+)...\.tgz$/i.test(name)) continue
    try {
      fs.unlinkSync(path.join(root, name))
      removed += 1
    } catch {
      /* ignore */
    }
  }
  return removed
}

function runPackDryRun() {
  const npmCli = resolveNpmCliJs()
  const packArgs = ["pack", "--dry-run", "--json"]
  const attempts = []

  if (npmCli) {
    attempts.push({
      label: `node ${npmCli}`,
      cmd: process.execPath,
      args: [npmCli, ...packArgs],
      shell: false,
    })
  }

  // Fallbacks: still prefer shell:false; shell only as last resort
  const base = path.dirname(process.execPath)
  const npmCmd = path.join(base, process.platform === "win32" ? "npm.cmd" : "npm")
  if (fs.existsSync(npmCmd)) {
    attempts.push({
      label: npmCmd,
      cmd: npmCmd,
      args: packArgs,
      shell: false,
    })
  }
  attempts.push({
    label: "npm (shell)",
    cmd: process.platform === "win32" ? "npm.cmd" : "npm",
    args: packArgs,
    shell: true,
  })

  const errors = []
  for (const a of attempts) {
    const pack = spawnSync(a.cmd, a.args, {
      cwd: root,
      encoding: "utf8",
      shell: a.shell,
      // JSON listing can be multi-MB with packages/code sources.
      maxBuffer: 32 * 1024 * 1024,
      timeout: 180_000,
      windowsHide: true,
      env: {
        ...process.env,
        npm_config_loglevel: "error",
        // Keep dry-run lean: prepack would rebuild / re-check the whole monorepo.
        // This smoke validates files[] packing posture, not the build lifecycle.
        npm_config_ignore_scripts: "true",
      },
    })
    if (!pack.error && pack.status === 0) {
      return { pack, via: a.label, npmCli }
    }
    const detail = pack.error
      ? pack.error.message
      : `status=${pack.status}\n${(pack.stderr || pack.stdout || "").slice(0, 400)}`
    errors.push(`${a.label}: ${detail}`)
  }

  return {
    pack: {
      status: 1,
      error: new Error(errors.join("\n---\n")),
      stdout: "",
      stderr: errors.join("\n---\n"),
    },
    via: null,
    npmCli,
  }
}

/** Extract packed path strings from npm pack --json output (or notice text fallback). */
function extractPackedPaths(stdout, stderr) {
  const raw = `${stdout || ""}\n${stderr || ""}`.trim()
  const paths = new Set()

  // Prefer JSON: [{ files: [{ path }], filename, ? }]
  const jsonStart = raw.indexOf("[")
  const jsonEnd = raw.lastIndexOf("]")
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue
        if (typeof entry.filename === "string") paths.add(entry.filename)
        const files = Array.isArray(entry.files) ? entry.files : []
        for (const f of files) {
          if (f && typeof f.path === "string") paths.add(f.path.replace(/\\/g, "/"))
        }
      }
      if (paths.size > 0) return { paths, mode: "json" }
    } catch {
      /* fall through to text scan */
    }
  }

  // Text fallback: npm notice lines / plain listing
  for (const line of raw.split(/\r...\n/)) {
    const m =
      line.match(/npm notice\s+\d+\s+(.+)$/i) ||
      line.match(/^\s*([^\s].*...(?:bin[/\\]zavorth\.js|packages[/\\]code[/\\].*))$/i)
    if (m) paths.add(m[1].trim().replace(/\\/g, "/"))
    if (/bin[/\\]zavorth\.js/i.test(line)) paths.add("bin/zavorth.js")
    if (/packages[/\\]code[/\\]cli[/\\]src/i.test(line)) paths.add("packages/code/cli/src")
  }
  return { paths, mode: "text" }
}

// --- policy: single public bin ---
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
if (!pkg.bin || Object.keys(pkg.bin).length !== 1 || !pkg.bin.zavorth) {
  fail(`expected single bin.zavorth, got ${JSON.stringify(pkg.bin)}`)
}
if (pkg.bin.zavorth !== "./bin/zavorth.js") {
  fail(`bin.zavorth must be ./bin/zavorth.js, got ${pkg.bin.zavorth}`)
}
pass("single public bin.zavorth")

const indexTs = path.join(root, "packages/code/cli/src/index.ts")
if (!fs.existsSync(indexTs)) fail("packages/code/cli/src/index.ts missing from monorepo tree")
pass("Code TUI entry present in monorepo")

// Launch resolver must find Code tree without a second public bin
const launchMod = require(path.join(root, "bin/lib/launch-code-tui.cjs"))
const tree = launchMod.resolveCodeTree(root, process.env)
if (!tree || !tree.entry) fail("resolveCodeTree failed for monorepo root")
if (!fs.existsSync(tree.entry)) fail(`resolveCodeTree entry missing: ${tree.entry}`)
pass(`resolveCodeTree → ${path.relative(root, tree.codeRoot)}`)

const entryResolve = require(path.join(root, "bin/lib/resolve-zavorth-entry.cjs"))
const legacyWord = entryResolve.resolveEntryMode(["legacy", "doctor"], {})
if (legacyWord.mode === "agent" || legacyWord.mode === "legacy") {
  fail("public argv 'legacy' must not enter agent hatch (use __agent only)")
}
const agentWord = entryResolve.resolveEntryMode(["__agent", "x"], {})
if (agentWord.mode !== "agent" && agentWord.mode !== "legacy") {
  fail("__agent must enter agent runtime hatch")
}
const envAgent = entryResolve.resolveEntryMode([], { ZAVORTH_AGENT_RUNTIME: "1" })
if (envAgent.mode !== "agent" && envAgent.mode !== "legacy") {
  fail("ZAVORTH_AGENT_RUNTIME=1 must enter agent hatch")
}
pass("entry hatch: __agent / ZAVORTH_AGENT_RUNTIME (not public 'legacy')")
const compiled = launchMod.resolveCompiledCodeBinary(root, process.env)
if (compiled) pass(`compiled Code binary found: ${path.relative(root, compiled)}`)
else pass("compiled Code binary not built yet (run npm run code:ensure)")
// ensure script must exist for auto binary path
if (!fs.existsSync(path.join(root, "scripts/ensure-code-runtime.mjs"))) {
  fail("scripts/ensure-code-runtime.mjs missing")
}
pass("ensure-code-runtime.mjs present")

for (const rel of [
  "scripts/lib/zavorth-runtime-bridge.mjs",
  "scripts/lib/zavorth-approvals.mjs",
  "bin/lib/launch-code-tui.cjs",
  "bin/lib/zavorth-capabilities.cjs",
]) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing ${rel}`)
}
pass("launch + bridge scripts present")

const files = Array.isArray(pkg.files) ? pkg.files : []
// Prebuilt Code binaries must be shippable (not excluded)
if (files.some((f) => f === "!packages/code/**/dist/**" || f === "!packages/code/cli/dist/**")) {
  fail("package.json files[] must not exclude packages/code/cli/dist (release ships Code binaries)")
}
if (!files.some((f) => f === "packages/code/cli/dist/**" || f.includes("packages/code/cli/dist"))) {
  fail("package.json files[] must include packages/code/cli/dist/** for release binaries")
}
pass("files[] allows packages/code/cli/dist (Code TUI binaries)")
const shipsCode =
  files.some((f) => String(f).replace(/\\/g, "/").includes("packages/code")) ||
  files.includes("packages/code/") ||
  files.includes("packages/code/**")

if (shipsCode) {
  pass("package.json files includes packages/code (published with TUI sources)")
} else {
  pass("package.json files omits packages/code (monorepo+Bun install path — see packaging doc)")
}

cleanupPackTarballs()

const { pack, via, npmCli } = runPackDryRun()
const packOut = `${pack.stdout || ""}\n${pack.stderr || ""}`

if (pack.status !== 0 || pack.error) {
  const err = pack.error ? pack.error.message : `status=${pack.status}`
  const hint = npmCli ? `resolved npm-cli.js=${npmCli}`
    : "could not resolve npm-cli.js next to process.execPath"
  if (shipsCode) {
    fail(
      `npm pack --dry-run failed while package.json files[] ships packages/code (${hint})\n${err}\n${packOut.slice(0, 800)}`,
    )
  }
  console.log(`WARN: npm pack --dry-run failed (${err}); files[] does not claim packages/code`)
  pass("npm pack dry-run soft-skip (files[] omits packages/code)")
  console.log("code packaging smoke ok")
  process.exit(0)
}

pass(`npm pack --dry-run via ${via || "npm"}`)

const { paths: packedPaths, mode } = extractPackedPaths(pack.stdout, pack.stderr)
const packedList = [...packedPaths]

const hasBin =
  packedList.some((p) => p === "bin/zavorth.js" || p.endsWith("/bin/zavorth.js")) ||
  packedList.some((p) => /(?:^|\/)bin\/zavorth\.js$/i.test(p))
if (!hasBin) {
  fail(
    `npm pack dry-run missing bin/zavorth.js (mode=${mode}, entries=${packedList.length})\n${packOut.slice(0, 500)}`,
  )
}
pass("npm pack --dry-run includes bin/zavorth.js")

if (shipsCode) {
  const hasCodeCliSrc = packedList.some(
    (p) =>
      p === "packages/code/cli/src" ||
      p.startsWith("packages/code/cli/src/") ||
      p.includes("packages/code/cli/src/"),
  )
  if (!hasCodeCliSrc) {
    fail(
      `npm pack dry-run missing packages/code/cli/src (files[] claims packages/code; mode=${mode}, entries=${packedList.length})\n${packOut.slice(0, 500)}`,
    )
  }
  pass("npm pack dry-run includes packages/code/cli/src")
}

const cleaned = cleanupPackTarballs()
if (cleaned > 0) {
  console.log(`cleaned ${cleaned} accidental pack tarball(s)`)
}

console.log("code packaging smoke ok")
