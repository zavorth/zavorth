type OpenCodeConfigInput = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

const OPENCODE_DEFAULT_MODELS = [
  "claude-3-opus-20240229-thinking",
  "claude-3-5-sonnet-latest-thinking",
  "gemini-2.5-pro",
  "gemini-3-flash",
] as const;

const normalizeValue = (value: unknown) =>
  String(value || "")
    .trim()
    .replace(/^\/+/, "");

export const buildOpenCodeProviderConfig = ({
  baseUrl,
  apiKey,
  model,
}: OpenCodeConfigInput): Record<string, unknown> => {
  const normalizedBaseUrl = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const normalizedModel = normalizeValue(model);

  const uniqueModels = [...new Set([normalizedModel, ...OPENCODE_DEFAULT_MODELS].filter(Boolean))];

  const modelsRecord: Record<string, { name: string }> = {};
  for (const m of uniqueModels) {
    if (m) {
      modelsRecord[m] = { name: m };
    }
  }

  return {
    npm: "@ai-sdk/openai-compatible",
    name: "ZavorthGateway",
    options: {
      baseURL: normalizedBaseUrl,
      apiKey: apiKey || "sk_ZavorthGateway",
    },
    models: modelsRecord,
  };
};

export const mergeOpenCodeConfig = (
  existingConfig: Record<string, unknown> | null | undefined,
  input: OpenCodeConfigInput
) => {
  const safeConfig =
    existingConfig && typeof existingConfig === "object" && !Array.isArray(existingConfig)
      ? existingConfig
      : {};

  return {
    ...safeConfig,
    provider: {
      ...((safeConfig as unknown as Record<string, unknown>).provider || {}),
      ZavorthGateway: buildOpenCodeProviderConfig(input),
    },
  };
};
