#!/usr/bin/env node
/**
 * Assemble Code TUI platform binaries into packages/code/cli/dist/
 * for npm pack / release.
 *
 * Inputs (optional env):
 *   CODE_BINARY_ARTIFACTS_DIR  — directory of downloaded CI artifacts
 *     expected layout:
 *       code-tui-windows-x64/bin/zavorth.exe  (or nested)
 *       code-tui-linux-x64/bin/zavorth
 *       …
 *   Or files matching zavorth-{os}-{arch}.tar.gz / .zip in that dir.
 *
 * Without artifacts: validates layout rules and exits 0 if local dist already
 * has current-platform binary; exits 0 with note if empty (dev clone).
 *
 *   node scripts/assemble-code-binaries.mjs
 *   npm run code:release:assemble
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const destRoot = path.join(root, "packages", "code", "cli", "dist")

function log(msg) {
  console.log(msg)
}
function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
  try {
    fs.chmodSync(dest, 0o755)
  } catch {
    /* windows */
  }
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walkFiles(full, acc)
    else acc.push(full)
  }
  return acc
}

/**
 * Map artifact names → dist folder name used by resolveCompiledCodeBinary
 * zavorth-windows-x64, zavorth-linux-x64, zavorth-darwin-arm64, …
 */
function normalizePlatformFolder(name) {
  const n = String(name || "").toLowerCase()
  if (n.includes("windows") && n.includes("arm")) return "zavorth-windows-arm64"
  if (n.includes("windows") || n.includes("win32") || n.includes("win-")) return "zavorth-windows-x64"
  if (n.includes("darwin") && n.includes("arm")) return "zavorth-darwin-arm64"
  if (n.includes("darwin") || n.includes("macos") || n.includes("osx")) return "zavorth-darwin-x64"
  if (n.includes("linux") && n.includes("arm")) return "zavorth-linux-arm64"
  if (n.includes("linux")) return "zavorth-linux-x64"
  // already correct
  if (/^zavorth-(windows|linux|darwin)-/.test(n)) return n.replace(/\/$/, "")
  return null
}

function placeBinary(platformFolder, binaryPath) {
  const binName = path.basename(binaryPath).toLowerCase().endsWith(".exe")
    ? "zavorth.exe"
    : "zavorth"
  const dest = path.join(destRoot, platformFolder, "bin", binName)
  copyFile(binaryPath, dest)
  log(`placed ${path.relative(root, dest)}`)
  return dest
}

function extractArchive(archive, outDir) {
  ensureDir(outDir)
  if (/\.tar\.gz$/i.test(archive) || /\.tgz$/i.test(archive)) {
    const r = spawnSync("tar", ["-xzf", archive, "-C", outDir], {
      encoding: "utf8",
      shell: false,
    })
    if (r.status !== 0) fail(`tar extract failed: ${archive}\n${r.stderr || r.stdout}`)
    return
  }
  if (/\.zip$/i.test(archive)) {
    // Prefer tar on modern Windows / unix; fallback powershell
    if (process.platform === "win32") {
      const r = spawnSync(
        "powershell",
        ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`],
        { encoding: "utf8" },
      )
      if (r.status !== 0) fail(`zip extract failed: ${archive}`)
    } else {
      const r = spawnSync("unzip", ["-o", archive, "-d", outDir], { encoding: "utf8" })
      if (r.status !== 0) fail(`unzip failed: ${archive}`)
    }
  }
}

function main() {
  ensureDir(destRoot)
  const artifactsDir = process.env.CODE_BINARY_ARTIFACTS_DIR
    ? path.resolve(process.env.CODE_BINARY_ARTIFACTS_DIR)
    : null

  let placed = 0

  if (artifactsDir && fs.existsSync(artifactsDir)) {
    log(`assembling from ${artifactsDir}`)
    const files = walkFiles(artifactsDir)
    // Archives first
    for (const f of files) {
      if (!/\.(tar\.gz|tgz|zip)$/i.test(f)) continue
      const base = path.basename(f)
      const folder = normalizePlatformFolder(base)
      if (!folder) {
        log(`skip archive (unknown platform): ${base}`)
        continue
      }
      const tmp = path.join(destRoot, ".extract-" + folder)
      try {
        fs.rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* */
      }
      extractArchive(f, tmp)
      const inner = walkFiles(tmp).find((p) => {
        const b = path.basename(p).toLowerCase()
        return b === "zavorth" || b === "zavorth.exe"
      })
      if (!inner) {
        log(`warn: no zavorth binary in ${base}`)
        continue
      }
      placeBinary(folder, inner)
      placed += 1
      try {
        fs.rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* */
      }
    }
    // Loose binaries under code-tui-* dirs
    for (const f of files) {
      const b = path.basename(f).toLowerCase()
      if (b !== "zavorth" && b !== "zavorth.exe") continue
      const rel = path.relative(artifactsDir, f)
      const folder = normalizePlatformFolder(rel.split(path.sep)[0] || rel)
      if (!folder) continue
      const dest = path.join(destRoot, folder, "bin", b === "zavorth.exe" ? "zavorth.exe" : "zavorth")
      if (fs.existsSync(dest)) continue
      placeBinary(folder, f)
      placed += 1
    }
  }

  // Local already-built platforms
  if (fs.existsSync(destRoot)) {
    for (const name of fs.readdirSync(destRoot)) {
      if (!name.startsWith("zavorth-")) continue
      const binDir = path.join(destRoot, name, "bin")
      if (!fs.existsSync(binDir)) continue
      const has = fs.readdirSync(binDir).some((n) => /^zavorth(\.exe)?$/i.test(n))
      if (has) {
        log(`present ${name}`)
        placed += 1
      }
    }
  }

  if (placed === 0) {
    log(
      "NOTE: no Code TUI binaries assembled yet. Dev clones are fine — run npm run code:build for this platform, or CI release will ship multi-OS binaries.",
    )
    process.exit(0)
  }

  log(`assemble-code-binaries ok (${placed} platform slot(s))`)
  process.exit(0)
}

main()
