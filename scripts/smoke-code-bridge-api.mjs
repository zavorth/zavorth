/**
 * Smoke production code-bridge lib (same logic as /api/code-bridge).
 * Does not require Next server — imports TS via dynamic path is hard; uses mjs helper parity.
 *
 *   node scripts/smoke-code-bridge-api.mjs
 *   node scripts/smoke-code-bridge-api.mjs --url http://127.0.0.1:3001
 */
import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bridgeUrl = pathToFileURL(path.join(root, "scripts/lib/zavorth-code-bridge.mjs")).href

async function smokeLocal() {
  const bridge = await import(bridgeUrl)
  if (!bridge.runSmoke()) {
    console.error("local bridge smoke failed")
    return false
  }
  const summary = bridge.summarizeCodeBridge()
  if (typeof summary.label !== "string") {
    console.error("bad summary", summary)
    return false
  }
  console.log("local lib ok:", summary.label)
  return true
}

async function smokeHttp(base) {
  const url = `${base.replace(/\/$/, "")}/api/code-bridge...name=smoke-api`
  try {
    const res = await fetch(url, { cache: "no-store" })
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      console.error("HTTP non-JSON", res.status, text.slice(0, 200))
      return false
    }
    if (!res.ok) {
      console.error("HTTP", res.status, data)
      return false
    }
    if (typeof data.label !== "string") {
      console.error("bad HTTP body", data)
      return false
    }
    console.log("HTTP GET ok:", data.label, data.tone)
    const post = await fetch(`${base.replace(/\/$/, "")}/api/code-bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "smoke-api" }),
    })
    const postJson = await post.json().catch(() => ({}))
    if (!post.ok || postJson.ok !== true) {
      console.error("HTTP POST failed", post.status, postJson)
      return false
    }
    console.log("HTTP POST heartbeat ok")
    return true
  } catch (error) {
    console.error("HTTP smoke failed (is gateway on :3001...):", error.message || error)
    return false
  }
}

async function main() {
  const urlIdx = process.argv.indexOf("--url")
  const base = urlIdx >= 0 ? process.argv[urlIdx + 1] : null
  let ok = await smokeLocal()
  if (base) {
    const httpOk = await smokeHttp(base)
    ok = ok && httpOk
  } else {
    console.log("skip HTTP (pass --url http://127.0.0.1:3001 to hit live gateway)")
  }
  process.exit(ok ? 0 : 1)
}

main()
