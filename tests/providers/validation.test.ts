import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock(
  "@ZavorthGateway/open-sse/config/providerRegistry.ts",
  () => ({
    getRegistryEntry: vi.fn(),
  }),
  { virtual: true }
);

vi.mock(
  "@ZavorthGateway/open-sse/services/claudeCodeCompatible.ts",
  () => ({
    buildClaudeCodeCompatibleHeaders: vi.fn(() => ({})),
    buildClaudeCodeCompatibleValidationPayload: vi.fn(() => ({
      metadata: {
        user_id: JSON.stringify({ session_id: "session-test" }),
      },
    })),
    CLAUDE_CODE_COMPATIBLE_DEFAULT_CHAT_PATH: "/chat",
    CLAUDE_CODE_COMPATIBLE_DEFAULT_MODELS_PATH: "/models",
    joinClaudeCodeCompatibleUrl: vi.fn((baseUrl: string, path: string) => `${baseUrl}${path}`),
    stripClaudeCodeCompatibleEndpointSuffix: vi.fn((baseUrl: string) => baseUrl),
    stripAnthropicMessagesSuffix: vi.fn((baseUrl: string) => baseUrl),
  }),
  { virtual: true }
);

vi.mock(
  "@ZavorthGateway/open-sse/services/qoderCli.ts",
  () => ({
    validateQoderCliPat: vi.fn(async () => ({ valid: true, error: null })),
  }),
  { virtual: true }
);

vi.mock(
  "@/shared/constants/providers",
  () => ({
    isAnthropicCompatibleProvider: vi.fn(() => false),
    isClaudeCodeCompatibleProvider: vi.fn(() => false),
    isOpenAICompatibleProvider: vi.fn(() => false),
  }),
  { virtual: true }
);

import {
  validateClaudeCodeCompatibleProvider,
  validateProviderApiKey,
} from "../../src/zavorth-control/lib/providers/validation";

describe("zavorth-control provider validation barrel", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("re-exports the public validation API from the split modules", async () => {
    expect(validateProviderApiKey).toEqual(expect.any(Function));
    expect(validateClaudeCodeCompatibleProvider).toEqual(expect.any(Function));

    const result = await validateProviderApiKey({
      provider: "",
      apiKey: "test-key",
    });

    expect(result).toEqual({
      valid: false,
      error: "Provider and API key required",
      unsupported: false,
    });
  });

  it("validates Claude Code compatible providers through the extracted helper", async () => {
    (global.fetch as vi.mock).mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await validateClaudeCodeCompatibleProvider({
      apiKey: "test-key",
      providerSpecificData: {
        baseUrl: "https://example.com",
      },
    });

    expect(result).toEqual({
      valid: true,
      error: null,
      method: "models_endpoint",
    });
  });
});
