/**
 * Product gateway policy authority for the Code TUI.
 *
 * When the TUI is product-hosted with policyAuthority=gateway, tool permission
 * decisions merge the product runtime-permissions profile (shared with Control
 * / gateway config) so policy is not only a label on the host env.
 *
 * Fallback when the product policy file is missing:
 *   ZAVORTH_POLICY_FALLBACK=local (default) → local rules only
 *   ZAVORTH_POLICY_FALLBACK=fail → treat as deny-all for shell/network tools
 */
import fs from "fs"
import path from "path"
import {
  getHostRuntimeSummary,
  getProductGatewayBaseUrl,
  isProductHosted,
  workspaceRootFromEnv,
  readRuntimeBridgeFile,
} from "./host-runtime"
import type { Action } from "@/permission"
import type { Ruleset } from "@/permission"

export type PolicyAuthority = "gateway" | "local"

export type ProductPermissionDefault = "allow" | "approval" | "block"

export type GatewayPolicySnapshot = {
  authority: PolicyAuthority
  hosted: boolean
  source: "product-config" | "none" | "fail-closed"
  configPath?: string
  ruleset: Ruleset
  profile?: string
  gatewayBaseUrl: string
  detail: string
}

function envFlag(value: string | undefined, truthy: string[]): boolean {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
  return truthy.includes(s)
}

export function resolvePolicyAuthority(env: NodeJS.ProcessEnv = process.env): PolicyAuthority {
  const explicit = String(env.ZAVORTH_POLICY_AUTHORITY || "")
    .trim()
    .toLowerCase()
  if (explicit === "local" || explicit === "tui" || explicit === "code") return "local"
  if (explicit === "gateway" || explicit === "product") return "gateway"
  return isProductHosted(env) ? "gateway" : "local"
}

export function resolvePolicyFallback(env: NodeJS.ProcessEnv = process.env): "local" | "fail" {
  const v = String(env.ZAVORTH_POLICY_FALLBACK || "")
    .trim()
    .toLowerCase()
  if (v === "fail" || v === "deny" || v === "closed") return "fail"
  return "local"
}

/**
 * Map product runtime-permissions defaults → Code TUI permission rules.
 * Conservative: approval → ask, block → deny.
 */
export function mapProductDefaultsToRuleset(
  defaults: Record<string, string> | null | undefined,
): Ruleset {
  if (!defaults || typeof defaults !== "object") return []
  const rules: Ruleset = []

  const push = (permission: string, raw: string | undefined) => {
    if (!raw) return
    const norm = String(raw).trim().toLowerCase()
    let action: Action = "ask"
    if (norm === "allow" || norm === "allowed") action = "allow"
    else if (norm === "block" || norm === "deny" || norm === "denied") action = "deny"
    else if (norm === "approval" || norm === "ask" || norm === "prompt") action = "ask"
    else return
    rules.push({ permission, pattern: "*", action })
  }

  // Core tool families
  push("bash", defaults["filesystem.shell"] || defaults["shell.execute"])
  push("edit", defaults["filesystem.write"])
  push("write", defaults["filesystem.write"])
  push("read", defaults["filesystem.read"])
  push("webfetch", defaults["network.fetch"])
  push("websearch", defaults["network.fetch"])
  push("external_directory", defaults["filesystem.write"])
  push("skill", defaults["skills.imported"] || defaults["skills.native"])
  push("task", defaults["subagents.delegate"])

  // Private network: force deny on fetch when blocked
  if (String(defaults["network.private"] || "").toLowerCase() === "block") {
    // Keep webfetch as ask/allow from network.fetch; private is gateway SSRF concern.
    // Document-only overlay — do not hard-deny all fetch.
  }

  // External effects
  if (defaults["externalEffectsRequireApproval"] === "true") {
    push("bash", "approval")
    push("webfetch", "approval")
  }

  return rules
}

function readJsonFile(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

export function resolveProductPermissionsConfigPath(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const root =
    workspaceRootFromEnv(env) ||
    readRuntimeBridgeFile(env)?.workspaceRoot ||
    readRuntimeBridgeFile(env)?.monorepoRoot ||
    env.ZAVORTH_CODE_ROOT ||
    undefined
  if (!root || !path.isAbsolute(String(root))) {
    // Still allow relative workspace root when set
    if (typeof env.ZAVORTH_WORKSPACE_ROOT === "string" && env.ZAVORTH_WORKSPACE_ROOT.trim()) {
      return path.resolve(env.ZAVORTH_WORKSPACE_ROOT.trim(), "config", "runtime-permissions.json")
    }
    return undefined
  }
  return path.join(String(root), "config", "runtime-permissions.json")
}

/**
 * Load product permission ruleset when authority is gateway.
 * Sync + file-based (same config Control/gateway use) so TUI does not need a live
 * gateway HTTP round-trip for every tool call.
 */
export function loadGatewayPolicySnapshot(env: NodeJS.ProcessEnv = process.env): GatewayPolicySnapshot {
  const hosted = isProductHosted(env)
  const authority = resolvePolicyAuthority(env)
  const gatewayBaseUrl = getProductGatewayBaseUrl(env)

  if (!hosted || authority !== "gateway") {
    return {
      authority: "local",
      hosted,
      source: "none",
      ruleset: [],
      gatewayBaseUrl,
      detail: hosted ? "policy authority local" : "standalone — local permissions only",
    }
  }

  const configPath = resolveProductPermissionsConfigPath(env)
  if (configPath) {
    const doc = readJsonFile(configPath) as {
      profile?: string
      defaults?: Record<string, string>
      safety?: { externalEffectsRequireApproval?: boolean }
    } | null
    if (doc && doc.defaults && typeof doc.defaults === "object") {
      const defaults = { ...doc.defaults }
      if (doc.safety?.externalEffectsRequireApproval) {
        // ensure shell/network stay approval-gated when safety flag set
        if (!defaults["filesystem.shell"]) defaults["filesystem.shell"] = "approval"
        if (!defaults["network.fetch"]) defaults["network.fetch"] = "approval"
      }
      const ruleset = mapProductDefaultsToRuleset(defaults)
      return {
        authority: "gateway",
        hosted: true,
        source: "product-config",
        configPath,
        ruleset,
        profile: typeof doc.profile === "string" ? doc.profile : undefined,
        gatewayBaseUrl,
        detail: `product permissions (${doc.profile || "default"}) · ${path.basename(configPath)}`,
      }
    }
  }

  const fallback = resolvePolicyFallback(env)
  if (fallback === "fail") {
    return {
      authority: "gateway",
      hosted: true,
      source: "fail-closed",
      configPath,
      ruleset: [
        { permission: "bash", pattern: "*", action: "deny" },
        { permission: "edit", pattern: "*", action: "deny" },
        { permission: "write", pattern: "*", action: "deny" },
        { permission: "webfetch", pattern: "*", action: "deny" },
        { permission: "websearch", pattern: "*", action: "deny" },
      ],
      gatewayBaseUrl,
      detail: "gateway authority but no product policy file — fail-closed (ZAVORTH_POLICY_FALLBACK=fail)",
    }
  }

  return {
    authority: "gateway",
    hosted: true,
    source: "none",
    configPath,
    ruleset: [],
    gatewayBaseUrl,
    detail: "gateway authority declared; product policy file missing — local rules only (fallback=local)",
  }
}

/**
 * Merge local agent ruleset with product gateway overlay.
 * Product rules are appended so evaluate()'s findLast prefers product policy.
 */
export function mergeWithGatewayPolicy(local: Ruleset, env: NodeJS.ProcessEnv = process.env): Ruleset {
  const snap = loadGatewayPolicySnapshot(env)
  if (!snap.ruleset.length) return local
  return [...local, ...snap.ruleset]
}

export function getGatewayPolicySummary(env: NodeJS.ProcessEnv = process.env): {
  authority: PolicyAuthority
  detail: string
  source: GatewayPolicySnapshot["source"]
  profile?: string
} {
  const snap = loadGatewayPolicySnapshot(env)
  const host = getHostRuntimeSummary(env)
  return {
    authority: snap.authority,
    detail: snap.detail || host.detail,
    source: snap.source,
    profile: snap.profile,
  }
}

export type RemotePermissionEval = {
  ok: boolean
  action?: Action
  source?: string
  error?: string
  status?: number
}

/**
 * Live evaluate against ai-gateway POST /api/experience/permissions/evaluate.
 * Short timeout; never throws. Callers treat !ok as "use local merge only".
 *
 * Disable with ZAVORTH_POLICY_REMOTE=0. Default: on when authority=gateway and hosted.
 */
export async function evaluatePermissionViaGateway(opts: {
  permission: string
  patterns: string[]
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
}): Promise<RemotePermissionEval> {
  const env = opts.env ?? process.env
  if (resolvePolicyAuthority(env) !== "gateway" || !isProductHosted(env)) {
    return { ok: false, error: "not-gateway-authority" }
  }
  const remoteOff =
    env.ZAVORTH_POLICY_REMOTE === "0" ||
    env.ZAVORTH_POLICY_REMOTE === "false" ||
    env.ZAVORTH_POLICY_REMOTE === "no" ||
    env.ZAVORTH_POLICY_REMOTE === "off"
  if (remoteOff) return { ok: false, error: "remote-disabled" }

  const base = getProductGatewayBaseUrl(env).replace(/\/+$/, "")
  const url = `${base}/api/experience/permissions/evaluate`
  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 1500
  const token =
    (typeof env.ZAVORTH_MANAGEMENT_TOKEN === "string" && env.ZAVORTH_MANAGEMENT_TOKEN.trim()) ||
    (typeof env.ZAVORTH_GATEWAY_TOKEN === "string" && env.ZAVORTH_GATEWAY_TOKEN.trim()) ||
    ""

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        permission: opts.permission,
        patterns: opts.patterns,
      }),
      signal: ac.signal,
    })
    clearTimeout(timer)
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean
      action?: string
      source?: string
      error?: string
    } | null
    if (!res.ok || !json) {
      return { ok: false, status: res.status, error: json?.error || `http-${res.status}` }
    }
    const action = String(json.action || "").toLowerCase()
    if (action !== "allow" && action !== "deny" && action !== "ask") {
      return { ok: false, status: res.status, error: "invalid-action" }
    }
    return {
      ok: true,
      action: action as Action,
      source: json.source,
      status: res.status,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

