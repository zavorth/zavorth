import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import {
  DEFAULT_GATEWAY_BASE_URL,
  getProductGatewayBaseUrl,
  isAnthropicProductRouteEnabled,
  isProductHosted,
  isProductRoutableProvider,
  productOpenAiCompatibleBaseUrl,
  resolveAnthropicCompatibleBaseUrl,
  resolveOpenAiCompatibleBaseUrl,
  withProductProviderBaseUrl,
} from "../../src/util/host-runtime"

/** Isolated home so real ~/.local/state/zavorth runtime-bridge.json cannot leak. */
let isolatedHome: string

function bareEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    // Force state dir away from the developer host bridge file.
    ZAVORTH_HOME: isolatedHome,
    ...extra,
  } as NodeJS.ProcessEnv
}

describe("host-runtime helpers", () => {
  beforeEach(() => {
    isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-host-rt-"))
  })

  afterEach(() => {
    try {
      fs.rmSync(isolatedHome, { recursive: true, force: true })
    } catch {
      // best-effort
    }
  })

  test("isProductHosted is false for standalone env", () => {
    expect(isProductHosted(bareEnv())).toBe(false)
  })

  test("isProductHosted detects ZAVORTH_RUNTIME_SOURCE=workspace", () => {
    expect(isProductHosted(bareEnv({ ZAVORTH_RUNTIME_SOURCE: "workspace" }))).toBe(true)
  })

  test("isProductHosted still accepts legacy source monorepo", () => {
    expect(isProductHosted(bareEnv({ ZAVORTH_RUNTIME_SOURCE: "monorepo" }))).toBe(true)
  })

  test("isProductHosted detects ZAVORTH_CODE_FROM_WORKSPACE=1", () => {
    expect(isProductHosted(bareEnv({ ZAVORTH_CODE_FROM_WORKSPACE: "1" }))).toBe(true)
  })

  test("getProductGatewayBaseUrl defaults to localhost:20128", () => {
    expect(getProductGatewayBaseUrl(bareEnv())).toBe(DEFAULT_GATEWAY_BASE_URL)
  })

  test("getProductGatewayBaseUrl prefers ZAVORTH_GATEWAY_BASE_URL", () => {
    expect(
      getProductGatewayBaseUrl(
        bareEnv({
          ZAVORTH_GATEWAY_BASE_URL: "http://gw.example:9/",
          BASE_URL: "http://ignored",
        }),
      ),
    ).toBe("http://gw.example:9")
  })

  test("productOpenAiCompatibleBaseUrl appends /v1", () => {
    expect(
      productOpenAiCompatibleBaseUrl(
        bareEnv({ ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128" }),
      ),
    ).toBe("http://localhost:20128/v1")
  })

  test("productOpenAiCompatibleBaseUrl does not double /v1", () => {
    expect(
      productOpenAiCompatibleBaseUrl(
        bareEnv({ ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128/v1/" }),
      ),
    ).toBe("http://localhost:20128/v1")
  })

  describe("resolveOpenAiCompatibleBaseUrl", () => {
    test("standalone without existing base returns undefined", () => {
      expect(resolveOpenAiCompatibleBaseUrl({ env: bareEnv() })).toBeUndefined()
    })

    test("existing base wins even when not monorepo-hosted", () => {
      expect(
        resolveOpenAiCompatibleBaseUrl({
          existingBaseUrl: "https://corp.proxy/v1/",
          env: bareEnv(),
        }),
      ).toBe("https://corp.proxy/v1")
    })

    test("existing base wins when monorepo-hosted", () => {
      expect(
        resolveOpenAiCompatibleBaseUrl({
          existingBaseUrl: "https://user-set.example/v1",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "monorepo",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
          }),
        }),
      ).toBe("https://user-set.example/v1")
    })

    test("monorepo-hosted without existing base uses gateway /v1", () => {
      expect(
        resolveOpenAiCompatibleBaseUrl({
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "monorepo",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
          }),
        }),
      ).toBe("http://localhost:20128/v1")
    })

    test("openai routes automatically when product-hosted", () => {
      expect(
        resolveOpenAiCompatibleBaseUrl({
          providerID: "openai",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "workspace",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
          }),
        }),
      ).toBe("http://localhost:20128/v1")
    })

    test("openai can be opted out when product-hosted", () => {
      expect(
        resolveOpenAiCompatibleBaseUrl({
          providerID: "openai",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "workspace",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
            ZAVORTH_ROUTE_PROVIDERS: "0",
          }),
        }),
      ).toBeUndefined()
      expect(
        resolveOpenAiCompatibleBaseUrl({
          providerID: "openai",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "workspace",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
            ZAVORTH_PROVIDERS_DIRECT: "1",
          }),
        }),
      ).toBeUndefined()
    })

    test("openai routes with explicit ROUTE_PROVIDERS=1 on standalone", () => {
      expect(
        resolveOpenAiCompatibleBaseUrl({
          providerID: "openai",
          env: bareEnv({
            ZAVORTH_ROUTE_PROVIDERS: "1",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
            // not product-hosted — resolveOpenAi still requires isProductHosted
          }),
        }),
      ).toBeUndefined()
      expect(
        isProductRoutableProvider(
          "openai",
          bareEnv({ ZAVORTH_ROUTE_PROVIDERS: "1" }),
        ),
      ).toBe(true)
    })

    test("isProductRoutableProvider: zavorth + hosted openai auto", () => {
      const env = bareEnv({ ZAVORTH_RUNTIME_SOURCE: "workspace" })
      expect(isProductRoutableProvider("zavorth", env)).toBe(true)
      expect(isProductRoutableProvider("openai", env)).toBe(true)
      expect(
        isProductRoutableProvider(
          "openai",
          bareEnv({ ZAVORTH_ROUTE_PROVIDERS: "0", ZAVORTH_RUNTIME_SOURCE: "workspace" }),
        ),
      ).toBe(false)
    })

    test("anthropic routes automatically when product-hosted (gateway /v1/messages)", () => {
      const hosted = bareEnv({
        ZAVORTH_RUNTIME_SOURCE: "workspace",
        ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
      })
      expect(isAnthropicProductRouteEnabled(hosted)).toBe(true)
      expect(isProductRoutableProvider("anthropic", hosted)).toBe(true)
      expect(
        resolveAnthropicCompatibleBaseUrl({
          providerID: "anthropic",
          env: hosted,
        }),
      ).toBe("http://localhost:20128/v1")
    })

    test("anthropic is NOT routed on standalone even with ROUTE_PROVIDERS=1", () => {
      const env = bareEnv({
        ZAVORTH_ROUTE_PROVIDERS: "1",
        ZAVORTH_ROUTE_PROVIDER_IDS: "openai,anthropic,openrouter",
      })
      expect(isProductHosted(env)).toBe(false)
      expect(isAnthropicProductRouteEnabled(env)).toBe(false)
      expect(isProductRoutableProvider("anthropic", env)).toBe(false)
      expect(isProductRoutableProvider("openai", env)).toBe(true)
      expect(
        resolveAnthropicCompatibleBaseUrl({
          providerID: "anthropic",
          env,
        }),
      ).toBeUndefined()
    })

    test("anthropic can be opted out when product-hosted", () => {
      const off = bareEnv({
        ZAVORTH_RUNTIME_SOURCE: "workspace",
        ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
        ZAVORTH_ROUTE_ANTHROPIC: "0",
      })
      expect(isAnthropicProductRouteEnabled(off)).toBe(false)
      expect(
        resolveAnthropicCompatibleBaseUrl({
          providerID: "anthropic",
          env: off,
        }),
      ).toBeUndefined()

      const direct = bareEnv({
        ZAVORTH_RUNTIME_SOURCE: "workspace",
        ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
        ZAVORTH_ANTHROPIC_DIRECT: "1",
      })
      expect(isAnthropicProductRouteEnabled(direct)).toBe(false)
      expect(
        resolveAnthropicCompatibleBaseUrl({
          providerID: "anthropic",
          env: direct,
        }),
      ).toBeUndefined()
    })

    test("anthropic explicit ROUTE_ANTHROPIC=1 still works (redundant when hosted)", () => {
      expect(
        resolveAnthropicCompatibleBaseUrl({
          providerID: "anthropic",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "workspace",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
            ZAVORTH_ROUTE_ANTHROPIC: "1",
          }),
        }),
      ).toBe("http://localhost:20128/v1")
      expect(
        isProductRoutableProvider(
          "anthropic",
          bareEnv({ ZAVORTH_ROUTE_ANTHROPIC: "1" }),
        ),
      ).toBe(true)
    })

    test("ZAVORTH_ANTHROPIC_BASE_URL overrides gateway when routing enabled", () => {
      expect(
        resolveAnthropicCompatibleBaseUrl({
          providerID: "anthropic",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "workspace",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
            ZAVORTH_ANTHROPIC_BASE_URL: "http://custom-anthropic.example/v1",
          }),
        }),
      ).toBe("http://custom-anthropic.example/v1")
      expect(
        resolveAnthropicCompatibleBaseUrl({
          providerID: "anthropic",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "workspace",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
            ZAVORTH_ROUTE_ANTHROPIC: "0",
            ZAVORTH_ANTHROPIC_BASE_URL: "http://custom-anthropic.example/v1",
          }),
        }),
      ).toBeUndefined()
    })

    test("anthropic existing baseURL always wins (even with auto-route)", () => {
      expect(
        resolveAnthropicCompatibleBaseUrl({
          existingBaseUrl: "https://user-set.anthropic.proxy/",
          providerID: "anthropic",
          env: bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "workspace",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
          }),
        }),
      ).toBe("https://user-set.anthropic.proxy")
    })

    test("empty existing base is ignored", () => {
      expect(
        resolveOpenAiCompatibleBaseUrl({
          existingBaseUrl: "   ",
          env: bareEnv({
            ZAVORTH_CODE_FROM_WORKSPACE: "1",
            ZAVORTH_GATEWAY_BASE_URL: "http://gw:20128",
          }),
        }),
      ).toBe("http://gw:20128/v1")
    })
  })

  describe("withProductProviderBaseUrl", () => {
    test("standalone leaves options without baseURL", () => {
      expect(withProductProviderBaseUrl({ apiKey: "k" }, bareEnv())).toEqual({ apiKey: "k" })
    })

    test("does not overwrite explicit baseURL when monorepo-hosted", () => {
      expect(
        withProductProviderBaseUrl(
          { baseURL: "https://explicit/v1", apiKey: "k" },
          bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "monorepo",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
          }),
        ),
      ).toEqual({ baseURL: "https://explicit/v1", apiKey: "k" })
    })

    test("injects baseURL when monorepo-hosted and missing", () => {
      expect(
        withProductProviderBaseUrl(
          { apiKey: "k" },
          bareEnv({
            ZAVORTH_RUNTIME_SOURCE: "monorepo",
            ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
          }),
        ),
      ).toEqual({ apiKey: "k", baseURL: "http://localhost:20128/v1" })
    })

    test("does not mutate input object", () => {
      const input = { apiKey: "k" }
      const out = withProductProviderBaseUrl(
        input,
        bareEnv({
          ZAVORTH_RUNTIME_SOURCE: "monorepo",
          ZAVORTH_GATEWAY_BASE_URL: "http://localhost:20128",
        }),
      )
      expect(out).not.toBe(input)
      expect(input).toEqual({ apiKey: "k" })
      expect(out.baseURL).toBe("http://localhost:20128/v1")
    })
  })

  test("isProductHosted reads runtime-bridge.json when env unset", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "zavorth-mr-"))
    try {
      const state = path.join(home, "state")
      fs.mkdirSync(state, { recursive: true })
      fs.writeFileSync(
        path.join(state, "runtime-bridge.json"),
        JSON.stringify({
          version: 1,
          updatedAt: 1,
          source: "monorepo",
          entry: "code-tui",
          product: "zavorth-terminal",
          monorepoRoot: home,
          gatewayBaseUrl: "http://from-file:20128",
          policyAuthority: "gateway",
        }),
      )
      const env = bareEnv({ ZAVORTH_HOME: home })
      expect(isProductHosted(env)).toBe(true)
      expect(getProductGatewayBaseUrl(env)).toBe("http://from-file:20128")
      expect(resolveOpenAiCompatibleBaseUrl({ env })).toBe("http://from-file:20128/v1")
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })
})
