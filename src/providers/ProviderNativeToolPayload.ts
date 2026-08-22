import type { ProviderChatOptions, ProviderNativeToolRequest, ToolDefinition } from './ILlmProvider.js';

export type OpenAiCompatibleNativeToolPayload = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[] | undefined;
  extraBody: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFunctionTools(tools?: ToolDefinition[]): any[] {
  return (tools || []).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function buildOpenAiCompatibleNativeToolPayload(input: {
  providerName: string;
  tools?: ToolDefinition[];
  options?: ProviderChatOptions;
}): OpenAiCompatibleNativeToolPayload {
  const providerName = normalize(input.providerName);
  const requested = input.options?.providerNativeTools || [];
  const functionTools = buildFunctionTools(input.tools);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nativeTools: any[] = [];
  const extraBody: Record<string, unknown> = {};
  const activated: string[] = [];
  const unsupported: string[] = [];

  for (const request of requested) {
    if (request.name === 'provider_web_search') {
      if (providerName === 'grok' || providerName === 'xai') {
        extraBody.search_parameters = { mode: 'auto' };
        activated.push(request.name);
        continue;
      }
      if (providerName === 'kimi' || providerName === 'moonshot') {
        nativeTools.push({
          type: 'builtin_function',
          function: { name: '$web_search' },
        });
        activated.push(request.name);
        continue;
      }
      if (providerName === 'perplexity') {
        activated.push(request.name);
        extraBody.zavorth_native_search_hint = 'provider-model-native';
        continue;
      }
      unsupported.push(request.name);
      continue;
    }
    unsupported.push(request.name);
  }

  const mergedTools = [...functionTools, ...nativeTools];
  return {
    tools: mergedTools.length > 0 ? mergedTools : undefined,
    extraBody,
    metadata: {
      providerNativeTools: {
        requested: requested.map(summarizeRequest),
        activated,
        unsupported,
      },
    },
  };
}

function summarizeRequest(request: ProviderNativeToolRequest): Record<string, unknown> {
  return {
    name: request.name,
    reason: request.reason,
    requiredEvidence: request.requiredEvidence || 'none',
  };
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
