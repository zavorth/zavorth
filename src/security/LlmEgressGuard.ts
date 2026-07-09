import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
} from '../providers/ILlmProvider.js';
import {
  detectSensitiveData,
  redactSensitiveData,
  redactSensitiveText,
  type SensitiveDataFinding,
} from './SensitiveDataGuard.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerReceipt,
} from './SecurityPolicyBroker.js';


export type LlmEgressGuardReport = {
  redacted: boolean;
  findingCount: number;
  findings: SensitiveDataFinding[];
  policyReceipt: SecurityPolicyBrokerReceipt;
};

export type LlmEgressPayload = {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  report: LlmEgressGuardReport;
};

const SECURE_LLM_PROVIDER = Symbol.for('zavorth.secureLlmProvider');

export function sanitizeLlmEgressPayload(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
): LlmEgressPayload {
  const findings = [
    ...detectSensitiveData(messages).map((finding) => ({
      ...finding,
      path: `messages${finding.path.slice(1)}`,
    })),
    ...collectToolTextFindings(tools || []),
  ];
  const policyDecision = decideSecurityPolicy({
    surface: 'llm-egress',
    operation: 'provider_payload',
    target: 'llm-provider',
    redaction: {
      applied: findings.length > 0,
      findingCount: findings.length,
      reasons: findings.length > 0
        ? ['Raw sensitive values were redacted before provider egress.']
        : [],
    },
    reasons: findings.length > 0
      ? ['LLM provider payload can leave the host; sensitive data must be redacted first.']
      : ['LLM provider payload passed central egress policy without sensitive findings.'],
  });

  if (findings.length === 0) {
    return {
      messages,
      tools,
      report: {
        redacted: false,
        findingCount: 0,
        findings: [],
        policyReceipt: policyDecision.receipt,
      },
    };
  }

  return {
    messages: redactSensitiveData(messages) as ChatMessage[],
    tools: tools ? redactToolDefinitions(tools) : undefined,
    report: {
      redacted: true,
      findingCount: findings.length,
      findings,
      policyReceipt: policyDecision.receipt,
    },
  };
}

export function buildLlmEgressGuardMetadata(report: LlmEgressGuardReport): Record<string, unknown> | undefined {
  if (!report.redacted) {
    return undefined;
  }

  return {
    llmEgressGuard: {
      redacted: true,
      findingCount: report.findingCount,
      policyReceipt: report.policyReceipt,
      findings: report.findings.slice(0, 20).map((finding) => ({
        path: finding.path,
        kind: finding.kind,
        preview: finding.preview,
      })),
    },
  };
}

export function wrapLlmProviderWithEgressGuard(provider: ILlmProvider): ILlmProvider {
  const maybeWrapped = provider as ILlmProvider & { [SECURE_LLM_PROVIDER]?: true };
  if (maybeWrapped[SECURE_LLM_PROVIDER]) {
    return provider;
  }

  const wrapped: ILlmProvider & { [SECURE_LLM_PROVIDER]?: true } = {
    [SECURE_LLM_PROVIDER]: true,
    get name() {
      return provider.name;
    },
    async chat(
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      options?: ProviderChatOptions,
    ): Promise<LlmResponse> {
      const guarded = sanitizeLlmEgressPayload(messages, tools);
      return provider.chat(guarded.messages, guarded.tools, options);
    },
  };

  if (provider.streamChat) {
    wrapped.streamChat = (
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      options?: ProviderChatOptions,
    ): AsyncIterable<LlmStreamEvent> => {
      const guarded = sanitizeLlmEgressPayload(messages, tools);
      return provider.streamChat!(guarded.messages, guarded.tools, options);
    };
  }

  return wrapped;
}

function redactToolDefinitions(tools: ToolDefinition[]): ToolDefinition[] {
  return tools.map((tool) => redactToolDefinition(tool));
}

function redactToolDefinition(tool: ToolDefinition): ToolDefinition {
  return {
    ...tool,
    description: redactSensitiveText(tool.description),
    dangerLevel: tool.dangerLevel ? redactSensitiveText(tool.dangerLevel) : tool.dangerLevel,
    category: tool.category ? redactSensitiveText(tool.category) : tool.category,
    parameters: {
      ...tool.parameters,
      properties: Object.fromEntries(
        Object.entries(tool.parameters?.properties || {}).map(([name, parameter]) => [
          name,
          {
            ...parameter,
            description: redactSensitiveText(parameter.description),
            enum: parameter.enum?.map((entry) => redactSensitiveText(entry)),
          },
        ]),
      ),
      required: tool.parameters?.required ? [...tool.parameters.required] : tool.parameters?.required,
    },
  };
}

function collectToolTextFindings(tools: ToolDefinition[]): SensitiveDataFinding[] {
  const findings: SensitiveDataFinding[] = [];
  tools.forEach((tool, toolIndex) => {
    collectStringFindings(tool.description, `tools[${toolIndex}].description`, findings);
    if (tool.category) {
      collectStringFindings(tool.category, `tools[${toolIndex}].category`, findings);
    }
    if (tool.dangerLevel) {
      collectStringFindings(tool.dangerLevel, `tools[${toolIndex}].dangerLevel`, findings);
    }
    Object.entries(tool.parameters?.properties || {}).forEach(([name, parameter]) => {
      collectStringFindings(parameter.description, `tools[${toolIndex}].parameters.properties.${name}.description`, findings);
      parameter.enum?.forEach((entry, enumIndex) => {
        collectStringFindings(entry, `tools[${toolIndex}].parameters.properties.${name}.enum[${enumIndex}]`, findings);
      });
    });
  });
  return findings;
}

function collectStringFindings(
  value: unknown,
  path: string,
  findings: SensitiveDataFinding[],
): void {
  if (typeof value !== 'string') {
    return;
  }
  for (const finding of detectSensitiveData(value)) {
    findings.push({
      ...finding,
      path,
    });
  }
}
