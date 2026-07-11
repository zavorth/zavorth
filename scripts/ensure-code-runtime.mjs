#!/usr/bin/env node
/**
 * Ensure a prebuilt Code TUI binary exists for this OS/arch so `zavorth`
 * can run without Bun after the first prepare.
 *
 * Strategy (in order):
 *  1) Already have packages/code/cli/dist/zavorth-<os>-<arch>/bin/zavorth
 *  2) Download from ZAVORTH_CODE_BINARY_URL or GitHub release asset (if configured)
 *  3) Build with Bun: npm run code:build  (requires Bun once)
 *
 *   node scripts/ensure-code-runtime.mjs
 *   npm run code:ensure
 *
 * Env:
 *   ZAVORTH_CODE_ENSURE=0     — no-op exit 0
 *   ZAVORTH_CODE_ENSURE_BUILD=0 — skip local Bun build
 *   ZAVORTH_CODE_ENSURE_DOWNLOAD=0 — skip download
 *   ZAVORTH_CODE_BINARY_URL — direct URL to tar.gz/zip of platform folder
 *   GITHUB_TOKEN / GH_TOKEN — for private release downloads
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import https from "node:https"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function log(msg) {
  console.log(`[code:ensure] ${msg}`)
}
function fail(msg, code = 1) {
  console.error(`[code:ensure] FAIL: ${msg}`)
  process.exit(code)
}

function envOff(name) {
  const v = String(process.env[name] || "")
    .trim()
    .toLowerCase()
  return v === "0" || v === "false" || v === "no" || v === "off"
}

function platformFolder() {
  const osName =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "darwin"
        : process.platform === "linux"
          ? "linux"
          : process.platform
  const arch = process.arch === "arm64" ? "arm64" : "x64"
  return `zavorth-${osName}-${arch}`
}

function resolveBinary() {
  const launch = require(path.join(root, "bin/lib/launch-code-tui.cjs"))
  return launch.resolveCompiledCodeBinary(root, process.env)
}

function findBun() {
  const launch = require(path.join(root, "bin/lib/launch-code-tui.cjs"))
  if (typeof launch.findBun === "function") {
    const found = launch.findBun()
    if (found) return found
  }
  // Windows: resolve real bun.exe (npm shim .cmd cannot spawn without shell)
  if (process.platform === "win32" && process.env.APPDATA) {
    const nested = path.join(
      process.env.APPDATA,
      "npm",
      "node_modules",
      "bun",
      "bin",
      "bun.exe",
    )
    if (fs.existsSync(nested)) return nested
  }
  return null
}

function downloadTo(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http
    const headers = {}
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (token) headers.Authorization = `Bearer ${token}`
    headers["User-Agent"] = "zavorth-code-ensure"
    headers.Accept = "application/octet-stream"

    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        downloadTo(res.headers.location, dest).then(resolve, reject)
        return
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode || 0} for ${url}`))
        res.resume()
        return
      }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on("finish", () => out.close(() => resolve(dest)))
      out.on("error", reject)
    })
    req.on("error", reject)
    req.setTimeout(120_000, () => {
      req.destroy()
      reject(new Error("download timeout"))
    })
  })
}

/**
 * Soft GitHub Releases API lookup for real asset names (token recommended for rate limits).
 * @param {string} repo owner/name
 * @param {string} tag
 * @param {string} plat
 * @param {string} shortPlat
 * @param {string} folder
 * @returns {Promise<string[]>}
 */
function listGithubReleaseAssetUrls(repo, tag, plat, shortPlat, folder) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    const headers = {
      "User-Agent": "zavorth-code-ensure",
      Accept: "application/vnd.github+json",
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const apiPath = tag.startsWith("latest")
      ? `/repos/${repo}/releases/latest`
      : `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`
    const req = https.get(
      {
        hostname: "api.github.com",
        path: apiPath,
        headers,
        timeout: 15_000,
      },
      (res) => {
        /** @type {Buffer[]} */
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`GitHub API HTTP ${res.statusCode || 0}`))
            return
          }
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
            const assets = Array.isArray(body.assets) ? body.assets : []
            const needles = [plat, shortPlat, folder, "code-tui", "zavorth"]
            /** @type {string[]} */
            const matched = []
            for (const asset of assets) {
              const name = String(asset.name || "").toLowerCase()
              const url = String(asset.browser_download_url || "")
              if (!url) continue
              if (!/\.(tar\.gz|tgz|zip)$/i.test(name)) continue
              const hit = needles.some((n) => n && name.includes(String(n).toLowerCase()))
              if (hit) matched.push(url)
            }
            // Prefer platform-specific first
            matched.sort((a, b) => {
              const score = (u) => {
                const n = u.toLowerCase()
                let s = 0
                if (n.includes(plat.toLowerCase())) s += 4
                if (n.includes(shortPlat.toLowerCase())) s += 3
                if (n.includes("code-tui")) s += 2
                return -s
              }
              return score(a) - score(b)
            })
            resolve(matched)
          } catch (err) {
            reject(err)
          }
        })
      },
    )
    req.on("error", reject)
    req.on("timeout", () => {
      req.destroy()
      reject(new Error("GitHub API timeout"))
    })
  })
}

function extractArchive(archive, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  if (/\.zip$/i.test(archive)) {
    if (process.platform === "win32") {
      const r = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`,
        ],
        { encoding: "utf8" },
      )
      if (r.status !== 0) throw new Error(r.stderr || r.stdout || "Expand-Archive failed")
      return
    }
    const r = spawnSync("unzip", ["-o", archive, "-d", outDir], { encoding: "utf8" })
    if (r.status !== 0) throw new Error(r.stderr || "unzip failed")
    return
  }
  const r = spawnSync("tar", ["-xzf", archive, "-C", outDir], {
    encoding: "utf8",
    shell: false,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "tar failed")
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

async function tryDownload() {
  if (envOff("ZAVORTH_CODE_ENSURE_DOWNLOAD")) {
    log("download skipped (ZAVORTH_CODE_ENSURE_DOWNLOAD=0)")
    return false
  }

  const folder = platformFolder()
  const destBinDir = path.join(root, "packages/code/cli/dist", folder, "bin")
  const explicit = process.env.ZAVORTH_CODE_BINARY_URL
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  const version = pkg.version || "latest"
  let repo = ""
  if (pkg.repository) {
    if (typeof pkg.repository === "string") repo = pkg.repository
    else if (pkg.repository.url) repo = pkg.repository.url
  }
  // github.com/owner/repo.git → owner/repo
  const m = String(repo).match(/github\.com[/:]([^/]+\/[^/.]+)/i)
  const gh = m ? m[1].replace(/\.git$/, "") : process.env.ZAVORTH_GITHUB_REPO || ""

  const plat =
    process.platform === "win32"
      ? process.arch === "arm64"
        ? "windows-arm64"
        : "windows-x64"
      : process.platform === "darwin"
        ? process.arch === "arm64"
          ? "darwin-arm64"
          : "darwin-x64"
        : process.arch === "arm64"
          ? "linux-arm64"
          : "linux-x64"
  const shortPlat = folder.replace(/^zavorth-/, "")

  /** @type {string[]} */
  const urls = []
  if (explicit) urls.push(explicit)
  if (gh) {
    // Prefer versioned release assets produced by CI (release.yml → code-tui-<platform>.tar.gz)
    const tag = process.env.ZAVORTH_CODE_RELEASE_TAG || `v${version}`
    const assetStems = [
      `code-tui-${plat}`,
      `code-tui-${shortPlat}`,
      `zavorth-code-${plat}`,
      folder,
      `zavorth-${plat}`,
    ]
    const exts = process.platform === "win32" ? [".tar.gz", ".zip", ".tgz"] : [".tar.gz", ".tgz", ".zip"]
    for (const stem of assetStems) {
      for (const ext of exts) {
        urls.push(`https://github.com/${gh}/releases/download/${tag}/${stem}${ext}`)
      }
    }
    // Latest-release redirect (GitHub serves /releases/latest/download/<asset>)
    for (const stem of [`code-tui-${plat}`, `code-tui-${shortPlat}`]) {
      for (const ext of [".tar.gz", ".zip"]) {
        urls.push(`https://github.com/${gh}/releases/latest/download/${stem}${ext}`)
      }
    }
    // Soft: list release assets via API when token present (no throw on miss)
    if (!envOff("ZAVORTH_CODE_ENSURE_API") && (process.env.GITHUB_TOKEN || process.env.GH_TOKEN)) {
      try {
        const apiUrls = await listGithubReleaseAssetUrls(gh, tag, plat, shortPlat, folder)
        for (const u of apiUrls) {
          if (!urls.includes(u)) urls.push(u)
        }
      } catch (err) {
        log(`release API soft miss: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  if (!urls.length) {
    log("no download URL configured (set ZAVORTH_CODE_BINARY_URL or package.repository)")
    return false
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-code-bin-"))
  try {
    for (const url of urls) {
      const lowerUrl = String(url).split("?")[0].toLowerCase()
      const ext = lowerUrl.endsWith(".zip")
        ? ".zip"
        : lowerUrl.endsWith(".tgz")
          ? ".tgz"
          : ".tar.gz"
      const archive = path.join(tmp, `payload${ext}`)
      try {
        if (fs.existsSync(archive)) fs.rmSync(archive, { force: true })
        log(`trying download: ${url}`)
        await downloadTo(url, archive)
      } catch (err) {
        log(`download miss: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
      const extractDir = path.join(tmp, "out")
      try {
        fs.rmSync(extractDir, { recursive: true, force: true })
        extractArchive(archive, extractDir)
      } catch (err) {
        log(`extract failed: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
      const found = walk(extractDir).find((p) => {
        const b = path.basename(p).toLowerCase()
        return b === "zavorth" || b === "zavorth.exe"
      })
      if (!found) {
        log("archive had no zavorth binary")
        continue
      }
      fs.mkdirSync(destBinDir, { recursive: true })
      const destName = process.platform === "win32" ? "zavorth.exe" : "zavorth"
      const dest = path.join(destBinDir, destName)
      fs.copyFileSync(found, dest)
      try {
        fs.chmodSync(dest, 0o755)
      } catch {
        /* win */
      }
      log(`installed binary → ${path.relative(root, dest)}`)
      return true
    }
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* */
    }
  }
  return false
}

function tryBuild() {
  if (envOff("ZAVORTH_CODE_ENSURE_BUILD")) {
    log("build skipped (ZAVORTH_CODE_ENSURE_BUILD=0)")
    return false
  }
  const bun = findBun()
  if (!bun) {
    log("Bun not found — cannot build binary locally")
    return false
  }

  const codeRoot = path.join(root, "packages", "code")
  const cliRoot = path.join(codeRoot, "cli")

  // Ensure workspace deps (cwd must be packages/code — not --cwd flag)
  log(`installing dependencies in ${codeRoot}…`)
  const inst = spawnSync(bun, ["install"], {
    cwd: codeRoot,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  })
  if (inst.error || inst.status !== 0) {
    log(`bun install failed (${inst.error?.message || inst.status}) — retrying with --ignore-scripts`)
    const inst2 = spawnSync(bun, ["install", "--ignore-scripts"], {
      cwd: codeRoot,
      encoding: "utf8",
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    })
    if (inst2.error || inst2.status !== 0) {
      log(`bun install failed: ${inst2.error?.message || inst2.stderr || inst2.status}`)
      return false
    }
  }

  log("building Code TUI binary for this platform (one-time; may take several minutes)…")
  const buildScript = path.join(cliRoot, "script", "build.ts")
  const r = spawnSync(bun, ["run", buildScript, "--single", "--skip-install"], {
    cwd: cliRoot,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
    shell: false,
    env: { ...process.env },
  })
  if (r.error || r.status !== 0) {
    log(`code build failed: ${r.error?.message || r.status}`)
    return false
  }
  return Boolean(resolveBinary())
}

async function main() {
  if (envOff("ZAVORTH_CODE_ENSURE")) {
    log("skipped (ZAVORTH_CODE_ENSURE=0)")
    process.exit(0)
  }

  const existing = resolveBinary()
  if (existing) {
    log(`already present: ${path.relative(root, existing)}`)
    process.exit(0)
  }

  log(`no prebuilt binary for ${platformFolder()} — ensuring…`)

  if (await tryDownload()) {
    const b = resolveBinary()
    if (b) {
      log(`OK (download): ${path.relative(root, b)}`)
      process.exit(0)
    }
  }

  if (tryBuild()) {
    const b = resolveBinary()
    if (b) {
      log(`OK (build): ${path.relative(root, b)}`)
      process.exit(0)
    }
  }

  // Soft mode: sources+Bun still runs the TUI. Do not break postinstall/dev.
  const bun = findBun()
  if (bun) {
    log(
      [
        "WARN: prebuilt binary not available yet on this machine.",
        "  Launch will use Bun + sources until a binary exists.",
        "  After CI release assets exist, re-run: npm run code:ensure",
        "  Or set ZAVORTH_CODE_BINARY_URL to a platform archive.",
        bun ? `  Bun found — day-to-day 'zavorth' still works.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    // Exit 0 so postinstall / first launch soft-ensure does not fail the product
    process.exit(0)
  }

  fail(
    [
      "Could not ensure a Code TUI binary and Bun is not available.",
      "Fix options:",
      "  1) Install Bun, then: npm run code:ensure  (or just: zavorth)",
      "  2) Set ZAVORTH_CODE_BINARY_URL to a release archive",
      "  3) Install a release package that already includes packages/code/cli/dist",
    ].join("\n"),
    1,
  )
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
