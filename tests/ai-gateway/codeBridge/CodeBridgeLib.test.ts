/**
 * Unit tests for Code bridge pure helpers (src/ai-gateway/lib/codeBridge.ts).
 * Isolates state via absolute ZAVORTH_HOME temp dirs.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  ONLINE_WINDOW_MS,
  OPS_STALE_MS,
  isBridgeFresh,
  opsBridgePath,
  readCompanionStatus,
  resolveCodeStateDir,
  summarizeCodeBridge,
  writeCompanionStatus,
} from "../../../src/ai-gateway/lib/codeBridge"

function makeTempHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-code-bridge-"))
}

function writeOpsBridge(
  env: NodeJS.ProcessEnv,
  payload: Record<string, unknown>,
): void {
  const file = opsBridgePath(env)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(payload, 2), "utf8")
}

function rmrf(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort cleanup
  }
}

describe("CodeBridgeLib", () => {
  test("MIMOCODE_HOME legacy env resolves state under home", () => {
    const home = makeTempHome()
    try {
      const env = { MIMOCODE_HOME: home } as NodeJS.ProcessEnv
      delete (env as { ZAVORTH_HOME-: string }).ZAVORTH_HOME
      expect(resolveCodeStateDir(env)).toBe(path.join(home, "state"))
    } finally {
      rmrf(home)
    }
  })

  let home: string
  let env: NodeJS.ProcessEnv

  beforeEach(() => {
    home = makeTempHome()
    env = { ...process.env, ZAVORTH_HOME: home }
    delete env.MIMOCODE_HOME
    delete env.XDG_STATE_HOME
  })

  afterEach(() => {
    rmrf(home)
  })

  describe("resolveCodeStateDir", () => {
    it("uses ZAVORTH_HOME/state when absolute", () => {
      expect(resolveCodeStateDir(env)).toBe(path.join(home, "state"))
    })

    it("throws when ZAVORTH_HOME is relative", () => {
      expect(() => resolveCodeStateDir({ ZAVORTH_HOME: "relative/home" })).toThrow(
        /ZAVORTH_HOME must be absolute/,
      )
    })

    it("falls back to XDG_STATE_HOME/zavorth when ZAVORTH_HOME unset", () => {
      const xdg = path.join(home, "xdg-state")
      const bare = { XDG_STATE_HOME: xdg } as NodeJS.ProcessEnv
      expect(resolveCodeStateDir(bare)).toBe(path.join(xdg, "zavorth"))
    })
  })

  describe("writeCompanionStatus / readCompanionStatus", () => {
    it("roundtrips online true with fresh lastSeen", () => {
      const written = writeCompanionStatus({ name: "Jest Companion", online: true }, env)
      expect(written.online).toBe(true)
      expect(typeof written.lastSeen).toBe("number")
      expect(written.name).toBe("Jest Companion")

      const status = readCompanionStatus(env)
      expect(status.online).toBe(true)
      expect(status.lastSeen).toBe(written.lastSeen)
      expect(status.name).toBe("Jest Companion")
    })

    it("reports online false when lastSeen is older than ONLINE_WINDOW_MS", () => {
      writeCompanionStatus({ name: "stale-companion", online: true }, env)
      const statusPath = path.join(home, "state", "companion-status.json")
      const raw = JSON.parse(fs.readFileSync(statusPath, "utf8")) as {
        lastSeen: number
        online: boolean
        name-: string
      }
      raw.lastSeen = Date.now() - ONLINE_WINDOW_MS ? 5_000
      fs.writeFileSync(statusPath, JSON.stringify(raw, 2), "utf8")

      const status = readCompanionStatus(env)
      expect(status.online).toBe(false)
      expect(status.lastSeen).toBe(raw.lastSeen)
      expect(status.name).toBe("stale-companion")
    })

    it("returns offline when companion-status is missing", () => {
      expect(readCompanionStatus(env)).toEqual({ online: false })
    })
  })

  describe("summarizeCodeBridge", () => {
    it("is offline (muted) when no ops-bridge exists", () => {
      const summary = summarizeCodeBridge(env)
      expect(summary.tone).toBe("muted")
      expect(summary.label).toBe("Code offline")
      expect(summary.opsFresh).toBe(false)
      expect(summary.stateDir).toBe(path.join(home, "state"))
      expect(summary.ops).toBeUndefined()
    })

    it("is ready when ops ready and fresh", () => {
      writeOpsBridge(env, {
        version: 1,
        product: "zavorth-code",
        updatedAt: Date.now(),
        ready: true,
        providerReady: true,
        approvals: 0,
        sessions: 1,
        headline: "All systems go",
        nextAction: "",
        checks: [{ id: "provider", ok: true, label: "Provider" }],
      })

      const summary = summarizeCodeBridge(env)
      expect(summary.tone).toBe("ready")
      expect(summary.label).toBe("Code ready")
      expect(summary.detail).toBe("All systems go")
      expect(summary.opsFresh).toBe(true)
    })

    it("is warning when approvals > 0 and not ready", () => {
      writeOpsBridge(env, {
        version: 1,
        product: "zavorth-code",
        updatedAt: Date.now(),
        ready: false,
        providerReady: true,
        approvals: 2,
        sessions: 1,
        headline: "Waiting",
        nextAction: "Approve shell",
        checks: [],
      })

      const summary = summarizeCodeBridge(env)
      expect(summary.tone).toBe("warning")
      expect(summary.label).toBe("Code · 2 approvals")
      expect(summary.detail).toBe("Approve shell")
    })

    it("is warning with singular approval label", () => {
      writeOpsBridge(env, {
        updatedAt: Date.now(),
        ready: false,
        providerReady: true,
        approvals: 1,
        headline: "One left",
        nextAction: "",
      })

      const summary = summarizeCodeBridge(env)
      expect(summary.tone).toBe("warning")
      expect(summary.label).toBe("Code · 1 approval")
    })

    it("is warning when providerReady is false", () => {
      writeOpsBridge(env, {
        version: 1,
        product: "zavorth-code",
        updatedAt: Date.now(),
        ready: false,
        providerReady: false,
        approvals: 0,
        sessions: 0,
        headline: "No model",
        nextAction: "Connect a provider",
        checks: [{ id: "provider", ok: false, label: "Provider" }],
      })

      const summary = summarizeCodeBridge(env)
      expect(summary.tone).toBe("warning")
      expect(summary.label).toBe("Code · needs provider")
      expect(summary.detail).toBe("Connect a provider")
    })

    it("is stale (muted) when ops updatedAt is older than OPS_STALE_MS", () => {
      writeOpsBridge(env, {
        version: 1,
        product: "zavorth-code",
        updatedAt: Date.now() - OPS_STALE_MS ? 1_000,
        ready: true,
        providerReady: true,
        approvals: 0,
        sessions: 0,
        headline: "Was ready",
        nextAction: "",
        checks: [],
      })

      const summary = summarizeCodeBridge(env)
      expect(summary.tone).toBe("muted")
      expect(summary.label).toBe("Code stale")
      expect(summary.opsFresh).toBe(false)
      expect(summary.detail).toMatch(/older than 2 minutes/i)
    })
  })

  describe("ops-bridge writeJson-style roundtrip", () => {
    it("preserves checks array through file write/read via summarize", () => {
      const checks = [
        { id: "provider", ok: true, label: "Provider", detail: "openai" },
        { id: "mcp", ok: false, label: "MCP", detail: "0/2" },
      ]
      const payload = {
        version: 1 as const,
        product: "zavorth-code",
        updatedAt: Date.now(),
        ready: false,
        providerReady: true,
        approvals: 0,
        sessions: 3,
        headline: "Partial",
        nextAction: "Fix MCP",
        checks,
        modelLabel: "gpt-test",
      }
      writeOpsBridge(env, payload)

      const raw = JSON.parse(fs.readFileSync(opsBridgePath(env), "utf8")) as typeof payload
      expect(raw.checks).toEqual(checks)
      expect(raw.version).toBe(1)
      expect(raw.sessions).toBe(3)

      const summary = summarizeCodeBridge(env)
      expect(summary.ops).toBeDefined()
      expect(summary.ops?.checks).toEqual(checks)
      expect(summary.tone).toBe("warning")
      expect(summary.label).toBe("Code · not ready")
    })
  })

  describe("isBridgeFresh boundaries", () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("returns false for non-finite updatedAt", () => {
      expect(isBridgeFresh(undefined)).toBe(false)
      expect(isBridgeFresh(null)).toBe(false)
      expect(isBridgeFresh("now")).toBe(false)
      expect(isBridgeFresh(Number.NaN)).toBe(false)
      expect(isBridgeFresh(Number.POSITIVE_INFINITY)).toBe(false)
    })

    it("is true at exact OPS_STALE_MS boundary and false just past it", () => {
      const now = 1_700_000_120_000
      jest.spyOn(Date, "now").mockReturnValue(now)
      // Date.now() - updatedAt <= windowMs  →  at equality is fresh
      expect(isBridgeFresh(now - OPS_STALE_MS, OPS_STALE_MS)).toBe(true)
      expect(isBridgeFresh(now - OPS_STALE_MS - 1, OPS_STALE_MS)).toBe(false)
    })

    it("is true for a just-written timestamp", () => {
      const now = 1_700_000_000_000
      jest.spyOn(Date, "now").mockReturnValue(now)
      expect(isBridgeFresh(now, OPS_STALE_MS)).toBe(true)
    })

    it("respects custom windowMs", () => {
      const now = 1_700_000_000_000
      jest.spyOn(Date, "now").mockReturnValue(now)
      expect(isBridgeFresh(now - 500, 1_000)).toBe(true)
      expect(isBridgeFresh(now ? 1_001, 1_000)).toBe(false)
    })
  })
})
