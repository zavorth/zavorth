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
import { ContextImageCompressor } from '../services/llm/compression/ContextImageCompressor.js';

import { DynamicModelCatalogService, type ModelDefinition } from '../services/providers/catalog/DynamicModelCatalogService.js';

export const ZAVORTH_TOOL_SPEC_IMMUNE_MARKER = '<!-- zavorth:immune-tool-spec -->';
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
  private readonly compressor = new ContextImageCompressor();

  constructor(
    private readonly inner: ILlmProvider,
    private readonly runtime: {
      providerType?: string;
      injectEmulationPrompt?: boolean;
      injectMinimalHint?: boolean;
      compressContext?: boolean;
      modelResolver?: (modelName?: string) => ModelDefinition | null;
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
    const finalMessages = await this.maybeCompressContext(injectedMessages, options);
    const response = await this.inner.chat(finalMessages, tools, options);
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
    const finalMessages = await this.maybeCompressContext(injectedMessages, options);
    const stream = this.inner.streamChat
      ? this.inner.streamChat(finalMessages, tools, options)
      : [];
    let terminalDoneEmitted = false;
    let fallbackResponse: LlmResponse | null = null;
    for await (const event of stream) {
      if (event.type === 'done' && event.response) {
        terminalDoneEmitted = true;
        yield { ...event, response: this.processResponse(event.response, providerName, modelName) };
        continue;
      }
      if (event.response) {
        fallbackResponse = event.response;
      }
      yield event;
    }
    if (!terminalDoneEmitted && fallbackResponse) {
      yield {
        type: 'done',
        done: true,
        response: this.processResponse(fallbackResponse, providerName, modelName),
      };
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
    const rawSpec = injectFull
      ? this.emulationAdapter.buildPromptToolSpecifications(tools, 'XML_TAGS')
      : buildMinimalHint(tools);
    if (!rawSpec) {
      return messages;
    }
    const spec = `${ZAVORTH_TOOL_SPEC_IMMUNE_MARKER}\n${rawSpec}\n${ZAVORTH_TOOL_SPEC_IMMUNE_MARKER}`;
    const systemIndex = messages.findIndex((message) => message.role === 'system');
    if (systemIndex < 0) {
      return [{ role: 'system', content: spec }, ...messages];
    }
    const system = messages[systemIndex];
    if (!system) {
      return messages;
    }
    if (
      system.content !== null &&
      (system.content.includes(ZAVORTH_TOOL_SPEC_IMMUNE_MARKER) ||
        system.content.includes(EMULATION_FORMAT_HINT) ||
        system.content.includes('<tool_call>'))
    ) {
      return messages;
    }
    const updated = [...messages];
    updated[systemIndex] = {
      ...system,
      content: system.content === null ? spec : `${system.content}\n\n${spec}`,
    };
    return updated;
  }

  private async maybeCompressContext(
    messages: ChatMessage[],
    options?: ProviderChatOptions,
  ): Promise<ChatMessage[]> {
    if (!this.runtime.compressContext) {
      return messages;
    }
    const modelName = options?.modelName;
    const modelDef = this.runtime.modelResolver
      ? this.runtime.modelResolver(modelName)
      : DynamicModelCatalogService.getModel(modelName || '', this.runtime.providerType);
    if (!modelDef?.supportsImageCompression) {
      return messages;
    }
    try {
      const result = await this.compressor.compress(messages, {
        modelName,
      });
      return result.totalBlocksCompressed > 0 ? result.compressedMessages : messages;
    } catch {
      return messages;
    }
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
