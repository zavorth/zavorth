import { config } from '../config/index.js';
import { safeFetch, readSafeJsonResponse } from '../security/SafeFetchService.js';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from './ILlmProvider.js';

export type GeminiInteractionStepKind =
  | 'user_input'
  | 'model_output'
  | 'function_call'
  | 'function_result'
  | 'thought'
  | 'unknown';

export type GeminiInteractionTimelineStep = {
  index: number;
  kind: GeminiInteractionStepKind;
  text: string | null;
  toolName: string | null;
  toolArguments: Record<string, unknown> | null;
  rawKind: string | null;
};

export type GeminiInteractionReceipt = {
  provider: 'gemini-interactions';
  model: string;
  interactionId: string | null;
  previousInteractionId: string | null;
  steps: GeminiInteractionTimelineStep[];
  storedServerSide: boolean;
};

export type GeminiInteractionsProviderAdapterOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  modelName?: string | null;
  fetchImpl?: typeof fetch;
};

export class GeminiInteractionsProviderAdapter implements ILlmProvider {
  public readonly name = 'gemini-interactions';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModelName: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: GeminiInteractionsProviderAdapterOptions = {}) {
    this.apiKey = String(options.apiKey || config.geminiInteractionsApiKey || config.geminiApiKey || '').trim();
    this.baseUrl = String(options.baseUrl || config.geminiInteractionsBaseUrl || 'https://generativelanguage.googleapis.com/v1beta')
      .trim()
      .replace(/\/+$/, '');
    this.defaultModelName = String(options.modelName || config.geminiInteractionsModel || 'gemini-2.5-flash').trim();
    this.fetchImpl = options.fetchImpl;
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions & { previousInteractionId?: string | null; store?: boolean },
  ): Promise<LlmResponse> {
    if (!config.geminiInteractionsEnabled && process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED !== 'true') {
      throw new Error('Gemini Interactions API is disabled. Set ZAVORTH_GEMINI_INTERACTIONS_ENABLED=true to use this beta route.');
    }
    if (!this.apiKey) {
      throw new Error('Missing GEMINI_INTERACTIONS_API_KEY or GEMINI_API_KEY for Gemini Interactions API.');
    }

    const modelName = options?.modelName || this.defaultModelName;
    const payload = this.buildPayload(messages, tools, {
      modelName,
      previousInteractionId: options?.previousInteractionId || null,
      store: options?.store ?? false,
    });

    const response = await this.requestSafe(`${this.baseUrl}/interactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });
    const body = await readSafeJsonResponse<any>(response, 'Gemini Interactions API').catch(() => null);
    if (!response.ok) {
      const detail = body?.error?.message || body?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini Interactions API error: ${detail}`);
    }

    const receipt = mapGeminiInteractionToReceipt(body, modelName, options?.previousInteractionId || null, Boolean(payload.store));
    const toolCalls = receipt.steps
      .filter((step) => step.kind === 'function_call' && step.toolName)
      .map((step): ToolCall => ({
        id: `interaction_step_${step.index}`,
        name: step.toolName || 'tool',
        arguments: step.toolArguments || {},
      }));
    const content = body?.output_text
      || receipt.steps.filter((step) => step.kind === 'model_output' && step.text).map((step) => step.text).join('\n')
      || null;

    return {
      content,
      toolCalls,
      finishReason: body?.finish_reason || body?.finishReason || 'stop',
      // Preserve timeline without widening the public interface.
      ...( { metadata: { geminiInteractionReceipt: receipt } } as unknown as Partial<LlmResponse> ),
    };
  }

  private buildPayload(
    messages: ChatMessage[],
    tools: ToolDefinition[] | undefined,
    options: { modelName: string; previousInteractionId: string | null; store: boolean },
  ): Record<string, unknown> {
    const systemInstruction = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .filter(Boolean)
      .join('\n');
    const userInput = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : message.role,
        parts: [{ text: message.content || '' }],
      }));

    return {
      model: options.modelName,
      input: userInput.length > 0 ? userInput : [{ role: 'user', parts: [{ text: '' }] }],
      system_instruction: systemInstruction || undefined,
      tools: tools && tools.length > 0
        ? [{ function_declarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })) }]
        : undefined,
      previous_interaction_id: options.previousInteractionId || undefined,
      store: options.store,
    };
  }

  private async requestSafe(url: string, init: RequestInit): Promise<Response> {
    if (this.fetchImpl) {
      return this.fetchImpl(url, init);
    }
    return safeFetch(url, init, {
      serviceName: 'Gemini Interactions API',
    });
  }
}

export function mapGeminiInteractionToReceipt(
  interaction: any,
  model: string,
  previousInteractionId: string | null = null,
  storedServerSide = false,
): GeminiInteractionReceipt {
  const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
  return {
    provider: 'gemini-interactions',
    model,
    interactionId: cleanText(interaction?.id || interaction?.name),
    previousInteractionId,
    storedServerSide,
    steps: steps.map((step: unknown, index: number) => mapStep(step, index)),
  };
}

function mapStep(step: any, index: number): GeminiInteractionTimelineStep {
  const rawKind = cleanText(step?.type || step?.kind || step?.step_type || step?.stepType);
  const functionCall = step?.function_call || step?.functionCall || step?.tool_call || step?.toolCall || null;
  return {
    index,
    kind: normalizeStepKind(rawKind, step),
    text: cleanText(step?.text || step?.output_text || step?.content?.text || step?.model_output?.text || step?.thought?.text),
    toolName: cleanText(functionCall?.name),
    toolArguments: normalizeArguments(functionCall?.args || functionCall?.arguments),
    rawKind,
  };
}

function normalizeStepKind(rawKind: string | null, step: any): GeminiInteractionStepKind {
  const normalized = String(rawKind || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (normalized.includes('user')) return 'user_input';
  if (normalized.includes('model') || normalized.includes('output')) return 'model_output';
  if (normalized.includes('function_call') || normalized.includes('tool_call')) return 'function_call';
  if (normalized.includes('function_result') || normalized.includes('tool_result')) return 'function_result';
  if (normalized.includes('thought') || step?.thought) return 'thought';
  if (step?.function_call || step?.functionCall || step?.tool_call || step?.toolCall) return 'function_call';
  return 'unknown';
}

function normalizeArguments(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}
