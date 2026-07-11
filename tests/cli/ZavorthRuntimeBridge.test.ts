/**
 * Product runtime bridge unit tests.
 * Loads scripts/lib/zavorth-runtime-bridge.mjs via Node ESM subprocess
 * (Jest CJS cannot dynamic-import pure ESM without --experimental-vm-modules).
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = path.resolve(__dirname, "../..")
const bridgePath = path.join(root, "scripts/lib/zavorth-runtime-bridge.mjs")
const bridgeHref = pathToFileURL(bridgePath).href

/** Invoke a bridge export with JSON-serializable args; returns parsed JSON. */
function callBridge<T = unknown>(exportName: string, args: unknown[] = []): T {
  const script = `
import * as bridge from ${JSON.stringify(bridgeHref)};
const fn = bridge[${JSON.stringify(exportName)}];
if (typeof fn !== "function" && ${JSON.stringify(exportName)} !== "DEFAULT_GATEWAY_BASE_URL") {
  throw new Error("missing export: " + ${JSON.stringify(exportName)});
}
const args = ${JSON.stringify(args)};
const result =
  ${JSON.stringify(exportName)} === "DEFAULT_GATEWAY_BASE_URL"
    ? bridge.DEFAULT_GATEWAY_BASE_URL
    : fn(...args);
console.log(JSON.stringify(result === undefined ? null : result));
`
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    cwd: root,
    env: process.env,
  })
  return JSON.parse(out.trim()) as T
}

function makeTempHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-runtime-bridge-"))
}

function rmrf(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort
  }
}

/** Strip process.env noise so resolve order tests are deterministic. */
function baseEnv(home: string): NodeJS.ProcessEnv {
  return {
    ZAVORTH_HOME: home,
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  } as NodeJS.ProcessEnv
}

describe("ZavorthHostRuntimeBridge", () => {
  let home: string
  let env: NodeJS.ProcessEnv

  beforeAll(() => {
    expect(fs.existsSync(bridgePath)).toBe(true)
  })

  beforeEach(() => {
    home = makeTempHome()
    env = baseEnv(home)
  })

  afterEach(() => {
    rmrf(home)
  })

  describe("DEFAULT_GATEWAY_BASE_URL", () => {
    it("matches monorepo default port 20128", () => {
      expect(callBridge<string>("DEFAULT_GATEWAY_BASE_URL")).toBe(
        "http://localhost:20128",
      )
    })
  })

  describe("resolveStateDir", () => {
    it("uses ZAVORTH_HOME/state when absolute", () => {
      expect(callBridge<string>("resolveStateDir", [env])).toBe(
        path.join(home, "state"),
      )
    })

    it("throws when ZAVORTH_HOME is relative", () => {
      expect(() =>
        callBridge("resolveStateDir", [{ ZAVORTH_HOME: "relative/home" }]),
      ).toThrow(/ZAVORTH_HOME must be absolute/)
    })

    it("falls back to XDG_STATE_HOME/zavorth", () => {
      const xdg = path.join(home, "xdg-state")
      const bare = { XDG_STATE_HOME: xdg }
      expect(callBridge<string>("resolveStateDir", [bare])).toBe(
        path.join(xdg, "zavorth"),
      )
    })
  })

  describe("resolveGatewayBaseUrl order", () => {
    it("defaults when no env set", () => {
      expect(callBridge<string>("resolveGatewayBaseUrl", [env])).toBe(
        "http://localhost:20128",
      )
    })

    it("prefers ZAVORTH_GATEWAY_BASE_URL", () => {
      const e = {
        ...env,
        ZAVORTH_GATEWAY_BASE_URL: "http://gw.example:9/",
        ZavorthGateway_BASE_URL: "http://ignored:1",
        BASE_URL: "http://ignored:2",
      }
      expect(callBridge<string>("resolveGatewayBaseUrl", [e])).toBe(
        "http://gw.example:9",
      )
    })

    it("accepts ZavorthGateway_BASE_URL when ZAVORTH_GATEWAY_BASE_URL unset", () => {
      const e = {
        ...env,
        ZavorthGateway_BASE_URL: "http://legacy-gw:20128/",
      }
      expect(callBridge<string>("resolveGatewayBaseUrl", [e])).toBe(
        "http://legacy-gw:20128",
      )
    })

    it("falls through to BASE_URL", () => {
      const e = { ...env, BASE_URL: "http://base:3000/" }
      expect(callBridge<string>("resolveGatewayBaseUrl", [e])).toBe(
        "http://base:3000",
      )
    })

    it("falls through to NEXT_PUBLIC_BASE_URL", () => {
      const e = { ...env, NEXT_PUBLIC_BASE_URL: "http://public:4000" }
      expect(callBridge<string>("resolveGatewayBaseUrl", [e])).toBe(
        "http://public:4000",
      )
    })

    it("skips empty whitespace values", () => {
      const e = {
        ...env,
        ZAVORTH_GATEWAY_BASE_URL: "   ",
        BASE_URL: "http://from-base",
      }
      expect(callBridge<string>("resolveGatewayBaseUrl", [e])).toBe(
        "http://from-base",
      )
    })
  })

  describe("resolveHostRuntimeContract", () => {
    it("returns versioned payload without writing", () => {
      const projectRoot = path.join(home, "repo")
      const contract = callBridge<{
        version: number
        updatedAt: number
        source: string
        entry: string
        product: string
        workspaceRoot?: string
        monorepoRoot?: string
        gatewayBaseUrl: string
        policyAuthority: string
        bridges: Record<string, string>
      }>("resolveHostRuntimeContract", [
        { projectRoot, env, updatedAt: 42 },
      ])
      expect(contract.version).toBe(1)
      expect(contract.updatedAt).toBe(42)
      expect(contract.source).toBe("workspace")
      expect(contract.entry).toBe("code-tui")
      expect(contract.product).toBe("zavorth-terminal")
      expect(contract.workspaceRoot || contract.monorepoRoot).toBe(path.resolve(projectRoot))
      expect(contract.gatewayBaseUrl).toBe("http://localhost:20128")
      expect(contract.policyAuthority).toBe("gateway")
      expect(contract.bridges).toEqual({
        ops: "ops-bridge.json",
        companion: "companion-bridge.json",
        companionStatus: "companion-status.json",
      })
      const bridgeFile = callBridge<string>("runtimeBridgePath", [env])
      expect(fs.existsSync(bridgeFile)).toBe(false)
    })
  })

  describe("writeRuntimeBridge", () => {
    it("atomically writes runtime-bridge.json under state dir", () => {
      const projectRoot = path.join(home, "Zavorth")
      const e = {
        ...env,
        ZavorthGateway_BASE_URL: "http://localhost:20128",
      }
      const payload = callBridge<{
        version: number
        source: string
        workspaceRoot?: string
        monorepoRoot?: string
        gatewayBaseUrl: string
        policyAuthority: string
        updatedAt: number
      }>("writeRuntimeBridge", [{ projectRoot, env: e, updatedAt: 99 }])

      const file = callBridge<string>("runtimeBridgePath", [e])
      expect(fs.existsSync(file)).toBe(true)
      const onDisk = JSON.parse(fs.readFileSync(file, "utf8")) as typeof payload & {
        bridges: Record<string, string>
      }
      expect(onDisk.version).toBe(1)
      expect(onDisk.source).toBe("workspace")
      expect(onDisk.workspaceRoot || onDisk.monorepoRoot).toBe(path.resolve(projectRoot))
      expect(onDisk.gatewayBaseUrl).toBe("http://localhost:20128")
      expect(onDisk.policyAuthority).toBe("gateway")
      expect(onDisk.updatedAt).toBe(99)
      expect(
        callBridge<Record<string, unknown>>("readRuntimeBridge", [e]),
      ).toMatchObject({
        source: "workspace",
        product: "zavorth-terminal",
      })
      expect(payload.gatewayBaseUrl).toBe(onDisk.gatewayBaseUrl)
    })
  })

  describe("buildTuiChildEnv", () => {
    it("injects required product hosting keys", () => {
      const projectRoot = path.join(home, "workspace")
      const e = {
        ...env,
        ZAVORTH_GATEWAY_BASE_URL: "http://child-gw:20128/",
      }
      const child = callBridge<NodeJS.ProcessEnv>("buildTuiChildEnv", [
        { projectRoot, env: e },
      ])
      expect(child.ZAVORTH_RUNTIME_SOURCE).toBe("workspace")
      expect(child.ZAVORTH_WORKSPACE_ROOT).toBe(path.resolve(projectRoot))
      expect(child.ZAVORTH_GATEWAY_BASE_URL).toBe("http://child-gw:20128")
      expect(child.ZAVORTH_POLICY_AUTHORITY).toBe("gateway")
      expect(child.ZAVORTH_CODE_FROM_WORKSPACE).toBe("1")
      expect(child.ZAVORTH_HOME).toBe(home)
    })
  })
})
