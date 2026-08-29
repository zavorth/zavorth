import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
} from './ILlmProvider.js';
import { ZavorthUniversalToolCallingAdapterService } from '../services/llm/emulation/ZavorthUniversalToolCallingAdapterService.js';
import { ModelToolCallingCapabilityTracker } from '../services/llm/ModelToolCallingCapabilityTracker.js';

const EMULATION_FORMAT_HINT = '__zavorth_emulated_tools__';

function buildMinimalHint(tools: ToolDefinition[]): string {
  const toolNames = tools.map((tool) => tool.name).join(', ');
  return [
    EMULATION_FORMAT_HINT,
    `Available tools: ${toolNames}`,
    'To invoke a tool, output: {"tool": "tool_name", "arguments": {...}}',
    'You may call several tools in sequence.',
  ].join('\n');
}

/**
 * Transparent provider decorator that keeps native tool calling untouched and
 * only synthesizes emulated tool calls when the model returned no native
 * tool_calls but wrote invocations into its text output. It learns each
 * model's capability dynamically from observed behavior — no hardcoded map.
 */
export class EmulatedToolCallingProviderDecorator implements ILlmProvider {
  public readonly name: string;
  private readonly emulationAdapter = new ZavorthUniversalToolCallingAdapterService();
  private readonly tracker: ModelToolCallingCapabilityTracker;

  constructor(
    private readonly inner: ILlmProvider,
    private readonly runtime: {
      providerType?: string;
      injectEmulationPrompt?: boolean;
      injectMinimalHint?: boolean;
    } = {},
  ) {
    this.name = inner.name;
    this.tracker = ModelToolCallingCapabilityTracker.getInstance();
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    const providerName = this.name;
    const modelName = options?.modelName || null;
    const injectedMessages = this.maybeInjectEmulationPrompt(messages, tools, providerName, modelName);
    const response = await this.inner.chat(injectedMessages, tools, options);
    return this.processResponse(response, providerName, modelName);
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    const providerName = this.name;
    const modelName = options?.modelName || null;
    const injectedMessages = this.maybeInjectEmulationPrompt(messages, tools, providerName, modelName);
    const stream = this.inner.streamChat
      ? this.inner.streamChat(injectedMessages, tools, options)
      : [];
    let finalResponse: LlmResponse | null = null;
    for await (const event of stream) {
      if (event.response) {
        finalResponse = event.response;
      }
      yield event;
    }
    if (finalResponse) {
      const recovered = this.processResponse(finalResponse, providerName, modelName);
      if (recovered.toolCalls.length > 0) {
        yield {
          type: 'done',
          done: true,
          response: recovered,
        };
      }
    }
  }

  private maybeInjectEmulationPrompt(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    providerName?: string,
    modelName?: string | null,
  ): ChatMessage[] {
    if (!tools || tools.length === 0) {
      return messages;
    }
    const track = this.tracker.getTrack(providerName || this.name, modelName);
    const injectFull = this.runtime.injectEmulationPrompt === true || track === 'emulated';
    const injectMinimal = this.runtime.injectMinimalHint === true || track === 'unknown';
    if (!injectFull && !injectMinimal) {
      return messages;
    }
    const systemIndex = messages.findIndex((message) => message.role === 'system');
    if (systemIndex < 0) {
      return messages;
    }
    const system = messages[systemIndex];
    if (!system || system.content === null) {
      return messages;
    }
    if (system.content.includes(EMULATION_FORMAT_HINT)) {
      return messages;
    }
    const spec = injectFull
      ? this.emulationAdapter.buildPromptToolSpecifications(tools, 'XML_TAGS')
      : buildMinimalHint(tools);
    if (!spec) {
      return messages;
    }
    const updated = [...messages];
    updated[systemIndex] = {
      ...system,
      content: `${system.content}\n\n${spec}`,
    };
    return updated;
  }

  private processResponse(
    response: LlmResponse,
    providerName: string,
    modelName: string | null,
  ): LlmResponse {
    const hadNative = response.toolCalls.length > 0;
    if (hadNative) {
      this.tracker.record({ providerName, modelName, hadNativeToolCalls: true, hadEmulatedToolCalls: false });
      return response;
    }
    const content = response.content || '';
    const parsed = this.emulationAdapter.extractToolInvocations(content);
    const hadEmulated = parsed.hasToolCalls;
    this.tracker.record({ providerName, modelName, hadNativeToolCalls: false, hadEmulatedToolCalls: hadEmulated });
    if (!hadEmulated) {
      return response;
    }
    return {
      ...response,
      content: parsed.cleanConversationalText || content,
      toolCalls: parsed.toolCalls.map((invocation) => ({
        id: invocation.id,
        name: invocation.name,
        arguments: invocation.parameters,
      })),
      finishReason: 'tool_calls',
      metadata: {
        ...(response.metadata || {}),
        emulatedToolCalling: true,
        emulatedToolCount: parsed.toolCalls.length,
      },
    };
  }
}
