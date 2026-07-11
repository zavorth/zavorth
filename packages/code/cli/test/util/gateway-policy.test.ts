import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import {
  loadGatewayPolicySnapshot,
  mapProductDefaultsToRuleset,
  mergeWithGatewayPolicy,
  resolvePolicyAuthority,
} from "../../src/util/gateway-policy"
import { evaluate } from "../../src/permission/evaluate"

let tmp: string

function bareEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    ZAVORTH_HOME: tmp,
    ...extra,
  } as NodeJS.ProcessEnv
}

describe("gateway-policy", () => {
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-gw-policy-"))
  })
  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  test("standalone uses local authority", () => {
    expect(resolvePolicyAuthority(bareEnv())).toBe("local")
    const snap = loadGatewayPolicySnapshot(bareEnv())
    expect(snap.authority).toBe("local")
    expect(snap.ruleset).toEqual([])
  })

  test("mapProductDefaultsToRuleset maps shell approval to bash ask", () => {
    const rules = mapProductDefaultsToRuleset({
      "filesystem.shell": "approval",
      "network.fetch": "block",
      "filesystem.write": "allow",
    })
    expect(evaluate("bash", "*", rules).action).toBe("ask")
    expect(evaluate("webfetch", "*", rules).action).toBe("deny")
    expect(evaluate("edit", "*", rules).action).toBe("allow")
  })

  test("product-hosted gateway authority loads runtime-permissions.json", () => {
    const root = path.join(tmp, "ws")
    fs.mkdirSync(path.join(root, "config"), { recursive: true })
    fs.writeFileSync(
      path.join(root, "config", "runtime-permissions.json"),
      JSON.stringify({
        profile: "test-profile",
        defaults: {
          "filesystem.shell": "block",
          "network.fetch": "approval",
        },
      }),
      "utf8",
    )
    const env = bareEnv({
      ZAVORTH_RUNTIME_SOURCE: "workspace",
      ZAVORTH_WORKSPACE_ROOT: root,
      ZAVORTH_POLICY_AUTHORITY: "gateway",
      ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
    })
    const snap = loadGatewayPolicySnapshot(env)
    expect(snap.authority).toBe("gateway")
    expect(snap.source).toBe("product-config")
    expect(snap.profile).toBe("test-profile")
    expect(evaluate("bash", "*", snap.ruleset).action).toBe("deny")
    expect(evaluate("webfetch", "*", snap.ruleset).action).toBe("ask")
  })

  test("mergeWithGatewayPolicy product deny wins over local allow (findLast)", () => {
    const root = path.join(tmp, "ws2")
    fs.mkdirSync(path.join(root, "config"), { recursive: true })
    fs.writeFileSync(
      path.join(root, "config", "runtime-permissions.json"),
      JSON.stringify({
        defaults: { "filesystem.shell": "block" },
      }),
      "utf8",
    )
    const env = bareEnv({
      ZAVORTH_RUNTIME_SOURCE: "workspace",
      ZAVORTH_WORKSPACE_ROOT: root,
      ZAVORTH_POLICY_AUTHORITY: "gateway",
    })
    // Temporarily set process.env for merge helper used by Permission.ask
    const prev = { ...process.env }
    Object.assign(process.env, env)
    try {
      const merged = mergeWithGatewayPolicy(
        [{ permission: "bash", pattern: "*", action: "allow" }],
        env,
      )
      expect(evaluate("bash", "*", merged).action).toBe("deny")
    } finally {
      for (const k of Object.keys(process.env)) {
        if (!(k in prev)) delete process.env[k]
      }
      Object.assign(process.env, prev)
    }
  })

  test("fail-closed when policy file missing and FALLBACK=fail", () => {
    const env = bareEnv({
      ZAVORTH_RUNTIME_SOURCE: "workspace",
      ZAVORTH_WORKSPACE_ROOT: path.join(tmp, "empty-ws"),
      ZAVORTH_POLICY_AUTHORITY: "gateway",
      ZAVORTH_POLICY_FALLBACK: "fail",
    })
    fs.mkdirSync(path.join(tmp, "empty-ws"), { recursive: true })
    const snap = loadGatewayPolicySnapshot(env)
    expect(snap.source).toBe("fail-closed")
    expect(evaluate("bash", "*", snap.ruleset).action).toBe("deny")
  })
})
