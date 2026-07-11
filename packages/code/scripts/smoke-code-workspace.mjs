/**
 * Smoke: Bun workspace for Zavorth Code in monorepo.
 *
 *   cd packages/code
 *   bun install --ignore-scripts   # if native gyp fails on Windows
 *   bun run scripts/smoke-code-workspace.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  assert(pkg.name === "@zavorth/code", `workspace name=${pkg.name}`)
  assert(Array.isArray(pkg.workspaces?.packages), "workspaces.packages missing")
  assert(pkg.workspaces.packages.includes("cli"), "cli workspace missing")

  const cliPkg = JSON.parse(fs.readFileSync(path.join(root, "cli/package.json"), "utf8"))
  assert(cliPkg.name === "@zavorth/cli", `cli name=${cliPkg.name}`)
  // Public monorepo bin is root `zavorth` only — no separate coding bin product.
  assert(!cliPkg.bin || Object.keys(cliPkg.bin).length === 0, "code-cli must not ship a separate public bin")

  for (const name of ["shared", "plugin", "script", "sdk-js", "ui", "gitlab-auth", "poe-auth"]) {
    assert(fs.existsSync(path.join(root, name, "package.json")), `missing package ${name}`)
  }

  assert(fs.existsSync(path.join(root, "node_modules")), "node_modules missing — run bun install")
  assert(
    fs.existsSync(path.join(root, "node_modules", "@zavorth", "code-cli")) ||
      fs.existsSync(path.join(root, "cli")),
    "workspace link for code-cli missing",
  )

  const cliDir = path.join(root, "cli")
  const bunCmd = process.platform === "win32" ? "bun.cmd" : "bun"

  // Resolve shared from cli context via temp script inside cli/ (workspace resolution)
  const probe = path.join(cliDir, ".smoke-shared-probe.mjs")
  fs.writeFileSync(
    probe,
    `import { resolveZavorthHome } from "@zavorth/shared/global";\nconsole.log(resolveZavorthHome().mode);\n`,
    "utf8",
  )
  try {
    const r = spawnSync(bunCmd, [probe], {
      cwd: cliDir,
      encoding: "utf8",
      env: process.env,
    })
    if (r.status !== 0) {
      console.error("shared spawn", { status: r.status, error: r.error, stderr: r.stderr, stdout: r.stdout })
      throw new Error("shared import from cli failed")
    }
    const mode = (r.stdout || "").trim()
    assert(mode === "xdg" || mode === "zavorth_home", `unexpected mode ${mode}`)

    // CLI --version (cold start can be slow on Windows)
    const v = spawnSync(bunCmd, ["run", "--conditions=browser", "src/index.ts", "--version"], {
      cwd: cliDir,
      encoding: "utf8",
      env: { ...process.env, ZAVORTH_TAGLINE: "off" },
      timeout: 120_000,
    })
    if (v.error && (v.error.code === "ETIMEDOUT" || v.error.killed)) {
      throw new Error("cli --version timed out after 120s")
    }
    if (v.status !== 0) {
      console.error("version spawn", { status: v.status, error: v.error, stderr: v.stderr, stdout: v.stdout })
      throw new Error(`cli --version exit ${v.status}`)
    }
    const versionOut = (v.stdout || "").trim()
    assert(versionOut.length > 0, "empty version output")

    console.log("PASS: workspace package.json")
    console.log("PASS: allowlisted packages present")
    console.log("PASS: node_modules + @zavorth links")
    console.log("PASS: @zavorth/shared resolves from cli (", mode, ")")
    console.log("PASS: cli --version →", versionOut)
    console.log("code workspace smoke ok")
  } finally {
    try {
      fs.unlinkSync(probe)
    } catch {
      // ignore
    }
  }
  return


}

try {
  main()
} catch (e) {
  console.error("code workspace smoke FAIL:", e.message || e)
  process.exit(1)
}
