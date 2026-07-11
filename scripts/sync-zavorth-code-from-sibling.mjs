/**
 * Zavorth Code package sync (selective allowlist).
 *
 * **Cutover (source of truth):** monorepo `packages/code/`
 *
 * Directions:
 *   --export           monorepo → sibling (mirror / archive export)
 *   --from-sibling     sibling → monorepo (exceptional reverse import; requires explicit flag)
 *   --check            verify monorepo tree + SoT markers (no copy)
 *
 *   node scripts/sync-zavorth-code-from-sibling.mjs --check
 *   node scripts/sync-zavorth-code-from-sibling.mjs --export
 *   node scripts/sync-zavorth-code-from-sibling.mjs --export --source "C:/path/to/zavorth-code"
 *   node scripts/sync-zavorth-code-from-sibling.mjs --from-sibling --dry-run
 *   node scripts/sync-zavorth-code-from-sibling.mjs --from-sibling   # reverse import (discouraged)
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(__dirname, "..")
const codeWorkspaceRoot = path.join(monorepoRoot, "packages", "code")

const ALLOWLIST = [
  { monorepo: ["cli"], sibling: ["packages", "cli"] },
  { monorepo: ["shared"], sibling: ["packages", "shared"] },
  { monorepo: ["plugin"], sibling: ["packages", "plugin"] },
  { monorepo: ["script"], sibling: ["packages", "script"] },
  { monorepo: ["sdk-js"], sibling: ["packages", "sdk", "js"] },
  { monorepo: ["ui"], sibling: ["packages", "ui"] },
  { monorepo: ["gitlab-auth"], sibling: ["packages", "gitlab-auth"] },
  { monorepo: ["poe-auth"], sibling: ["packages", "poe-auth"] },
  { monorepo: ["patches"], sibling: ["patches"] },
]

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".git",
  ".turbo",
  "coverage",
  ".artifacts",
  ".cache",
  "tmp",
])

function parseArgs(argv) {
  const out = {
    source: null,
    dryRun: false,
    check: false,
    exportMode: false,
    fromSibling: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry-run") out.dryRun = true
    else if (a === "--check") out.check = true
    else if (a === "--export") out.exportMode = true
    else if (a === "--from-sibling" || a === "--import") out.fromSibling = true
    else if (a === "--source") out.source = argv[++i]
  }
  return out
}

function defaultSibling() {
  return path.resolve(monorepoRoot, "..", "zavorth-code")
}

function copyDir(src, dest, stats, dryRun) {
  if (!fs.existsSync(src)) throw new Error(`Missing source: ${src}`)
  if (!dryRun) fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith(".DS_Store")) continue
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) {
        stats.skippedDirs += 1
        continue
      }
      copyDir(from, to, stats, dryRun)
      continue
    }
    if (!entry.isFile()) continue
    stats.files += 1
    if (!dryRun) {
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.copyFileSync(from, to)
    }
  }
}

/**
 * Keep monorepo workspace root sane after reverse import.
 * Does NOT reintroduce a public zavorth-code bin (single-bin cutover).
 */
function ensureMonorepoWorkspaceMeta(destRoot, dryRun) {
  const pkgPath = path.join(destRoot, "package.json")
  if (!fs.existsSync(pkgPath)) return

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
  pkg.name = "@zavorth/code"
  pkg.private = true
  pkg.description =
    "Bun workspace for Zavorth Code CLI — source of truth lives in monorepo packages/code"
  if (!dryRun) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8")
  }

  const cliPkgPath = path.join(destRoot, "cli", "package.json")
  if (fs.existsSync(cliPkgPath)) {
    const cli = JSON.parse(fs.readFileSync(cliPkgPath, "utf8"))
    cli.name = "@zavorth/cli"
    cli.description =
      "Zavorth Code CLI — monorepo terminal coding shell (invoked via monorepo bin zavorth)"
    cli.private = true
    // Single public bin is monorepo root `zavorth` only
    if (cli.bin) delete cli.bin
    if (!dryRun) {
      fs.writeFileSync(cliPkgPath, JSON.stringify(cli, null, 2) + "\n", "utf8")
    }
  }
}

function writeManifest(opts) {
  const { direction, siblingRoot, dryRun } = opts
  const manifest = {
    version: 3,
    sourceOfTruth: "monorepo",
    monorepoPath: "packages/code",
    monorepoRoot,
    siblingRoot: siblingRoot || null,
    lastOperation: {
      direction, // "export" | "from-sibling" | "check"
      at: new Date().toISOString(),
    },
    allowlist: ALLOWLIST.map((x) => ({
      monorepo: x.monorepo.join("/"),
      sibling: x.sibling.join("/"),
    })),
    binaryPolicy: {
      publicBin: "zavorth",
      codeEntry: "bin/zavorth.js",
      separateCodingBin: false,
    },
    siblingRole: "mirror-or-archive",
    toolchain: "bun",
  }
  const file = path.join(codeWorkspaceRoot, "SYNC-MANIFEST.json")
  if (!dryRun) fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", "utf8")
  return { file, manifest }
}

function runCheck() {
  const errors = []
  if (!fs.existsSync(codeWorkspaceRoot)) {
    errors.push("packages/code missing")
  }
  const indexTs = path.join(codeWorkspaceRoot, "cli", "src", "index.ts")
  if (!fs.existsSync(indexTs)) {
    errors.push("packages/code/cli/src/index.ts missing")
  }
  const sot = path.join(codeWorkspaceRoot, "SOURCE-OF-TRUTH.md")
  if (!fs.existsSync(sot)) {
    errors.push("packages/code/SOURCE-OF-TRUTH.md missing (cutover marker)")
  }
  const cliPkgPath = path.join(codeWorkspaceRoot, "cli", "package.json")
  if (fs.existsSync(cliPkgPath)) {
    const cli = JSON.parse(fs.readFileSync(cliPkgPath, "utf8"))
    if (cli.bin && Object.keys(cli.bin).length > 0) {
      errors.push("@zavorth/cli must not declare public bin (single-bin policy)")
    }
  }
  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(monorepoRoot, "package.json"), "utf8"),
  )
  if (!rootPkg.bin?.zavorth) errors.push("root package.json missing bin.zavorth")
  if (rootPkg.bin?.["zavorth-code"]) {
    errors.push("root package.json must not expose bin.zavorth-code")
  }
  if (!fs.existsSync(path.join(monorepoRoot, "bin", "zavorth.js"))) {
    errors.push("bin/zavorth.js missing")
  }
  if (fs.existsSync(path.join(monorepoRoot, "bin", "zavorth-code.js"))) {
    errors.push("bin/zavorth-code.js must not exist")
  }

  writeManifest({ direction: "check", siblingRoot: defaultSibling(), dryRun: false })

  if (errors.length) {
    console.error("code cutover check FAILED:")
    for (const e of errors) console.error(" -", e)
    process.exit(1)
  }
  console.log("code cutover check OK")
  console.log("  source of truth: packages/code (monorepo)")
  console.log("  public bin: zavorth only")
  console.log("  sibling role: mirror-or-archive")
}

function syncPackages(fromRoot, toRoot, direction, dryRun) {
  const stats = { files: 0, skippedDirs: 0, packages: 0 }
  for (const item of ALLOWLIST) {
    const from =
      direction === "export"
        ? path.join(fromRoot, ...item.monorepo)
        : path.join(fromRoot, ...item.sibling)
    const to =
      direction === "export"
        ? path.join(toRoot, ...item.sibling)
        : path.join(toRoot, ...item.monorepo)

    if (!fs.existsSync(from)) {
      console.warn("skip missing:", from)
      continue
    }
    console.log(
      direction === "export"
        ? `export packages/code/${item.monorepo.join("/")} → sibling ${item.sibling.join("/")}`
        : `import sibling ${item.sibling.join("/")} → packages/code/${item.monorepo.join("/")}`,
    )
    if (!dryRun && fs.existsSync(to)) {
      fs.rmSync(to, { recursive: true, force: true })
    }
    copyDir(from, to, stats, dryRun)
    stats.packages += 1
  }
  return stats
}

function main() {
  const args = parseArgs(process.argv)
  const siblingRoot = path.resolve(args.source || defaultSibling())

  if (args.check) {
    runCheck()
    return
  }

  // Default with no direction: print SoT help (do not overwrite monorepo silently)
  if (!args.exportMode && !args.fromSibling) {
    console.error([
      "Zavorth Code: monorepo packages/code is the SOURCE OF TRUTH.",
      "",
      "Usage:",
      "  node scripts/sync-zavorth-code-from-sibling.mjs --check",
      "  node scripts/sync-zavorth-code-from-sibling.mjs --export [--source <sibling>]",
      "  node scripts/sync-zavorth-code-from-sibling.mjs --from-sibling [--source <sibling>]  # reverse import",
      "",
      "Develop Code CLI in the monorepo. Use --export to mirror into the sibling archive.",
    ].join("\n"))
    process.exit(2)
  }

  if (args.exportMode && args.fromSibling) {
    console.error("Use only one of --export or --from-sibling")
    process.exit(2)
  }

  if (args.exportMode) {
    if (!fs.existsSync(codeWorkspaceRoot)) {
      console.error("Monorepo Code tree missing:", codeWorkspaceRoot)
      process.exit(1)
    }
    console.log("direction: EXPORT monorepo → sibling (mirror)")
    console.log("source:   ", codeWorkspaceRoot)
    console.log("dest:     ", siblingRoot)
    console.log("mode:     ", args.dryRun ? "dry-run" : "write")
    if (!args.dryRun) fs.mkdirSync(siblingRoot, { recursive: true })
    const stats = syncPackages(codeWorkspaceRoot, siblingRoot, "export", args.dryRun)
    // Sibling archive marker
    const note = path.join(siblingRoot, "MIRROR-FROM-MONOREPO.md")
    if (!args.dryRun) {
      fs.writeFileSync(
        note,
        [
          "# Mirror / archive note",
          "",
          "**Source of truth:** monorepo `Zavorth/packages/code/`",
          "",
          "This tree is a **mirror or archive export**, not the primary development home.",
          "Edit the coding CLI in the monorepo; re-export with:",
          "",
          "```powershell",
          "cd <monorepo-Zavorth>",
          "npm run code:export",
          "```",
          "",
          `Last export: ${new Date().toISOString()}`,
          "",
        ].join("\n"),
        "utf8",
      )
    }
    writeManifest({ direction: "export", siblingRoot, dryRun: args.dryRun })
    console.log("---")
    console.log("packages/dirs:", stats.packages)
    console.log("files:        ", stats.files)
    console.log("export done (sibling is mirror/archive)")
    return
  }

  // Reverse import (discouraged after cutover)
  if (!fs.existsSync(siblingRoot)) {
    console.error(`Sibling not found: ${siblingRoot}`)
    process.exit(1)
  }
  console.warn("WARNING: reverse import --from-sibling overwrites monorepo Code tree.")
  console.warn("         Source of truth is packages/code after cutover.")
  console.log("direction: FROM-SIBLING → monorepo")
  console.log("source:   ", siblingRoot)
  console.log("dest:     ", codeWorkspaceRoot)
  console.log("mode:     ", args.dryRun ? "dry-run" : "write")

  if (!args.dryRun) fs.mkdirSync(codeWorkspaceRoot, { recursive: true })
  const stats = syncPackages(siblingRoot, codeWorkspaceRoot, "from-sibling", args.dryRun)
  if (!args.dryRun) ensureMonorepoWorkspaceMeta(codeWorkspaceRoot, false)
  writeManifest({ direction: "from-sibling", siblingRoot, dryRun: args.dryRun })
  console.log("---")
  console.log("packages/dirs:", stats.packages)
  console.log("files:        ", stats.files)
  console.log("reverse import done — re-run monorepo smokes")
}

main()
