export interface QoderCliValidationResult {
  valid: boolean;
  error: string | null;
}

export interface StaticQoderModel {
  id: string;
  name: string;
}

const QODER_MODELS: StaticQoderModel[] = [
  { id: "qwen3-coder-plus", name: "Qwen3 Coder Plus" },
  { id: "kimi-k2", name: "Kimi K2" },
  { id: "kimi-k2-thinking", name: "Kimi K2 Thinking" },
  { id: "deepseek-r1", name: "DeepSeek R1" },
  { id: "deepseek-v3.2", name: "DeepSeek V3.2" },
  { id: "deepseek-v3.2-chat", name: "DeepSeek V3.2 Chat" },
  { id: "deepseek-v3.2-reasoner", name: "DeepSeek V3.2 Reasoner" },
  { id: "minimax-m2", name: "MiniMax M2" },
  { id: "glm-4.6", name: "GLM 4.6" },
  { id: "glm-4.7", name: "GLM 4.7" },
];

export function getStaticQoderModels(): StaticQoderModel[] {
  return QODER_MODELS.map((model) => ({ ...model }));
}

export interface QoderCliPatInput {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}

export function normalizeQoderPatProviderData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export async function validateQoderCliPat({
  apiKey,
  providerSpecificData = {},
}: QoderCliPatInput): Promise<QoderCliValidationResult> {
  if (!apiKey) {
    return { valid: false, error: "Missing Qoder PAT" };
  }

  try {
    const baseUrl =
      (typeof providerSpecificData.baseUrl === "string" && providerSpecificData.baseUrl) ||
      "https://api.qoder.ai/v1";
    const normalized = baseUrl.replace(/\/+$/, "");
    const res = await fetch(`${normalized}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Qoder PAT" };
    }
    return { valid: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Qoder PAT validation failed";
    return { valid: false, error: message };
  }
}
