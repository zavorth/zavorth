/**
 * Host runtime helpers for the Zavorth product entry.
 *
 * When the Code TUI is launched via `zavorth` (product host), these helpers
 * resolve gateway URL, policy authority, and OpenAI/Anthropic-compatible base URLs.
 *
 * Contract: docs/protocol/zavorth-runtime-bridge.md
 * Writer:   scripts/lib/zavorth-runtime-bridge.mjs
 */
import fs from "fs"
import os from "os"
import path from "path"

export const DEFAULT_GATEWAY_BASE_URL = "http://localhost:20128"

export type HostRuntimeBridge = {
  version: 1
  updatedAt: number
  /** Product host identity (legacy value "monorepo" still accepted when reading). */
  source: "workspace" | "monorepo"
  entry: "code-tui"
  product: "zavorth-terminal"
  workspaceRoot: string
  /** @deprecated prefer workspaceRoot; kept for older bridge files */
  monorepoRoot?: string
  gatewayBaseUrl: string
  policyAuthority: "gateway"
  bridges?: {
    ops?: string
    companion?: string
    companionStatus?: string
  }
}

export type HostRuntimeSummary = {
  hosted: boolean
  gatewayBaseUrl: string
  policyAuthority: string
  workspaceRoot?: string
  source: "env" | "file" | "none"
  label: string
  detail: string
}

function normalizeBaseUrl(value?: string | null): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, "")
}

function hostedSourceEnv(env: NodeJS.ProcessEnv): boolean {
  const src = String(env.ZAVORTH_RUNTIME_SOURCE || "").trim().toLowerCase()
  return src === "workspace" || src === "zavorth" || src === "monorepo" || src === "product"
}

function fromWorkspaceFlag(env: NodeJS.ProcessEnv): boolean {
  return env.ZAVORTH_CODE_FROM_WORKSPACE === "1" || env.ZAVORTH_CODE_FROM_MONOREPO === "1"
}

export function workspaceRootFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const v = env.ZAVORTH_WORKSPACE_ROOT || env.ZAVORTH_MONOREPO_ROOT
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

/** Align with product state dir (same as ops/companion bridges). */
export function resolveRuntimeStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.ZAVORTH_HOME || env.MIMOCODE_HOME
  if (home) {
    if (!path.isAbsolute(home)) {
      throw new Error(`ZAVORTH_HOME must be an absolute path, got: ${JSON.stringify(home)}`)
    }
    return path.join(home, "state")
  }
  const xdg = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state")
  return path.join(xdg, "zavorth")
}

export function runtimeBridgeFilePath(env: NodeJS.ProcessEnv = process.env): string {
  const override = typeof env.ZAVORTH_RUNTIME_BRIDGE_FILE === "string" ? env.ZAVORTH_RUNTIME_BRIDGE_FILE.trim() : ""
  if (override && path.isAbsolute(override)) return override
  return path.join(resolveRuntimeStateDir(env), "runtime-bridge.json")
}

export function resolveGatewayBaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (
    normalizeBaseUrl(env.ZAVORTH_GATEWAY_BASE_URL) ||
    normalizeBaseUrl(env.ZavorthGateway_BASE_URL) ||
    normalizeBaseUrl(env.BASE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_BASE_URL) ||
    DEFAULT_GATEWAY_BASE_URL
  )
}

/** Best-effort sync read of runtime-bridge.json. */
export function readRuntimeBridgeFile(
  env: NodeJS.ProcessEnv = process.env,
): HostRuntimeBridge | undefined {
  try {
    const filePath = runtimeBridgeFilePath(env)
    if (!fs.existsSync(filePath)) return undefined
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<HostRuntimeBridge> & {
      monorepoRoot?: string
      source?: string
    }
    if (raw.version !== 1) return undefined
    const sourceOk = raw.source === "workspace" || raw.source === "monorepo" || raw.source === "zavorth"
    if (!sourceOk) return undefined
    if (typeof raw.gatewayBaseUrl !== "string" || !raw.gatewayBaseUrl.trim()) return undefined
    const workspaceRoot =
      (typeof raw.workspaceRoot === "string" && raw.workspaceRoot.trim()) ||
      (typeof raw.monorepoRoot === "string" && raw.monorepoRoot.trim()) ||
      ""
    if (!workspaceRoot) return undefined
    return {
      version: 1,
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
      source: raw.source === "monorepo" ? "monorepo" : "workspace",
      entry: "code-tui",
      product: "zavorth-terminal",
      workspaceRoot,
      monorepoRoot: workspaceRoot,
      gatewayBaseUrl: raw.gatewayBaseUrl.replace(/\/+$/, ""),
      policyAuthority: "gateway",
      bridges: raw.bridges,
    }
  } catch {
    return undefined
  }
}

/** True when launched from the product `zavorth` host entry. */
export function isProductHosted(env: NodeJS.ProcessEnv = process.env): boolean {
  if (hostedSourceEnv(env) || fromWorkspaceFlag(env)) return true
  const file = readRuntimeBridgeFile(env)
  return file?.source === "workspace" || file?.source === "monorepo"
}

export function getProductGatewayBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv =
    normalizeBaseUrl(env.ZAVORTH_GATEWAY_BASE_URL) ||
    normalizeBaseUrl(env.ZavorthGateway_BASE_URL) ||
    normalizeBaseUrl(env.BASE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_BASE_URL)
  if (fromEnv) return fromEnv
  const file = readRuntimeBridgeFile(env)
  if (file?.gatewayBaseUrl) return file.gatewayBaseUrl
  return DEFAULT_GATEWAY_BASE_URL
}

export function productOpenAiCompatibleBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const gateway = getProductGatewayBaseUrl(env)
  if (gateway === "/v1" || gateway.endsWith("/v1")) return gateway
  return `${gateway}/v1`
}

function envFlagTrue(value: string | undefined): boolean {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
  return s === "1" || s === "true" || s === "yes" || s === "on"
}

function envFlagFalse(value: string | undefined): boolean {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
  return s === "0" || s === "false" || s === "no" || s === "off"
}

/**
 * Anthropic → product gateway routing.
 *
 * Anthropic uses the native SDK (`@ai-sdk/anthropic`), which posts to `{baseURL}/messages`.
 * The product ai-gateway already exposes Claude-format **POST /v1/messages**, so the
 * correct product baseURL is the same OpenAI-compatible root: `{gateway}/v1`.
 *
 * Policy:
 * - **Product-hosted (automatic):** route through gateway (no extra flag).
 * - **Opt-out:** `ZAVORTH_ROUTE_ANTHROPIC=0|false|no|off` or `ZAVORTH_ANTHROPIC_DIRECT=1`
 * - **Explicit opt-in:** `ZAVORTH_ROUTE_ANTHROPIC=1` (redundant when product-hosted)
 * - **Never** via `ZAVORTH_ROUTE_PROVIDERS` alone on a standalone (non-hosted) process
 * - Legacy `ZAVORTH_MONOREPO_ROUTE_ANTHROPIC` still accepted when reading
 */
export function isAnthropicProductRouteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (
    envFlagFalse(env.ZAVORTH_ROUTE_ANTHROPIC) ||
    envFlagFalse(env.ZAVORTH_MONOREPO_ROUTE_ANTHROPIC) ||
    envFlagTrue(env.ZAVORTH_ANTHROPIC_DIRECT)
  ) {
    return false
  }
  if (
    envFlagTrue(env.ZAVORTH_ROUTE_ANTHROPIC) ||
    envFlagTrue(env.ZAVORTH_MONOREPO_ROUTE_ANTHROPIC)
  ) {
    return true
  }
  // Automatic when launched via product `zavorth` host (gateway /v1/messages).
  return isProductHosted(env)
}

function isAnthropicProviderId(providerID: string): boolean {
  return providerID === "anthropic" || providerID.startsWith("anthropic")
}

/**
 * OpenAI-compatible product gateway routing (non-Anthropic allowlist).
 *
 * - Product-hosted: automatic (same posture as Anthropic)
 * - Opt-out: `ZAVORTH_ROUTE_PROVIDERS=0|false|no|off` or `ZAVORTH_PROVIDERS_DIRECT=1`
 * - Explicit on: `ZAVORTH_ROUTE_PROVIDERS=1` (also works without product host when set)
 * - Allowlist via `ZAVORTH_ROUTE_PROVIDER_IDS` (default: openai,openrouter,groq,deepseek,xai)
 */
export function isOpenAiCompatibleProductRouteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (
    envFlagFalse(env.ZAVORTH_ROUTE_PROVIDERS) ||
    envFlagFalse(env.ZAVORTH_MONOREPO_ROUTE_PROVIDERS) ||
    envFlagTrue(env.ZAVORTH_PROVIDERS_DIRECT)
  ) {
    return false
  }
  if (
    envFlagTrue(env.ZAVORTH_ROUTE_PROVIDERS) ||
    envFlagTrue(env.ZAVORTH_MONOREPO_ROUTE_PROVIDERS)
  ) {
    return true
  }
  return isProductHosted(env)
}

/** Default openai-compatible provider ids eligible for product gateway baseURL. */
export function productOpenAiCompatibleProviderIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw =
    env.ZAVORTH_ROUTE_PROVIDER_IDS ||
    env.ZAVORTH_MONOREPO_PROVIDER_IDS ||
    "openai,openrouter,groq,deepseek,xai"
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((id) => id && !isAnthropicProviderId(id))
}

/**
 * Providers that may use product gateway as baseURL.
 * - `zavorth` always when product-hosted (and when routable resolution runs)
 * - openai-compatible allowlist when product-hosted (auto) unless opted out
 * - `anthropic*` when product-hosted (auto) unless opted out
 */
export function isProductRoutableProvider(
  providerID: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const id = String(providerID || "")
    .trim()
    .toLowerCase()
  if (!id) return false
  if (id === "zavorth") return true

  if (isAnthropicProviderId(id)) {
    return isAnthropicProductRouteEnabled(env)
  }

  if (!isOpenAiCompatibleProductRouteEnabled(env)) return false

  const allow = new Set(productOpenAiCompatibleProviderIds(env))
  return allow.has(id)
}

export type ResolveOpenAiCompatibleBaseUrlOpts = {
  existingBaseUrl?: string | null
  env?: NodeJS.ProcessEnv
  providerID?: string | null
}

/**
 * Product Anthropic baseURL when routing is enabled.
 * `ZAVORTH_ANTHROPIC_BASE_URL` overrides when set; else product gateway `…/v1`
 * (SDK appends `/messages` → ai-gateway POST /v1/messages).
 */
export function productAnthropicCompatibleBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (isAnthropicProductRouteEnabled(env)) {
    const explicit = normalizeBaseUrl(env.ZAVORTH_ANTHROPIC_BASE_URL)
    if (explicit) return explicit
  }
  return productOpenAiCompatibleBaseUrl(env)
}

/**
 * Resolve Anthropic SDK baseURL under product host.
 * Automatic when product-hosted (gateway Claude-format /v1/messages).
 * Opt-out: ZAVORTH_ROUTE_ANTHROPIC=0 or ZAVORTH_ANTHROPIC_DIRECT=1.
 * Explicit existingBaseUrl always wins.
 * Standalone (not product-hosted): undefined → vendor api.anthropic.com.
 */
export function resolveAnthropicCompatibleBaseUrl(
  opts: ResolveOpenAiCompatibleBaseUrlOpts = {},
): string | undefined {
  const env = opts.env ?? process.env
  const existing = normalizeBaseUrl(opts.existingBaseUrl ?? null)
  if (existing) return existing
  if (!isProductHosted(env)) return undefined
  if (!isAnthropicProductRouteEnabled(env)) return undefined
  const providerID = opts.providerID ?? "anthropic"
  if (!isProductRoutableProvider(providerID, env)) return undefined
  return productAnthropicCompatibleBaseUrl(env)
}

export function resolveOpenAiCompatibleBaseUrl(
  opts: ResolveOpenAiCompatibleBaseUrlOpts = {},
): string | undefined {
  const env = opts.env ?? process.env
  const existing = normalizeBaseUrl(opts.existingBaseUrl ?? null)
  if (existing) return existing
  if (!isProductHosted(env)) return undefined
  if (opts.providerID != null && opts.providerID !== "" && !isProductRoutableProvider(opts.providerID, env)) {
    return undefined
  }
  return productOpenAiCompatibleBaseUrl(env)
}

export function withProductProviderBaseUrl(
  options: Record<string, unknown> | undefined | null,
  env: NodeJS.ProcessEnv = process.env,
  providerID?: string | null,
): Record<string, unknown> {
  const base = options && typeof options === "object" ? { ...options } : {}
  const existing =
    typeof base.baseURL === "string" ? base.baseURL : typeof base.baseUrl === "string" ? base.baseUrl : undefined
  const resolved = resolveOpenAiCompatibleBaseUrl({
    existingBaseUrl: existing,
    env,
    providerID: providerID ?? "zavorth",
  })
  if (!resolved) return base
  if (normalizeBaseUrl(typeof existing === "string" ? existing : null)) return base
  base.baseURL = resolved
  return base
}

export function getHostRuntimeSummary(env: NodeJS.ProcessEnv = process.env): HostRuntimeSummary {
  const fromEnvSource = hostedSourceEnv(env) || fromWorkspaceFlag(env)
  const file = readRuntimeBridgeFile(env)
  const hosted = fromEnvSource || file?.source === "workspace" || file?.source === "monorepo"
  const source: HostRuntimeSummary["source"] = fromEnvSource ? "env" : file ? "file" : "none"
  const gatewayBaseUrl = getProductGatewayBaseUrl(env)
  const policyAuthority =
    env.ZAVORTH_POLICY_AUTHORITY || file?.policyAuthority || (hosted ? "gateway" : "local")
  const workspaceRoot = workspaceRootFromEnv(env) || file?.workspaceRoot || file?.monorepoRoot

  if (!hosted) {
    return {
      hosted: false,
      gatewayBaseUrl,
      policyAuthority: "local",
      workspaceRoot,
      source: "none",
      label: "Host runtime",
      detail: "standalone",
    }
  }

  return {
    hosted: true,
    gatewayBaseUrl,
    policyAuthority,
    workspaceRoot,
    source,
    label: "Host runtime",
    detail: `${gatewayBaseUrl} · policy=${policyAuthority}`,
  }
}


export function hostRuntimeOpsCheck(
  env: NodeJS.ProcessEnv = process.env,
): { id: string; ok: boolean; label: string; detail?: string } | undefined {
  try {
    if (!isProductHosted(env)) return undefined
    const summary = getHostRuntimeSummary(env)
    return {
      id: "host-runtime",
      ok: summary.hosted && !!summary.gatewayBaseUrl,
      label: summary.label,
      detail: summary.detail,
    }
  } catch {
    return undefined
  }
}
