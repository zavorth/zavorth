/**
 * Code bridge Node smoke suite (no Next server required).
 *
 * - runSmoke() against isolated ZAVORTH_HOME
 * - fake ops-bridge.json → assert summarize tones (ready / approvals / stale)
 * - cleans temp dir
 * - exit 1 on failure
 *
 *   node scripts/code-bridge-suite.mjs
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bridgeUrl = pathToFileURL(path.join(root, "scripts/lib/zavorth-code-bridge.mjs")).href

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg || "assertion failed")
  }
}

function rmrf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

function writeOps(env, payload) {
  const dir = path.join(env.ZAVORTH_HOME, "state")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "ops-bridge.json"), JSON.stringify(payload, null, 2), "utf8")
}

async function main() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-code-bridge-suite-"))
  const env = { ...process.env, ZAVORTH_HOME: home }
  delete env.MIMOCODE_HOME

  let failures = 0
  const bridge = await import(bridgeUrl)

  try {
    // 1) local runSmoke under isolated home
    process.env.ZAVORTH_HOME = home
    if (!bridge.runSmoke(env)) {
      console.error("FAIL: runSmoke")
      failures += 1
    } else {
      console.log("PASS: runSmoke")
    }

    // 2) ready tone
    writeOps(env, {
      version: 1,
      product: "zavorth-code",
      updatedAt: Date.now(),
      ready: true,
      providerReady: true,
      approvals: 0,
      sessions: 1,
      headline: "Suite ready",
      nextAction: "",
      checks: [{ id: "provider", ok: true, label: "Provider" }],
    })
    {
      const s = bridge.summarizeCodeBridge(env)
      try {
        assert(s.tone === "ready", `expected ready, got ${s.tone}`)
        assert(s.label === "Code ready", `label=${s.label}`)
        assert(s.opsFresh === true, "opsFresh should be true")
        console.log("PASS: summarize ready")
      } catch (e) {
        console.error("FAIL: summarize ready —", e.message)
        failures += 1
      }
    }

    // 3) approvals warning
    writeOps(env, {
      version: 1,
      product: "zavorth-code",
      updatedAt: Date.now(),
      ready: false,
      providerReady: true,
      approvals: 3,
      sessions: 1,
      headline: "Need eyes",
      nextAction: "Review tools",
      checks: [],
    })
    {
      const s = bridge.summarizeCodeBridge(env)
      try {
        assert(s.tone === "warning", `expected warning, got ${s.tone}`)
        assert(s.label === "Code · 3 approvals", `label=${s.label}`)
        console.log("PASS: summarize approvals")
      } catch (e) {
        console.error("FAIL: summarize approvals —", e.message)
        failures += 1
      }
    }

    // 4) stale muted
    writeOps(env, {
      version: 1,
      product: "zavorth-code",
      updatedAt: Date.now() - (bridge.OPS_STALE_MS + 5_000),
      ready: true,
      providerReady: true,
      approvals: 0,
      sessions: 0,
      headline: "Old",
      nextAction: "",
      checks: [],
    })
    {
      const s = bridge.summarizeCodeBridge(env)
      try {
        assert(s.tone === "muted", `expected muted, got ${s.tone}`)
        assert(s.label === "Code stale", `label=${s.label}`)
        assert(s.opsFresh === false, "opsFresh should be false when stale")
        console.log("PASS: summarize stale")
      } catch (e) {
        console.error("FAIL: summarize stale —", e.message)
        failures += 1
      }
    }

    // 5) resolveCodeStateDir isolation
    try {
      const dir = bridge.resolveCodeStateDir(env)
      assert(dir === path.join(home, "state"), `stateDir=${dir}`)
      console.log("PASS: resolveCodeStateDir")
    } catch (e) {
      console.error("FAIL: resolveCodeStateDir —", e.message)
      failures += 1
    }

    // 6) singular approval label
    writeOps(env, {
      version: 1,
      product: "zavorth-code",
      updatedAt: Date.now(),
      ready: false,
      providerReady: true,
      approvals: 1,
      sessions: 2,
      headline: "One approval",
      nextAction: "Review",
      checks: [{ id: "approvals", ok: false, label: "Approvals pending" }],
    })
    {
      const s = bridge.summarizeCodeBridge(env)
      try {
        assert(s.tone === "warning", `expected warning, got ${s.tone}`)
        assert(s.label === "Code · 1 approval", `label=${s.label}`)
        assert(Array.isArray(s.ops?.checks) && s.ops.checks.length === 1, "checks missing")
        console.log("PASS: summarize singular approval + checks")
      } catch (e) {
        console.error("FAIL: singular approval —", e.message)
        failures += 1
      }
    }

    // 7) provider missing
    writeOps(env, {
      version: 1,
      product: "zavorth-code",
      updatedAt: Date.now(),
      ready: false,
      providerReady: false,
      approvals: 0,
      sessions: 0,
      headline: "No provider",
      nextAction: "Connect",
      checks: [{ id: "provider", ok: false, label: "Provider missing" }],
    })
    {
      const s = bridge.summarizeCodeBridge(env)
      try {
        assert(s.tone === "warning", `expected warning, got ${s.tone}`)
        assert(s.label === "Code · needs provider", `label=${s.label}`)
        console.log("PASS: summarize needs provider")
      } catch (e) {
        console.error("FAIL: needs provider —", e.message)
        failures += 1
      }
    }

    // 8) heartbeat name roundtrip
    try {
      bridge.writeCompanionStatus({ name: "Zavorth Control", online: true }, env)
      const st = bridge.readCompanionStatus(env)
      assert(st.online === true, "heartbeat should be online")
      assert(st.name === "Zavorth Control", `name=${st.name}`)
      console.log("PASS: companion heartbeat name")
    } catch (e) {
      console.error("FAIL: companion heartbeat —", e.message)
      failures += 1
    }
  } finally {
    rmrf(home)
    console.log("cleaned temp dir")
  }

  if (failures > 0) {
    console.error(`code-bridge-suite: ${failures} failure(s)`)
    process.exit(1)
  }
  console.log("code-bridge-suite: all passed")
  process.exit(0)
}

main().catch((error) => {
  console.error("code-bridge-suite crashed:", error)
  process.exit(1)
})
