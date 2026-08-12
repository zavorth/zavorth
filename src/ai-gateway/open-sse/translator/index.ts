import { FORMATS } from "./formats";

type JsonRecord = Record<string, unknown>;

const OPENAI_ROLE_MAP: Record<string, string> = {
  system: "system",
  user: "user",
  assistant: "assistant",
  tool: "tool",
  function: "function",
};

const ANTHROPIC_ROLE_MAP: Record<string, string> = {
  system: "user",
  user: "user",
  assistant: "assistant",
  tool: "assistant",
  function: "assistant",
};

let initialized = false;

export async function initTranslators(): Promise<void> {
  initialized = true;
}

export function isTranslatorInitialized(): boolean {
  return initialized;
}

export function normalizeMessages(messages: unknown): unknown[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(
    (m) => m && typeof m === "object" && typeof (m as JsonRecord).role === "string"
  );
}

export function translateToOpenAI(body: JsonRecord, model: string): JsonRecord {
  const messages = normalizeMessages(body.messages);
  const output: JsonRecord = {
    model: typeof body.model === "string" ? body.model : model,
    messages: messages.map((m) => {
      const record = m as JsonRecord;
      const role = typeof record.role === "string" ? record.role : "user";
      return {
        role: OPENAI_ROLE_MAP[role] ?? "user",
        content: record.content ?? "",
      };
    }),
  };

  if (typeof body.temperature === "number") output.temperature = body.temperature;
  if (typeof body.max_tokens === "number") output.max_tokens = body.max_tokens;
  if (typeof body.max_tokens_to_sample === "number") {
    output.max_tokens = body.max_tokens_to_sample;
  }
  if (typeof body.top_p === "number") output.top_p = body.top_p;
  if (typeof body.stream === "boolean") output.stream = body.stream;
  if (typeof body.stop === "string" || Array.isArray(body.stop)) output.stop = body.stop;

  return output;
}

export function translateToAnthropic(body: JsonRecord, model: string): JsonRecord {
  const messages = normalizeMessages(body.messages);
  const output: JsonRecord = {
    model: typeof body.model === "string" ? body.model : model,
    messages: messages.map((m) => {
      const record = m as JsonRecord;
      const role = typeof record.role === "string" ? record.role : "user";
      return {
        role: ANTHROPIC_ROLE_MAP[role] ?? "user",
        content: typeof record.content === "string" ? record.content : "",
      };
    }),
  };

  if (typeof body.temperature === "number") output.temperature = body.temperature;
  if (typeof body.max_tokens === "number") output.max_tokens = body.max_tokens;
  if (typeof body.max_tokens_to_sample === "number") {
    output.max_tokens = body.max_tokens_to_sample;
  }
  if (typeof body.top_p === "number") output.top_p = body.top_p;
  if (typeof body.stream === "boolean") output.stream = body.stream;

  return output;
}

export function translateToOllama(body: JsonRecord, model: string): JsonRecord {
  const messages = normalizeMessages(body.messages);
  const output: JsonRecord = {
    model: typeof body.model === "string" ? body.model : model,
    messages: messages.map((m) => {
      const record = m as JsonRecord;
      const role = typeof record.role === "string" ? record.role : "user";
      return {
        role: OPENAI_ROLE_MAP[role] ?? "user",
        content: typeof record.content === "string" ? record.content : "",
      };
    }),
  };

  if (typeof body.temperature === "number") output.temperature = body.temperature;
  if (typeof body.max_tokens === "number") output.num_predict = body.max_tokens;
  if (typeof body.top_p === "number") output.top_p = body.top_p;
  if (typeof body.stream === "boolean") output.stream = body.stream;

  return output;
}

function translatePassthrough(body: JsonRecord, model: string): JsonRecord {
  return {
    ...body,
    model: typeof body.model === "string" ? body.model : model,
  };
}

export function translateRequest(
  sourceFormat: string,
  targetFormat: string,
  model: string,
  body: unknown,
  direct = true,
  connectionId: string | null = null,
  provider: string | null = null
): JsonRecord {
  const record = body && typeof body === "object" && !Array.isArray(body) ? (body as JsonRecord) : {};

  switch (targetFormat) {
    case FORMATS.OPENAI:
    case FORMATS.OPENROUTER:
    case FORMATS.AZURE:
      return translateToOpenAI(record, model);
    case FORMATS.ANTHROPIC:
      return translateToAnthropic(record, model);
    case FORMATS.OLLAMA:
      return translateToOllama(record, model);
    default:
      return translatePassthrough(record, model);
  }
}
