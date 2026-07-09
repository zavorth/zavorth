import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { logger } from '../../logger.js';

export class ImageGenFalTool extends BaseTool {
  public readonly name = 'zavorth_fal';

  public readonly description =
    'fal.ai — image generation via API. Supports Stable Diffusion XL, FLUX, and proprietary models. Run image models in the cloud.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'generate', 'list_models', 'check_status'.",
      },
      prompt: {
        type: 'string',
        description: 'Prompt for image generation.',
      },
      negative_prompt: {
        type: 'string',
        description: 'Negative prompt (what to avoid).',
      },
      model: {
        type: 'string',
        description: "Modelo: 'fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/stable-diffusion-v3-medium', 'fal-ai/flux-pro'.",
      },
      width: {
        type: 'number',
        description: 'Image width. Default: 1024.',
      },
      height: {
        type: 'number',
        description: 'Image height. Default: 1024.',
      },
      num_images: {
        type: 'number',
        description: 'Number of images. Default: 1.',
      },
      seed: {
        type: 'number',
        description: 'Seed for reproducibility.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: the "action" parameter is required.';

    switch (action) {
      case 'list_models': return this.listModels();
      case 'check_status': return this.checkStatus();
      case 'generate': return await this.generate(args);
      default: return `Error: invalid action "${action}".`;
    }
  }

  private listModels(): string {
    return [
      'Available fal.ai models:',
      '',
      '  fal-ai/flux/schnell — FLUX Schnell (rapido, ~1s)',
      '  fal-ai/flux/dev — FLUX Dev (qualidade alta)',
      '  fal-ai/flux-pro — FLUX Pro (qualidade maxima)',
      '  fal-ai/stable-diffusion-v3-medium — SD3 Medium',
      '  fal-ai/flux-realism — FLUX Realism (fotos realistas)',
      '  fal-ai/flux-lora — FLUX com LoRA customizavel',
      '  fal-ai/controlnet — ControlNet (guided generation)',
      '',
      'Price: ~$0.003-0.05 per image depending on the model.',
      'URL: https://fal.ai/models',
    ].join('\n');
  }

  private checkStatus(): string {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) return 'fal.ai: FAL_KEY not configured. Get one at https://fal.ai/zavorthControl/keys';
    return 'fal.ai: API key configured.';
  }

  private async generate(args: Record<string, unknown>): Promise<string> {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) return 'Error: FAL_KEY not configured. Get one at https://fal.ai/zavorthControl/keys';

    const prompt = String(args.prompt || '');
    if (!prompt) return 'Error: "prompt" is required for generate.';

    const model = String(args.model || 'fal-ai/flux/schnell');
    const width = typeof args.width === 'number' ? args.width : 1024;
    const height = typeof args.height === 'number' ? args.height : 1024;
    const numImages = typeof args.num_images === 'number' ? args.num_images : 1;
    const negativePrompt = typeof args.negative_prompt === 'string' ? args.negative_prompt : undefined;
    const seed = typeof args.seed === 'number' ? args.seed : undefined;

    try {
      const { execFileSync } = await import('child_process');

      const input: Record<string, unknown> = {
        prompt,
        image_size: { width, height },
        num_images: numImages,
      };
      if (negativePrompt) input.negative_prompt = negativePrompt;
      if (seed !== undefined) input.seed = seed;

      const payload = JSON.stringify({ input });
      const tmpFile = path.join(os.tmpdir(), `fal_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Key ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `https://fal.run/${model}`,
      ], { timeout: 120000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Image Gen Fal] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `fal.ai Error: ${parsed.error.message || JSON.stringify(parsed.error)}`;

      const images = parsed.images || [parsed.image] || [];
      const lines: string[] = [
        `Image(s) generated via ${model}:`,
        `  Prompt: "${prompt.slice(0, 100)}"`,
        `  Size: ${width}x${height}`,
        `  Images: ${images.length}`,
      ];

      for (const img of images) {
        if (img.url) {
          lines.push(`  URL: ${img.url}`);
          try {
            const outputPath = path.join(os.tmpdir(), `fal_image_${Date.now()}.png`);
            execFileSync('curl', ['-s', '-o', outputPath, img.url], { timeout: 30000 });
            if (fs.existsSync(outputPath)) {
              lines.push(`  Saved: ${outputPath}`);
            }
          } catch (error: unknown) {/* ignore */ logger.warn('[Image Gen Fal] filesystem operation failed', error); }
        }
      }

      if (parsed.timings) {
        lines.push(`  Time: ${JSON.stringify(parsed.timings)}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Image Gen Fal] filesystem operation failed', error); return ''; }
  }
}
