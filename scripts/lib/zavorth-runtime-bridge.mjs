/**
 * Zavorth product runtime bridge — resolve contract, write runtime-bridge.json,
 * build TUI child env when hosted from the public `zavorth` entry.
 *
 * Contract: docs/protocol/zavorth-runtime-bridge.md
 *
 * CLI:
 *   node scripts/lib/zavorth-runtime-bridge.mjs --json
 *   node scripts/lib/zavorth-runtime-bridge.mjs --write
 *   node scripts/lib/zavorth-runtime-bridge.mjs --write --root C:/path/to/Zavorth
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const DEFAULT_GATEWAY_BASE_URL = "http://localhost:20128"

/** @param {string|undefined} value */
function normalizeBaseUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, "")
}

/**
 * Align with scripts/lib/zavorth-code-bridge.mjs resolveCodeStateDir.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveStateDir(env = process.env) {
  const home = env.ZAVORTH_HOME || env.MIMOCODE_HOME
  if (home) {
    if (!path.isAbsolute(home)) {
      throw new Error(`ZAVORTH_HOME must be absolute, got: ${JSON.stringify(home)}`)
    }
    return path.join(home, "state")
  }
  const xdg = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state")
  return path.join(xdg, "zavorth")
}

/**
 * Gateway URL resolution order:
 * 1. ZAVORTH_GATEWAY_BASE_URL | ZavorthGateway_BASE_URL
 * 2. BASE_URL | NEXT_PUBLIC_BASE_URL
 * 3. DEFAULT_GATEWAY_BASE_URL
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveGatewayBaseUrl(env = process.env) {
  return (
    normalizeBaseUrl(env.ZAVORTH_GATEWAY_BASE_URL) ||
    normalizeBaseUrl(env.ZavorthGateway_BASE_URL) ||
    normalizeBaseUrl(env.BASE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_BASE_URL) ||
    DEFAULT_GATEWAY_BASE_URL
  )
}

/** @param {NodeJS.ProcessEnv} [env] */
export function runtimeBridgePath(env = process.env) {
  return path.join(resolveStateDir(env), "runtime-bridge.json")
}

/** @param {string} filePath */
function readJsonIfPresent(filePath) {
  try {
    if (!fs.existsSync(filePath)) return undefined
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return undefined
  }
}

/** @param {string} filePath @param {unknown} data */
function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8")
  fs.renameSync(tmp, filePath)
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {object|undefined}
 */
export function readRuntimeBridge(env = process.env) {
  return readJsonIfPresent(runtimeBridgePath(env))
}

/**
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv, updatedAt?: number }} [opts]
 */
export function resolveHostRuntimeContract(opts = {}) {
  const env = opts.env || process.env
  const projectRoot = path.resolve(
    opts.projectRoot || env.ZAVORTH_WORKSPACE_ROOT || env.ZAVORTH_MONOREPO_ROOT || process.cwd(),
  )
  const gatewayBaseUrl = resolveGatewayBaseUrl(env)
  return {
    version: 1,
    updatedAt: typeof opts.updatedAt === "number" ? opts.updatedAt : Date.now(),
    source: "workspace",
    entry: "code-tui",
    product: "zavorth-terminal",
    workspaceRoot: projectRoot,
    // legacy field for older readers
    monorepoRoot: projectRoot,
    gatewayBaseUrl,
    policyAuthority: "gateway",
    bridges: {
      ops: "ops-bridge.json",
      companion: "companion-bridge.json",
      companionStatus: "companion-status.json",
    },
  }
}

/** @deprecated use resolveHostRuntimeContract */
export function resolveMonorepoRuntimeContract(opts = {}) {
  return resolveHostRuntimeContract(opts)
}

/**
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv, updatedAt?: number }} [opts]
 */
export function writeRuntimeBridge(opts = {}) {
  const env = opts.env || process.env
  const payload = resolveHostRuntimeContract(opts)
  writeJsonAtomic(runtimeBridgePath(env), payload)
  return payload
}

/**
 * Env injected into Code TUI when launched from the public product entry.
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {NodeJS.ProcessEnv}
 */
export function buildTuiChildEnv(opts = {}) {
  const env = opts.env || process.env
  const projectRoot = path.resolve(
    opts.projectRoot || env.ZAVORTH_WORKSPACE_ROOT || env.ZAVORTH_MONOREPO_ROOT || process.cwd(),
  )
  const gatewayBaseUrl = resolveGatewayBaseUrl(env)
  return {
    ...env,
    ZAVORTH_RUNTIME_SOURCE: "workspace",
    ZAVORTH_WORKSPACE_ROOT: projectRoot,
    ZAVORTH_GATEWAY_BASE_URL: gatewayBaseUrl,
    ZAVORTH_POLICY_AUTHORITY: "gateway",
    ZAVORTH_CODE_FROM_WORKSPACE: "1",
  }
}

function parseRootArg(argv) {
  const idx = argv.indexOf("--root")
  if (idx >= 0 && argv[idx + 1]) return path.resolve(argv[idx + 1])
  return undefined
}

function defaultProjectRoot() {
  // scripts/lib → scripts → monorepo root
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, "..", "..")
}

function main() {
  const argv = process.argv.slice(2)
  const projectRoot = parseRootArg(argv) || defaultProjectRoot()
  const env = process.env

  if (argv.includes("--write")) {
    const payload = writeRuntimeBridge({ projectRoot, env })
    if (argv.includes("--json")) {
      console.log(JSON.stringify(payload, null, 2))
    } else {
      console.log("wrote", runtimeBridgePath(env))
      console.log("gatewayBaseUrl:", payload.gatewayBaseUrl)
      console.log("monorepoRoot:", payload.monorepoRoot)
    }
    return
  }

  const contract = resolveMonorepoRuntimeContract({ projectRoot, env })
  if (argv.includes("--json") || argv.length === 0) {
    console.log(JSON.stringify(contract, null, 2))
    return
  }

  console.log("monorepoRoot:", contract.monorepoRoot)
  console.log("gatewayBaseUrl:", contract.gatewayBaseUrl)
  console.log("stateDir:", resolveStateDir(env))
  console.log("runtime-bridge:", runtimeBridgePath(env))
  console.log("policyAuthority:", contract.policyAuthority)
}

if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("zavorth-runtime-bridge.mjs")
) {
  main()
}
