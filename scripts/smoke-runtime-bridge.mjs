/**
 * Product runtime bridge smoke (no TUI required).
 *
 * 1. resolve contract without write
 * 2. write under temp ZAVORTH_HOME
 * 3. assert file fields
 * 4. buildTuiChildEnv has required keys
 * 5. optional soft HTTP probe to gateway (does not fail if down)
 *
 *   node scripts/smoke-runtime-bridge.mjs
 *   npm run code:runtime-bridge:smoke
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bridgeUrl = pathToFileURL(
  path.join(root, "scripts/lib/zavorth-runtime-bridge.mjs"),
).href

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed")
}

function rmrf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

async function softProbeGateway(baseUrl) {
  const candidates = [
    `${baseUrl}/api/code-bridge`,
    `${baseUrl}/api/health`,
    `${baseUrl}/health`,
  ]
  for (const url of candidates) {
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 1500)
      const res = await fetch(url, { signal: ac.signal, method: "GET" })
      clearTimeout(timer)
      return { ok: res.ok || res.status < 500, url, status: res.status }
    } catch (err) {
      // try next
      void err
    }
  }
  return { ok: false, url: candidates[0], status: 0, soft: true }
}

async function main() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-runtime-bridge-smoke-"))
  const env = {
    ...process.env,
    ZAVORTH_HOME: home,
  }
  delete env.MIMOCODE_HOME
  delete env.ZAVORTH_GATEWAY_BASE_URL
  delete env.ZavorthGateway_BASE_URL
  delete env.BASE_URL
  delete env.NEXT_PUBLIC_BASE_URL

  let failures = 0
  const bridge = await import(bridgeUrl)
  const projectRoot = root

  try {
    // 1) resolve without write
    try {
      const resolveFn = bridge.resolveHostRuntimeContract || bridge.resolveMonorepoRuntimeContract
      const contract = resolveFn({
        projectRoot,
        env,
        updatedAt: 1,
      })
      assert(contract.version === 1, "version")
      assert(contract.source === "workspace" || contract.source === "monorepo", "source")
      assert(contract.entry === "code-tui", "entry")
      assert(contract.product === "zavorth-terminal", "product")
      assert(contract.policyAuthority === "gateway", "policy")
      assert(
        contract.gatewayBaseUrl === bridge.DEFAULT_GATEWAY_BASE_URL,
        `default gw got ${contract.gatewayBaseUrl}`,
      )
      const rootField = contract.workspaceRoot || contract.monorepoRoot
      assert(rootField === path.resolve(projectRoot), "workspaceRoot")
      assert(
        !fs.existsSync(bridge.runtimeBridgePath(env)),
        "must not write on resolve",
      )
      console.log("PASS: resolveHostRuntimeContract (no write)")
    } catch (e) {
      console.error("FAIL: resolve —", e.message)
      failures += 1
    }

    // 2–3) write + assert fields
    try {
      env.ZavorthGateway_BASE_URL = "http://localhost:20128/"
      const payload = bridge.writeRuntimeBridge({
        projectRoot,
        env,
        updatedAt: 12345,
      })
      const file = bridge.runtimeBridgePath(env)
      assert(fs.existsSync(file), `missing ${file}`)
      const onDisk = JSON.parse(fs.readFileSync(file, "utf8"))
      assert(onDisk.version === 1, "file version")
      assert(onDisk.source === "workspace" || onDisk.source === "monorepo", "file source")
      assert(onDisk.entry === "code-tui", "file entry")
      assert(onDisk.product === "zavorth-terminal", "file product")
      assert(onDisk.gatewayBaseUrl === "http://localhost:20128", "file gateway")
      assert(onDisk.policyAuthority === "gateway", "file policy")
      assert(onDisk.updatedAt === 12345, "file updatedAt")
      assert(onDisk.bridges?.ops === "ops-bridge.json", "bridges.ops")
      assert(payload.gatewayBaseUrl === onDisk.gatewayBaseUrl, "payload match")
      console.log("PASS: writeRuntimeBridge fields")
      console.log("  file:", file)
    } catch (e) {
      console.error("FAIL: write —", e.message)
      failures += 1
    }

    // 4) child env keys
    try {
      const child = bridge.buildTuiChildEnv({ projectRoot, env })
      const required = [
        ["ZAVORTH_RUNTIME_SOURCE", "workspace"],
        ["ZAVORTH_POLICY_AUTHORITY", "gateway"],
        ["ZAVORTH_CODE_FROM_WORKSPACE", "1"],
      ]
      for (const [k, v] of required) {
        assert(child[k] === v, `${k}=${child[k]} expected ${v}`)
      }
      assert(
        typeof child.ZAVORTH_WORKSPACE_ROOT === "string" &&
          path.isAbsolute(child.ZAVORTH_WORKSPACE_ROOT),
        "ZAVORTH_WORKSPACE_ROOT absolute",
      )
      assert(
        typeof child.ZAVORTH_GATEWAY_BASE_URL === "string" &&
          child.ZAVORTH_GATEWAY_BASE_URL.length > 0,
        "ZAVORTH_GATEWAY_BASE_URL set",
      )
      console.log("PASS: buildTuiChildEnv required keys")
    } catch (e) {
      console.error("FAIL: child env —", e.message)
      failures += 1
    }

    // resolve order quick check
    try {
      const e2 = {
        ...env,
        ZAVORTH_GATEWAY_BASE_URL: "http://a/",
        ZavorthGateway_BASE_URL: "http://b",
        BASE_URL: "http://c",
      }
      assert(bridge.resolveGatewayBaseUrl(e2) === "http://a", "prefer ZAVORTH_GATEWAY_BASE_URL")
      const e3 = {
        ...env,
        ZavorthGateway_BASE_URL: "http://b/",
        BASE_URL: "http://c",
      }
      delete e3.ZAVORTH_GATEWAY_BASE_URL
      assert(bridge.resolveGatewayBaseUrl(e3) === "http://b", "prefer ZavorthGateway_BASE_URL")
      console.log("PASS: resolveGatewayBaseUrl order")
    } catch (e) {
      console.error("FAIL: resolve order —", e.message)
      failures += 1
    }

    // 5) soft gateway probe
    const gw = bridge.resolveGatewayBaseUrl(env)
    const probe = await softProbeGateway(gw)
    if (probe.ok) {
      console.log(`PASS: soft gateway probe ${probe.url} status=${probe.status}`)
    } else if (probe.soft) {
      console.log(
        `SOFT: gateway not reachable at ${gw} (ok for offline smoke) — ${probe.url}`,
      )
    } else {
      console.log(`SOFT: gateway probe non-ok status=${probe.status} url=${probe.url}`)
    }
  } finally {
    rmrf(home)
  }

  if (failures > 0) {
    console.error(`\nRuntime bridge smoke FAILED (${failures})`)
    process.exit(1)
  }
  console.log("\nRuntime bridge smoke OK")
  process.exit(0)
}

main().catch((err) => {
  console.error("Runtime bridge smoke crashed:", err)
  process.exit(1)
})
