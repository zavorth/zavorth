/**
 * Monorepo gateway approvals client (experience API).
 *
 * Endpoints (loopback auth allowed by requireManagementAuth):
 *   GET  {base}/api/experience/approvals
 *   POST {base}/api/experience/approvals/{id}/decision
 *        body: { decision: "approve" | "reject" }
 *
 * Soft-fails when gateway is down — callers fall back to local snapshot.
 */
import http from "node:http"
import https from "node:https"

export const DEFAULT_GATEWAY_BASE_URL = "http://localhost:20128"

/** @param {NodeJS.ProcessEnv} [env] */
export function resolveGatewayBaseUrl(env = process.env) {
  const pick = (v) => {
    if (typeof v !== "string") return null
    const t = v.trim()
    if (!t) return null
    return t.replace(/\/+$/, "")
  }
  return (
    pick(env.ZAVORTH_GATEWAY_BASE_URL) ||
    pick(env.ZavorthGateway_BASE_URL) ||
    pick(env.BASE_URL) ||
    pick(env.NEXT_PUBLIC_BASE_URL) ||
    DEFAULT_GATEWAY_BASE_URL
  )
}

/**
 * Management auth headers for non-loopback gateway calls.
 * Loopback still works without a token (requireManagementAuth allows it).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Record<string, string>}
 */
export function managementAuthHeaders(env = process.env) {
  const token =
    (typeof env.ZAVORTH_MANAGEMENT_TOKEN === "string" && env.ZAVORTH_MANAGEMENT_TOKEN.trim()) ||
    (typeof env.ZAVORTH_GATEWAY_TOKEN === "string" && env.ZAVORTH_GATEWAY_TOKEN.trim()) ||
    (typeof env.ZAVORTH_AUTH_TOKEN === "string" && env.ZAVORTH_AUTH_TOKEN.trim()) ||
    (typeof env.ZAVORTH_WEB_AUTH_TOKEN === "string" && env.ZAVORTH_WEB_AUTH_TOKEN.trim()) ||
    ""
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

/**
 * @param {string} url
 * @param {{ method?: string, body?: unknown, headers?: Record<string,string>, timeoutMs?: number, env?: NodeJS.ProcessEnv }} [opts]
 */
function requestJson(url, opts = {}) {
  const method = opts.method || "GET"
  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 4000
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : null
  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    try {
      const u = new URL(url)
      const lib = u.protocol === "https:" ? https : http
      const headers = {
        Accept: "application/json",
        ...managementAuthHeaders(opts.env || process.env),
        ...(opts.headers || {}),
      }
      if (bodyStr) {
        headers["Content-Type"] = "application/json"
        headers["Content-Length"] = Buffer.byteLength(bodyStr)
      }
      const req = lib.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (u.protocol === "https:" ? 443 : 80),
          path: `${u.pathname}${u.search}`,
          method,
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          const chunks = []
          res.on("data", (c) => chunks.push(c))
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8")
            let json
            try {
              json = raw ? JSON.parse(raw) : null
            } catch {
              json = null
            }
            finish({
              ok: typeof res.statusCode === "number" && res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode || 0,
              json,
              raw,
            })
          })
        },
      )
      req.on("error", (err) => finish({ ok: false, status: 0, error: err.message, json: null }))
      req.on("timeout", () => {
        req.destroy()
        finish({ ok: false, status: 0, error: "timeout", json: null })
      })
      if (bodyStr) req.write(bodyStr)
      req.end()
    } catch (err) {
      finish({
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : String(err),
        json: null,
      })
    }
  })
}

/**
 * @param {{ baseUrl?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number }} [opts]
 */
export async function listApprovals(opts = {}) {
  const env = opts.env || process.env
  const base = (opts.baseUrl || resolveGatewayBaseUrl(env)).replace(/\/+$/, "")
  const url = `${base}/api/experience/approvals`
  const res = await requestJson(url, { method: "GET", timeoutMs: opts.timeoutMs, env })
  if (!res.ok) {
    const authHint =
      res.status === 401 || res.status === 403
        ? " Set ZAVORTH_MANAGEMENT_TOKEN (or ZAVORTH_GATEWAY_TOKEN) for non-loopback hosts."
        : ""
    return {
      ok: false,
      source: "gateway",
      baseUrl: base,
      error: (res.error || `HTTP ${res.status}`) + authHint,
      status: res.status,
      approvals: [],
      authRequired: res.status === 401 || res.status === 403,
    }
  }
  const approvals = Array.isArray(res.json?.approvals) ? res.json.approvals : []
  return {
    ok: true,
    source: "gateway",
    baseUrl: base,
    status: res.status,
    approvals,
    trust: res.json?.trust,
    generatedAt: res.json?.generatedAt,
  }
}

/**
 * @param {{ id: string, decision: 'approve'|'reject'|'grant'|'deny', baseUrl?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number }} opts
 */
export async function decideApproval(opts) {
  const env = opts.env || process.env
  const base = (opts.baseUrl || resolveGatewayBaseUrl(env)).replace(/\/+$/, "")
  const id = String(opts.id || "").trim()
  if (!id) {
    return { ok: false, error: "approval id required", baseUrl: base }
  }
  let decision = String(opts.decision || "approve").trim().toLowerCase()
  if (decision === "grant" || decision === "approved") decision = "approve"
  if (decision === "deny" || decision === "rejected" || decision === "reject") decision = "reject"
  if (decision !== "approve" && decision !== "reject") {
    return { ok: false, error: `invalid decision: ${opts.decision}`, baseUrl: base }
  }
  const url = `${base}/api/experience/approvals/${encodeURIComponent(id)}/decision`
  const res = await requestJson(url, {
    method: "POST",
    body: { decision },
    timeoutMs: opts.timeoutMs,
    env,
  })
  if (!res.ok) {
    const authHint =
      res.status === 401 || res.status === 403
        ? " Set ZAVORTH_MANAGEMENT_TOKEN for non-loopback gateway hosts."
        : ""
    return {
      ok: false,
      source: "gateway",
      baseUrl: base,
      id,
      decision,
      error: (res.error || `HTTP ${res.status}`) + authHint,
      status: res.status,
      body: res.json,
      authRequired: res.status === 401 || res.status === 403,
    }
  }
  return {
    ok: true,
    source: "gateway",
    baseUrl: base,
    id,
    decision,
    status: res.status,
    body: res.json,
  }
}

function main() {
  const argv = process.argv.slice(2)
  const env = process.env
  const base = resolveGatewayBaseUrl(env)
  if (argv[0] === "list" || argv.includes("--list")) {
    listApprovals({ env }).then((r) => {
      console.log(JSON.stringify(r, null, 2))
      process.exit(r.ok ? 0 : 1)
    })
    return
  }
  if (argv[0] === "decide" || argv[0] === "grant" || argv[0] === "deny") {
    const decision = argv[0] === "deny" ? "reject" : argv[0] === "grant" ? "approve" : argv[2] || "approve"
    const id = argv[0] === "decide" ? argv[1] : argv[1]
    decideApproval({ id, decision, env }).then((r) => {
      console.log(JSON.stringify(r, null, 2))
      process.exit(r.ok ? 0 : 1)
    })
    return
  }
  console.log(
    JSON.stringify(
      {
        baseUrl: base,
        list: "GET /api/experience/approvals",
        decide: "POST /api/experience/approvals/:id/decision",
      },
      null,
      2,
    ),
  )
}

if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("zavorth-approvals.mjs")
) {
  main()
}
