import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { safeParseInt } from '../../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../../logger.js';

interface NovitaChatMessage {
  role: string;
  content: string;
}

interface NovitaUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface NovitaChoice {
  message?: NovitaChatMessage;
  finish_reason?: string;
}

interface NovitaErrorResponse {
  message?: string;
}

interface NovitaChatResponse {
  choices?: NovitaChoice[];
  usage?: NovitaUsage;
  error?: NovitaErrorResponse;
}

export class ProviderNovitaTool extends BaseTool {
  public readonly name = 'zavorth_novita';

  public readonly description =
    'Novita AI provider plugin — access to cheap open-source models via API Novita (Llama, Mistral, Qwen, Deepseek, Yi, Phi, etc). Suporta chat completion, streaming e function calling.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'chat', 'list_models', 'check_status', 'get_pricing'.",
      },
      model: {
        type: 'string',
        description: 'Modelo Novita (ex: meta-llama/llama-3-70b-instruct).',
      },
      messages: {
        type: 'string',
        description: 'JSON array of messages [{role, content}].',
      },
      max_tokens: {
        type: 'number',
        description: 'Maximum tokens in response. Default: 2048.',
      },
      temperature: {
        type: 'number',
        description: 'Temperature (0-2). Default: 0.7.',
      },
      stream: {
        type: 'boolean',
        description: 'If true, returns streaming. Default: false.',
      },
    },
    required: ['action'],
  };

  private readonly baseUrl = 'https://api.novita.ai/v3/openai';
  private readonly defaultModels = [
    'meta-llama/llama-3-70b-instruct',
    'meta-llama/llama-3-8b-instruct',
    'mistralai/mistral-7b-instruct',
    'deepseek/deepseek-chat',
    'Qwen/qwen-2-72b-instruct',
    '01-ai/yi-1.5-34b-chat',
    'microsoft/phi-3-mini-128k-instruct',
    'NousResearch/hermes-2-pro-llama-3-70b',
  ];

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    switch (action) {
      case 'list_models': return this.listModels();
      case 'get_pricing': return this.getPricing();
      case 'check_status':
      case 'chat': {
        const apiKey = process.env.NOVITA_API_KEY;
        if (!apiKey) return 'Error: NOVITA_API_KEY not configured. Get at https://novita.ai';
        if (action === 'check_status') return await this.checkStatus(apiKey);
        return await this.chat(args, apiKey);
      }
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private listModels(): string {
    const lines: string[] = ['Available Novita AI models:', ''];
    for (const model of this.defaultModels) {
      lines.push(`  - ${model}`);
    }
    lines.push('', 'Total: ' + this.defaultModels.length + ' models.');
    return lines.join('\n');
  }

  private async checkStatus(apiKey: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-w', '\n__HTTP_STATUS__%{http_code}',
        '-H', `Authorization: Bearer ${apiKey}`,
        `${this.baseUrl}/models`,
      ], { timeout: 10000 }).toString();

      const statusMatch = result.match(/__HTTP_STATUS__(\d+)/);
      const statusCode = statusMatch ? safeParseInt(statusMatch[1], 0) : 0;

      if (statusCode === 200) {
        return 'Novita AI: Connected e funcionando.';
      }
      return `Novita AI: HTTP Error ${statusCode}`;
    } catch (error: unknown) {logger.warn('[Novita] network request failed', error); return ''; }
  }

  private getPricing(): string {
    return [
      'Novita AI Pricing (approximate):',
      '  Llama 3 70B: $0.0009/1K tokens (input), $0.0009/1K (output)',
      '  Llama 3 8B: $0.0002/1K tokens (input), $0.0002/1K (output)',
      '  Mistral 7B: $0.0002/1K tokens',
      '  Deepseek Chat: $0.0005/1K tokens',
      '  Qwen 2 72B: $0.0009/1K tokens',
      '',
      'Preco medio: ~80% cheaper than OpenAI equivalente.',
      'URL: https://novita.ai/pricing',
    ].join('\n');
  }

  private async chat(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const model = String(args.model || 'meta-llama/llama-3-70b-instruct');
    const maxTokens = typeof args.max_tokens === 'number' ? args.max_tokens : 2048;
    const temperature = typeof args.temperature === 'number' ? args.temperature : 0.7;

    let messages: NovitaChatMessage[] = [];
    if (typeof args.messages === 'string') {
      try { messages = JSON.parse(args.messages); } catch (error: unknown) {logger.warn('[Novita] JSON parse failed', error); return 'Error: invalid JSON for "messages"..'; }
    } else if (Array.isArray(args.messages)) {
      messages = args.messages as NovitaChatMessage[];
    }

    if (messages.length === 0) return 'Error: "messages" is required. for chat.';

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      });

      const tmpFile = path.join(os.tmpdir(), `novita_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `${this.baseUrl}/chat/completions`,
      ], { timeout: 60000, maxBuffer: 5 * 1024 * 1024 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Novita] file cleanup failed', error); }

      const parsed: NovitaChatResponse = JSON.parse(result);
      if (parsed.error) return `Novita error: ${parsed.error.message || JSON.stringify(parsed.error)}`;

      const content = parsed.choices?.[0]?.message?.content || result;
      const usage = parsed.usage;
      const lines: string[] = [
        `Resposta (${model}):`,
        content,
      ];
      if (usage) {
        lines.push(`\nTokens: ${usage.prompt_tokens} input + ${usage.completion_tokens} output = ${usage.total_tokens} total`);
      }
      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Novita] parsing failed', error); return ''; }
  }
}
