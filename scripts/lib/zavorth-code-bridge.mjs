/**
 * Zavorth Code bridge — read ops/companion bridges, write companion-status heartbeat.
 * Contract: zavorth-code/docs/bridge-contract.md
 * Protocol: docs/protocol/zavorth-code-bridge.md
 *
 * CLI:
 *   node scripts/lib/zavorth-code-bridge.mjs
 *   node scripts/lib/zavorth-code-bridge.mjs --json
 *   node scripts/lib/zavorth-code-bridge.mjs --heartbeat --name "Zavorth Desktop"
 *   node scripts/lib/zavorth-code-bridge.mjs --smoke
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const ONLINE_WINDOW_MS = 60_000
export const OPS_STALE_MS = 120_000
export const HEARTBEAT_MS = 25_000

/** @param {NodeJS.ProcessEnv} [env] */
export function resolveCodeStateDir(env = process.env) {
  const home = env.ZAVORTH_HOME || env.MIMOCODE_HOME
  if (home) {
    if (!path.isAbsolute(home)) {
      throw new Error(`ZAVORTH_HOME must be absolute, got: ${JSON.stringify(home)}`)
    }
    return path.join(home, "state")
  }
  // Match zavorth-code + xdg-basedir: XDG_STATE_HOME or ~/.local/state/zavorth
  const xdg = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state")
  return path.join(xdg, "zavorth")
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

/** @param {NodeJS.ProcessEnv} [env] */
export function opsBridgePath(env = process.env) {
  return path.join(resolveCodeStateDir(env), "ops-bridge.json")
}

/** @param {NodeJS.ProcessEnv} [env] */
export function companionBridgePath(env = process.env) {
  return path.join(resolveCodeStateDir(env), "companion-bridge.json")
}

/** @param {NodeJS.ProcessEnv} [env] */
export function companionStatusPath(env = process.env) {
  return path.join(resolveCodeStateDir(env), "companion-status.json")
}

/** @param {NodeJS.ProcessEnv} [env] */
export function readOpsBridge(env = process.env) {
  return readJsonIfPresent(opsBridgePath(env))
}

/** @param {NodeJS.ProcessEnv} [env] */
export function readCompanionBridge(env = process.env) {
  return readJsonIfPresent(companionBridgePath(env))
}

/** @param {NodeJS.ProcessEnv} [env] */
export function readCompanionStatus(env = process.env) {
  const raw = readJsonIfPresent(companionStatusPath(env))
  if (!raw || typeof raw !== "object") {
    return { online: false }
  }
  const lastSeen = typeof raw.lastSeen === "number" ? raw.lastSeen : undefined
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : undefined
  const online = lastSeen !== undefined && Date.now() - lastSeen <= ONLINE_WINDOW_MS
  return { online, lastSeen, name }
}

/**
 * Desktop / Control / companion heartbeat so Code TUI can show companion online.
 * @param {{ name?: string, online?: boolean }} [input]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function writeCompanionStatus(input = {}, env = process.env) {
  const name =
    typeof input.name === "string" && input.name.trim() ? input.name.trim() : undefined
  const payload = {
    lastSeen: Date.now(),
    online: input.online !== false,
    ...(name ? { name } : {}),
  }
  writeJsonAtomic(companionStatusPath(env), payload)
  return payload
}

/** @param {number|undefined} updatedAt @param {number} [windowMs] */
export function isBridgeFresh(updatedAt, windowMs = OPS_STALE_MS) {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return false
  return Date.now() - updatedAt <= windowMs
}

/**
 * UI-friendly summary for Control / Desktop chrome.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function summarizeCodeBridge(env = process.env) {
  const ops = readOpsBridge(env)
  const companion = readCompanionBridge(env)
  const status = readCompanionStatus(env)
  const opsFresh = isBridgeFresh(ops?.updatedAt)
  const companionFresh = isBridgeFresh(companion?.updatedAt)

  let tone = "muted"
  let label = "Code offline"
  let detail = "No recent ops-bridge from Zavorth Code CLI"

  if (ops && opsFresh) {
    if (ops.ready) {
      tone = "ready"
      label = "Code ready"
      detail = ops.headline || "Zavorth Code CLI is ready"
    } else if (Number(ops.approvals) > 0) {
      tone = "warning"
      label =
        Number(ops.approvals) === 1
          ? "Code · 1 approval"
          : `Code · ${ops.approvals} approvals`
      detail = ops.nextAction || ops.headline || "Approvals waiting in Code"
    } else if (ops.providerReady === false) {
      tone = "warning"
      label = "Code · needs provider"
      detail = ops.nextAction || ops.headline || "Connect a provider in Code"
    } else {
      tone = "warning"
      label = "Code · not ready"
      detail = ops.nextAction || ops.headline || "See Code status"
    }
  } else if (ops && !opsFresh) {
    tone = "muted"
    label = "Code stale"
    detail = "Last ops-bridge is older than 2 minutes"
  }

  return {
    stateDir: resolveCodeStateDir(env),
    paths: {
      ops: opsBridgePath(env),
      companion: companionBridgePath(env),
      companionStatus: companionStatusPath(env),
    },
    ops,
    companion,
    companionStatus: status,
    opsFresh,
    companionFresh,
    tone,
    label,
    detail,
  }
}

/** Snapshot all three files for Control/Desktop debug. */
export function readCodeBridgeBundle(env = process.env) {
  return {
    ...summarizeCodeBridge(env),
  }
}

/**
 * Start interval heartbeat. Returns stop().
 * @param {{ name?: string, intervalMs?: number }} [opts]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function startCompanionHeartbeat(opts = {}, env = process.env) {
  const intervalMs = opts.intervalMs ?? HEARTBEAT_MS
  const name = opts.name || "Zavorth Companion"
  const tick = () => {
    try {
      writeCompanionStatus({ name, online: true }, env)
    } catch {
      // best-effort
    }
  }
  tick()
  const handle = setInterval(tick, intervalMs)
  if (typeof handle.unref === "function") handle.unref()
  return () => clearInterval(handle)
}

/** @returns {boolean} */
export function runSmoke(env = process.env) {
  const dir = resolveCodeStateDir(env)
  fs.mkdirSync(dir, { recursive: true })
  const written = writeCompanionStatus({ name: "smoke-test", online: true }, env)
  const status = readCompanionStatus(env)
  const summary = summarizeCodeBridge(env)
  const ok =
    typeof written.lastSeen === "number" &&
    status.online === true &&
    summary.stateDir === dir &&
    typeof summary.label === "string"
  if (!ok) {
    console.error("smoke failed", { written, status, summary })
    return false
  }
  console.log("smoke ok")
  console.log("stateDir:", dir)
  console.log("status:", status)
  console.log("summary:", summary.label, "—", summary.detail)
  return true
}

function main() {
  if (process.argv.includes("--smoke")) {
    process.exit(runSmoke() ? 0 : 1)
  }

  if (process.argv.includes("--heartbeat")) {
    const nameIdx = process.argv.indexOf("--name")
    const name =
      nameIdx >= 0 && process.argv[nameIdx + 1]
        ? process.argv[nameIdx + 1]
        : "Zavorth Companion"
    console.log("heartbeat →", companionStatusPath())
    console.log("name:", name)
    const stop = startCompanionHeartbeat({ name })
    process.on("SIGINT", () => {
      stop()
      process.exit(0)
    })
    process.on("SIGTERM", () => {
      stop()
      process.exit(0)
    })
    // Keep process alive
    setInterval(() => {}, 1 << 30)
    return
  }

  const bundle = readCodeBridgeBundle()
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(bundle, null, 2))
    return
  }
  console.log("stateDir:", bundle.stateDir)
  console.log("ops-bridge:", bundle.ops ? `ready=${bundle.ops.ready} updatedAt=${bundle.ops.updatedAt} fresh=${bundle.opsFresh}` : "(missing)")
  console.log(
    "companion-bridge:",
    bundle.companion ? `updatedAt=${bundle.companion.updatedAt} fresh=${bundle.companionFresh}` : "(missing)",
  )
  console.log(
    "companion-status:",
    bundle.companionStatus.online
      ? `online name=${bundle.companionStatus.name ?? "?"}`
      : "offline",
  )
  console.log("ui:", bundle.label, "—", bundle.detail)
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("zavorth-code-bridge.mjs")) {
  main()
}
