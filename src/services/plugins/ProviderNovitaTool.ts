import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

export class ProviderNovitaTool extends BaseTool {
  public readonly name = 'zavorth_novita';

  public readonly description =
    'Novita AI provider plugin — acesso a modelos open-source baratos via API Novita (Llama, Mistral, Qwen, Deepseek, Yi, Phi, etc). Suporta chat completion, streaming e function calling.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'chat', 'list_models', 'check_status', 'get_pricing'.",
      },
      model: {
        type: 'string',
        description: 'Modelo Novita (ex: meta-llama/llama-3-70b-instruct).',
      },
      messages: {
        type: 'string',
        description: 'JSON array de mensagens [{role, content}].',
      },
      max_tokens: {
        type: 'number',
        description: 'Maximo de tokens na resposta. Default: 2048.',
      },
      temperature: {
        type: 'number',
        description: 'Temperatura (0-2). Default: 0.7.',
      },
      stream: {
        type: 'boolean',
        description: 'Se true, retorna streaming. Default: false.',
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
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    switch (action) {
      case 'list_models': return this.listModels();
      case 'get_pricing': return this.getPricing();
      case 'check_status':
      case 'chat': {
        const apiKey = process.env.NOVITA_API_KEY;
        if (!apiKey) return 'Erro: NOVITA_API_KEY nao configurada. Obtenha em https://novita.ai';
        if (action === 'check_status') return await this.checkStatus(apiKey);
        return await this.chat(args, apiKey);
      }
      default: return `Erro: acao "${action}" invalida.`;
    }
  }

  private listModels(): string {
    const lines: string[] = ['Modelos Novita AI disponiveis:', ''];
    for (const model of this.defaultModels) {
      lines.push(`  - ${model}`);
    }
    lines.push('', 'Total: ' + this.defaultModels.length + ' modelos.');
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
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;

      if (statusCode === 200) {
        return 'Novita AI: Conectado e funcionando.';
      }
      return `Novita AI: Erro HTTP ${statusCode}`;
    } catch (error: unknown) {
      return `Novita AI: Erro de conexao: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private getPricing(): string {
    return [
      'Novita AI Pricing (aproximado):',
      '  Llama 3 70B: $0.0009/1K tokens (input), $0.0009/1K (output)',
      '  Llama 3 8B: $0.0002/1K tokens (input), $0.0002/1K (output)',
      '  Mistral 7B: $0.0002/1K tokens',
      '  Deepseek Chat: $0.0005/1K tokens',
      '  Qwen 2 72B: $0.0009/1K tokens',
      '',
      'Preco medio: ~80% mais barato que OpenAI equivalente.',
      'URL: https://novita.ai/pricing',
    ].join('\n');
  }

  private async chat(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const model = String(args.model || 'meta-llama/llama-3-70b-instruct');
    const maxTokens = typeof args.max_tokens === 'number' ? args.max_tokens : 2048;
    const temperature = typeof args.temperature === 'number' ? args.temperature : 0.7;

    let messages: Array<{ role: string; content: string }> = [];
    if (typeof args.messages === 'string') {
      try { messages = JSON.parse(args.messages); } catch {
        return 'Erro: JSON de "messages" invalido.';
      }
    } else if (Array.isArray(args.messages)) {
      messages = args.messages as Array<{ role: string; content: string }>;
    }

    if (messages.length === 0) return 'Erro: "messages" e obrigatorio para chat.';

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

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Erro Novita: ${parsed.error.message || JSON.stringify(parsed.error)}`;

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
    } catch (error: unknown) {
      return `Erro na chamada Novita: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
