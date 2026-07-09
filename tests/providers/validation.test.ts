import {
  validateClaudeCodeCompatibleProvider,
  validateProviderApiKey,
} from "../../src/zavorth-control/lib/providers/validation";

jest.mock(
  "@ZavorthGateway/open-sse/config/providerRegistry.ts",
  () => ({
    getRegistryEntry: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "@ZavorthGateway/open-sse/services/claudeCodeCompatible.ts",
  () => ({
    buildClaudeCodeCompatibleHeaders: jest.fn(() => ({})),
    buildClaudeCodeCompatibleValidationPayload: jest.fn(() => ({
      metadata: {
        user_id: JSON.stringify({ session_id: "session-test" }),
      },
    })),
    CLAUDE_CODE_COMPATIBLE_DEFAULT_CHAT_PATH: "/chat",
    CLAUDE_CODE_COMPATIBLE_DEFAULT_MODELS_PATH: "/models",
    joinClaudeCodeCompatibleUrl: jest.fn((baseUrl: string, path: string) => `${baseUrl}${path}`),
    stripClaudeCodeCompatibleEndpointSuffix: jest.fn((baseUrl: string) => baseUrl),
    stripAnthropicMessagesSuffix: jest.fn((baseUrl: string) => baseUrl),
  }),
  { virtual: true }
);

jest.mock(
  "@ZavorthGateway/open-sse/services/qoderCli.ts",
  () => ({
    validateQoderCliPat: jest.fn(async () => ({ valid: true, error: null })),
  }),
  { virtual: true }
);

jest.mock(
  "@/shared/constants/providers",
  () => ({
    isAnthropicCompatibleProvider: jest.fn(() => false),
    isClaudeCodeCompatibleProvider: jest.fn(() => false),
    isOpenAICompatibleProvider: jest.fn(() => false),
  }),
  { virtual: true }
);


describe("zavorth-control provider validation barrel", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
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
    (global.fetch as jest.Mock).mockResolvedValue({
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
