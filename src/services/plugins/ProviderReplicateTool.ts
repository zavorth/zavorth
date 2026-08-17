import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { logger } from '../../logger.js';

export class ProviderReplicateTool extends BaseTool {
  public readonly name = 'zavorth_replicate';

  public readonly description =
    'Replicate provider — run ML models in the cloud com uma API. Suporta Llama, Stable Diffusion, Whisper, e centenas de models da comunidade.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'run', 'list_models', 'get_prediction', 'check_status', 'get_pricing'.",
      },
      model: {
        type: 'string',
        description: "Model in format 'owner/name:version' ou 'owner/name'.",
      },
      input: {
        type: 'string',
        description: 'JSON with model inputs.',
      },
      prediction_id: {
        type: 'string',
        description: 'ID de uma prediction (para get_prediction).',
      },
      stream: {
        type: 'boolean',
        description: 'If true, returns streaming. Default: false.',
      },
    },
    required: ['action'],
  };

  private readonly popularModels = [
    { id: 'meta/llama-3-70b-instruct', desc: 'Llama 3 70B Instruct', type: 'text' },
    { id: 'meta/llama-3-8b-instruct', desc: 'Llama 3 8B Instruct', type: 'text' },
    { id: 'mistralai/mistral-7b-instruct-v0.2', desc: 'Mistral 7B v0.2', type: 'text' },
    { id: 'stability-ai/sdxl', desc: 'Stable Diffusion XL', type: 'image' },
    { id: 'openai/whisper', desc: 'Whisper (speech-to-text)', type: 'audio' },
    { id: 'lucataco/faceswap', desc: 'Face Swap', type: 'image' },
    { id: 'tencentarc/photomaker', desc: 'PhotoMaker', type: 'image' },
    { id: 'adirik/interior-design', desc: 'Interior Design', type: 'image' },
  ];

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    switch (action) {
      case 'list_models': return this.listModels();
      case 'get_pricing': return this.getPricing();
      case 'run':
      case 'get_prediction':
      case 'check_status': {
        const apiKey = process.env.REPLICATE_API_TOKEN;
        if (!apiKey) return 'Error: REPLICATE_API_TOKEN not configured. Get at https://replicate.com';
        if (action === 'run') return await this.runModel(args, apiKey);
        if (action === 'get_prediction') return await this.getPrediction(args, apiKey);
        return await this.checkStatus(apiKey);
      }
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private listModels(): string {
    const lines: string[] = ['Modelos populares no Replicate:', ''];
    for (const m of this.popularModels) {
      const icon = { text: '📝', image: '🖼️', audio: '🔊' }[m.type];
      lines.push(`  ${icon} ${m.id} — ${m.desc}`);
    }
    lines.push('', 'More models at: https://replicate.com/explore');
    return lines.join('\n');
  }

  private getPricing(): string {
    return [
      'Replicate Pricing (pay-per-second):',
      '  Llama 3 70B: ~$0.00065/sec (~$2.34/hr)',
      '  Llama 3 8B: ~$0.000165/sec (~$0.59/hr)',
      '  SDXL: ~$0.0009/sec (~$3.24/hr)',
      '  Whisper: ~$0.000237/sec (~$0.85/hr)',
      '',
      'Billed per compute second. No minimum cost.',
      'URL: https://replicate.com/pricing',
    ].join('\n');
  }

  private async runModel(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const model = String(args.model || '');
    if (!model) return 'Error: "model" is required. for run.';

    let input: Record<string, unknown> = {};
    if (typeof args.input === 'string') {
      try { input = JSON.parse(args.input); } catch (error: unknown) {logger.warn('[Replicate] JSON parse failed', error); return 'Error: invalid JSON for "input"..'; }
    }

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({ input, stream: args.stream || false });
      const tmpFile = path.join(os.tmpdir(), `replicate_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `https://api.replicate.com/v1/predictions`,
      ], { timeout: 60000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Replicate] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.detail) return `Replicate error: ${parsed.detail}`;

      const lines: string[] = [
        `Prediction created: ${parsed.id}`,
        `  Modelo: ${model}`,
        `  Status: ${parsed.status}`,
      ];

      if (parsed.status === 'succeeded' && parsed.output) {
        lines.push(`  Output: ${JSON.stringify(parsed.output).slice(0, 500)}`);
      } else if (parsed.status === 'processing') {
        lines.push('  Use "get_prediction" com o ID para verificar result.');
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Replicate] parsing failed', error); return ''; }
  }

  private async getPrediction(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const predictionId = String(args.prediction_id || '');
    if (!predictionId) return 'Error: "prediction_id" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s',
        '-H', `Authorization: Bearer ${apiKey}`,
        `https://api.replicate.com/v1/predictions/${predictionId}`,
      ], { timeout: 30000 }).toString();

      const parsed = JSON.parse(result);
      if (parsed.detail) return `Error: ${parsed.detail}`;

      const lines: string[] = [
        `Prediction: ${parsed.id}`,
        `  Status: ${parsed.status}`,
        `  Modelo: ${parsed.model || 'unknown'}`,
      ];

      if (parsed.output) {
        lines.push(`  Output: ${JSON.stringify(parsed.output).slice(0, 500)}`);
      }
      if (parsed.error) {
        lines.push(`  Error: ${parsed.error}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Replicate] parsing failed', error); return ''; }
  }

  private async checkStatus(apiKey: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-H', `Authorization: Bearer ${apiKey}`,
        'https://api.replicate.com/v1/account',
      ], { timeout: 10000 }).toString();

      const parsed = JSON.parse(result);
      if (parsed.detail) return `Replicate: Error ${parsed.detail}`;
      return `Replicate: Connected. User: ${parsed.username || 'unknown'}`;
    } catch (error: unknown) {logger.warn('[Replicate] JSON parse failed', error); return ''; }
  }
}
