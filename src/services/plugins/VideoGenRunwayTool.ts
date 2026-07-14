import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { logger } from '../../logger.js';

export class VideoGenRunwayTool extends BaseTool {
  public readonly name = 'zavorth_runway';

  public readonly description =
    'Runway ML — video generation via API. Gere videos from text or images com Gen-3 Alpha Turbo.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'generate', 'check_status', 'list_models'.",
      },
      prompt: {
        type: 'string',
        description: 'Prompt para geracao de video.',
      },
      prompt_image: {
        type: 'string',
        description: 'URL or path to reference image.',
      },
      duration: {
        type: 'number',
        description: 'Duration em segundos (5 ou 10). Default: 5.',
      },
      resolution: {
        type: 'string',
        description: "Resolution: '720p', '1080p'. Default: '720p'.",
      },
      model: {
        type: 'string',
        description: "Modelo: 'gen3a_turbo' (default), 'gen3a'.",
      },
      task_id: {
        type: 'string',
        description: 'Task ID to check status.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    switch (action) {
      case 'list_models': return this.listModels();
      case 'check_status':
      case 'generate': {
        const apiKey = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET;
        if (!apiKey) return 'Error: RUNWAY_API_KEY not configured. Get at https://dev.runwayml.com';
        if (action === 'generate') return await this.generate(args, apiKey);
        return await this.checkStatus(args, apiKey);
      }
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private listModels(): string {
    return [
      'Modelos Runway disponiveis:',
      '',
      '  gen3a_turbo — Gen-3 Alpha Turbo (rapido, ~$0.05/seg)',
      '  gen3a — Gen-3 Alpha (qualidade alta, ~$0.10/seg)',
      '',
      '  Features:',
      '    - Text to Video',
      '    - Image to Video (imagem como primeiro frame)',
      '    - 5s ou 10s de duration',
      '    - 720p ou 1080p',
      '',
      '  URL: https://runwayml.com/api',
    ].join('\n');
  }

  private async generate(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const prompt = String(args.prompt || '');
    if (!prompt) return 'Error: "prompt" is required. for generate.';

    const duration = typeof args.duration === 'number' ? args.duration : 5;
    const resolution = String(args.resolution || '720p');
    const model = String(args.model || 'gen3a_turbo');
    const promptImage = typeof args.prompt_image === 'string' ? args.prompt_image : undefined;

    try {
      const { execFileSync } = await import('child_process');

      const payload: Record<string, unknown> = {
        model,
        promptText: prompt,
        duration,
        resolution,
      };

      if (promptImage) {
        if (promptImage.startsWith('http')) {
          payload.promptImage = promptImage;
        } else if (fs.existsSync(promptImage)) {
          const imgBuffer = fs.readFileSync(promptImage);
          payload.promptImage = `data:image/png;base64,${imgBuffer.toString('base64')}`;
        }
      }

      const tmpFile = path.join(os.tmpdir(), `runway_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify(payload));

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-H', 'X-Runway-Version: 2024-11-06',
        '-d', `@${tmpFile}`,
        'https://api.dev.runwayml.com/v1/image_to_video',
      ], { timeout: 60000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Video Gen Runway] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Runway error: ${parsed.error.message || JSON.stringify(parsed.error)}`;

      const lines: string[] = [
        `Video generation started:`,
        `  Task ID: ${parsed.id}`,
        `  Status: ${parsed.status}`,
        `  Modelo: ${model}`,
        `  Duration: ${duration}s`,
        `  Resolution: ${resolution}`,
        `  Prompt: "${prompt.slice(0, 80)}"`,
      ];

      if (parsed.status !== 'SUCCEEDED') {
        lines.push('  Use "check_status" com o task_id para acompanhar progresso.');
      }

      if (parsed.output) {
        lines.push(`  Output: ${JSON.stringify(parsed.output).slice(0, 500)}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Video Gen Runway] parsing failed', error); return ''; }
  }

  private async checkStatus(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const taskId = String(args.task_id || '');
    if (!taskId) return 'Error: "task_id" is required. for check_status.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'X-Runway-Version: 2024-11-06',
        `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
      ], { timeout: 30000 }).toString();

      const parsed = JSON.parse(result);
      if (parsed.error) return `Runway error: ${parsed.error.message}`;

      const lines: string[] = [
        `Task: ${parsed.id}`,
        `  Status: ${parsed.status}`,
        `  Progresso: ${parsed.progress || 0}%`,
      ];

      if (parsed.status === 'SUCCEEDED' && parsed.output) {
        lines.push(`  Video: ${JSON.stringify(parsed.output).slice(0, 500)}`);
      }
      if (parsed.failure) {
        lines.push(`  Error: ${parsed.failure}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Video Gen Runway] parsing failed', error); return ''; }
  }
}
