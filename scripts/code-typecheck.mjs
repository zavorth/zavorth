#!/usr/bin/env node
/**
 * packages/code typecheck — full project preferred, resilient Windows fallbacks.
 *
 *   node scripts/code-typecheck.mjs
 *   npm run code:typecheck
 *   npm run code:typecheck:full   # reinstall type toolchain then check
 *
 * Preference order:
 *   1) bun run typecheck in packages/code (tsgo / package script)
 *   2) tsc -p tsconfig.json (cli)
 *   3) tsc -p tsconfig.ci.json (standalone full-ish src check)
 *   4) tsc -p tsconfig.typecheck.json (narrow slice) — local / ALLOW_SLICE only
 *
 * CI (CI=true|1): hard-fail if tools missing or full typecheck fails.
 * Local: try full; if only the slice succeeds, exit 0 when not CI or when
 *   ZAVORTH_TYPECHECK_ALLOW_SLICE=1 (with a clear warning).
 *
 * Env:
 *   ZAVORTH_TYPECHECK_FULL=1         same as --full
 *   ZAVORTH_TYPECHECK_ALLOW_SLICE=1  allow slice success even on CI (debug only)
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const codeRoot = path.join(root, "packages", "code")
const cliRoot = path.join(codeRoot, "cli")
const isCI = process.env.CI === "true" || process.env.CI === "1"
const full = process.argv.includes("--full") || process.env.ZAVORTH_TYPECHECK_FULL === "1"
const allowSlice =
  process.env.ZAVORTH_TYPECHECK_ALLOW_SLICE === "1" ||
  process.env.ZAVORTH_TYPECHECK_ALLOW_SLICE === "true" ||
  !isCI
const win = process.platform === "win32"

/**
 * Resolve bun executable. Prefer bun.exe (no shell) so paths with spaces stay intact.
 * @returns {{ cmd: string, shell: boolean }}
 */
function resolveBun() {
  if (!win) return { cmd: "bun", shell: false }
  try {
    const where = spawnSync("where.exe", ["bun"], { encoding: "utf8", windowsHide: true })
    const lines = (where.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    const exe = lines.find((l) => /\.exe$/i.test(l) && !/\.cmd$/i.test(l))
    if (exe && fs.existsSync(exe)) return { cmd: exe, shell: false }
    const cmdShim = lines.find((l) => /\.cmd$/i.test(l))
    if (cmdShim) return { cmd: cmdShim, shell: true }
  } catch {
    // fall through
  }
  return { cmd: "bun.cmd", shell: true }
}

const bun = resolveBun()

/**
 * Spawn with cwd set on the options object (never via `--cwd path with spaces` shell-split).
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @param {{ shell?: boolean }} [opts]
 */
function run(cmd, args, cwd, opts = {}) {
  return spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: opts.shell ?? false,
    env: process.env,
    windowsHide: true,
  })
}

/** @param {string[]} args @param {string} cwd */
function runBun(args, cwd) {
  return run(bun.cmd, args, cwd, { shell: bun.shell })
}

/** @param {string} msg */
function fail(msg) {
  console.error(`code:typecheck FAIL: ${msg}`)
  process.exit(1)
}

/** @param {string} msg */
function ok(msg) {
  console.log(`code:typecheck OK (${msg})`)
  process.exit(0)
}

/** @param {string} p */
function readableFile(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK)
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

/** @param {string} p */
function readableDir(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK)
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** @param {import("node:child_process").SpawnSyncReturns<string>} r */
function combinedOutput(r) {
  return `${r.stdout || ""}\n${r.stderr || ""}\n${r.error ? r.error.message : ""}`
}

/**
 * True only when the typecheck *tool* failed to start — not when tsc/tsgo reported TS* errors.
 * @param {import("node:child_process").SpawnSyncReturns<string>} r
 */
function isToolMissing(r) {
  if (r.error) {
    if (r.error.code === "ENOENT") return true
    if (/ENOENT|not recognized|is not recognized/i.test(r.error.message || "")) return true
  }
  const text = combinedOutput(r)

  // Real compiler diagnostics mean the tool ran.
  if (/\berror TS\d+:/i.test(text)) return false

  if (/Cannot find module ['"][^'"]*@typescript[/\\]native-preview/i.test(text)) return true
  if (/Unable to resolve @typescript\/native-preview/i.test(text)) return true
  if (/Executable not found:.*tsgo/i.test(text)) return true
  if (/(^|[\s'"])tsgo(\.js|\.exe)?\b.*\b(is not recognized|not found|ENOENT)/i.test(text)) return true
  if (/error: Script not found ["']typecheck["']/i.test(text)) return true
  if (/spawn\s+\S*bun\S*\s+ENOENT/i.test(text)) return true
  if (r.status === null && !text.trim()) return true
  return false
}

function findTsc() {
  const candidates = [
    path.join(cliRoot, "node_modules", "typescript", "bin", "tsc"),
    path.join(codeRoot, "node_modules", "typescript", "bin", "tsc"),
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
  ]
  for (const p of candidates) {
    if (readableFile(p)) return p
  }

  const bunStore = path.join(codeRoot, "node_modules", ".bun")
  if (readableDir(bunStore)) {
    try {
      for (const name of fs.readdirSync(bunStore)) {
        if (!name.startsWith("typescript@")) continue
        const p = path.join(bunStore, name, "node_modules", "typescript", "bin", "tsc")
        if (readableFile(p)) return p
      }
    } catch {
      // ignore
    }
  }
  return null
}

function tsgoJsPath() {
  const p = path.join(cliRoot, "node_modules", "@typescript", "native-preview", "bin", "tsgo.js")
  return readableFile(p) ? p : null
}

/** @param {string} reason */
function ensureTypeToolchain(reason) {
  console.warn(`code:typecheck: ensuring typescript toolchain in packages/code/cli (${reason})…`)
  // cwd = cliRoot (options), never shell-split --cwd with spaces
  const add = runBun(
    [
      "add",
      "-d",
      "typescript@5.8.2",
      "@tsconfig/bun@1.0.9",
      "@typescript/native-preview@7.0.0-dev.20251207.1",
    ],
    cliRoot,
  )
  if (add.status !== 0) {
    console.warn(add.stderr || add.stdout || "bun add failed (continuing with whatever is on disk)")
    return false
  }
  return true
}

/**
 * @param {string} tscPath
 * @param {string} projectRel
 */
function runTsc(tscPath, projectRel) {
  return run(process.execPath, [tscPath, "--noEmit", "-p", projectRel], cliRoot, { shell: false })
}

/** @param {import("node:child_process").SpawnSyncReturns<string>} r */
function printRun(r) {
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.error) console.error(r.error.message)
}

if (!readableDir(codeRoot)) {
  fail(`packages/code missing at ${codeRoot}`)
}

if (full || !tsgoJsPath() || !findTsc()) {
  if (full || !tsgoJsPath()) {
    ensureTypeToolchain(full ? "--full" : "tsgo/tsc missing")
  } else if (!findTsc()) {
    ensureTypeToolchain("tsc missing")
  }
}

// 1) Preferred: package script (tsgo via packages/code → cli)
let r = runBun(["run", "typecheck"], codeRoot)
if (r.status === 0) ok("bun packages/code typecheck")

if (isToolMissing(r)) {
  console.warn("code:typecheck: primary typecheck unavailable; repairing toolchain…")
  printRun(r)
  ensureTypeToolchain("primary typecheck tool missing")
  r = runBun(["run", "typecheck"], codeRoot)
  if (r.status === 0) ok("bun packages/code typecheck (after toolchain repair)")
}

const primaryHadTypeErrors = !isToolMissing(r) && r.status !== 0
if (primaryHadTypeErrors) {
  // Real type errors from full project check (tsgo ran successfully as a tool)
  printRun(r)
  if (isCI && process.env.ZAVORTH_TYPECHECK_ALLOW_SLICE !== "1") {
    fail(`bun typecheck exited ${r.status} (full project)`)
  }
  console.warn(
    "code:typecheck: full project typecheck reported errors; trying monorepo-runtime slice if allowed…",
  )
} else if (isToolMissing(r)) {
  console.warn("code:typecheck: tsgo still unavailable after repair; trying tsc fallbacks…")
  printRun(r)
}

// 2–3) tsc full / ci configs (skip if tsgo already produced full-project diagnostics)
/** @type {import("node:child_process").SpawnSyncReturns<string> | null} */
let lastFull = primaryHadTypeErrors ? r : null
let tsc = findTsc()

if (!primaryHadTypeErrors) {
  if (!tsc && (full || !isCI)) {
    ensureTypeToolchain("tsc still missing")
    tsc = findTsc()
  }

  if (!tsc) {
    if (isCI) fail("typescript/tsc not found (CI requires working typecheck toolchain)")
    console.warn("code:typecheck SOFT-SKIP: no tsgo/tsc. Run: npm run code:typecheck:full")
    process.exit(0)
  }

  const fullProjects = ["tsconfig.json", "tsconfig.ci.json"]
  for (const proj of fullProjects) {
    const projPath = path.join(cliRoot, proj)
    if (!readableFile(projPath)) continue
    console.log(`code:typecheck: tsc -p ${proj}`)
    lastFull = runTsc(tsc, proj)
    if (lastFull.status === 0) ok(`tsc -p ${proj}`)
  }

  if (lastFull) printRun(lastFull)
} else if (!tsc) {
  tsc = findTsc()
}

// 4) Narrow slice (product/monorepo-runtime subset)
const sliceConfig = path.join(cliRoot, "tsconfig.typecheck.json")
if (readableFile(sliceConfig)) {
  const slice = runTsc(tsc, "tsconfig.typecheck.json")
  if (slice.status === 0) {
    if (allowSlice) {
      console.warn(
        "code:typecheck: full project check did not pass; monorepo-runtime slice OK" +
          (isCI ? " (ALLOW_SLICE)" : " (local)"),
      )
      console.warn(
        "code:typecheck: strict full gate = CI=true without ZAVORTH_TYPECHECK_ALLOW_SLICE; repair tools with npm run code:typecheck:full",
      )
      ok("tsc -p tsconfig.typecheck.json (slice)")
    }
    fail("full typecheck failed; slice would pass but is not allowed on CI (unset ALLOW_SLICE)")
  }
  printRun(slice)
}

const exitCode = lastFull?.status ?? r.status ?? 1
if (isCI) fail(`full typecheck failed (last exit ${exitCode})`)
console.warn(
  `code:typecheck SOFT-FAIL local (last exit ${exitCode}). Try: npm run code:typecheck:full`,
)
process.exit(0)
