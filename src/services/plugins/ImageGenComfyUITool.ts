import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { logger } from '../../logger.js';

export class ImageGenComfyUITool extends BaseTool {
  public readonly name = 'zavorth_comfyui';

  public readonly description =
    'ComfyUI — local and private image generation via API. Node-based workflow engine para Stable Diffusion, FLUX, e modelos customizados. Rode tudo localmente.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'generate', 'list_workflows', 'list_models', 'check_status', 'get_queue'.",
      },
      prompt: {
        type: 'string',
        description: 'Prompt para geracao de imagem.',
      },
      negative_prompt: {
        type: 'string',
        description: 'Negative prompt (what to avoid).',
      },
      workflow: {
        type: 'string',
        description: "Workflow: 'txt2img' (default), 'img2img', 'inpaint', 'upscale'.",
      },
      model: {
        type: 'string',
        description: 'Modelo checkpoint (ex: sd_xl_base_1.0.safetensors).',
      },
      width: {
        type: 'number',
        description: 'Largura. Default: 1024.',
      },
      height: {
        type: 'number',
        description: 'Altura. Default: 1024.',
      },
      steps: {
        type: 'number',
        description: 'Steps de denoising. Default: 20.',
      },
      cfg_scale: {
        type: 'number',
        description: 'CFG Scale. Default: 7.',
      },
      seed: {
        type: 'number',
        description: 'Seed (-1 para aleatorio).',
      },
      image_path: {
        type: 'string',
        description: 'Image path (para img2img/inpaint).',
      },
      server_url: {
        type: 'string',
        description: 'Server URL ComfyUI. Default: http://127.0.0.1:8188.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    const serverUrl = String(args.server_url || 'http://127.0.0.1:8188');

    switch (action) {
      case 'list_workflows': return this.listWorkflows();
      case 'list_models': return await this.listModels(serverUrl);
      case 'check_status': return await this.checkStatus(serverUrl);
      case 'get_queue': return await this.getQueue(serverUrl);
      case 'generate': return await this.generate(args, serverUrl);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private listWorkflows(): string {
    return [
      'Workflows ComfyUI disponiveis:',
      '',
      '  txt2img — Text to Image (prompt -> imagem)',
      '  img2img — Image to Image (imagem + prompt -> nova imagem)',
      '  inpaint — Inpainting (mascara + prompt -> area editada)',
      '  upscale — Upscale (imagem -> imagem maior)',
      '',
      'Workflows customizados podem ser carregados via API.',
    ].join('\n');
  }

  private async listModels(serverUrl: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '--max-time', '5',
        `${serverUrl}/object_info/CheckpointLoaderSimple`,
      ], { timeout: 10000 }).toString();

      const parsed = JSON.parse(result);
      const models = parsed.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];

      if (models.length === 0) return 'No model found in ComfyUI.';

      const lines: string[] = ['Modelos ComfyUI:'];
      for (const m of models.slice(0, 20)) {
        lines.push(`  - ${m}`);
      }
      if (models.length > 20) lines.push(`  ... e mais ${models.length - 20}`);
      return lines.join('\n');
    } catch (error) { logger.warn('[Image Gen Comfy U I] load operation failed', error); return ''; }
  }

  private async checkStatus(serverUrl: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '--max-time', '5',
        `${serverUrl}/system_stats`,
      ], { timeout: 10000 }).toString();

      const parsed = JSON.parse(result);
      const vram = parsed.devices?.[0]?.vram_total;
      const freeVram = parsed.devices?.[0]?.vram_free;

      return [
        'ComfyUI: Connected',
        `  Sistema: ${parsed.system?.os || 'unknown'}`,
        `  Python: ${parsed.system?.python_version || 'unknown'}`,
        vram ? `  VRAM: ${(vram / 1024 / 1024 / 1024).toFixed(1)}GB (livre: ${(freeVram / 1024 / 1024 / 1024).toFixed(1)}GB)` : '',
      ].filter(Boolean).join('\n');
    } catch (error) { logger.warn('[Image Gen Comfy U I] parsing failed', error); return ''; }
  }

  private async getQueue(serverUrl: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-s', `${serverUrl}/queue`], { timeout: 5000 }).toString();
      const parsed = JSON.parse(result);

      const running = parsed.queue_running?.length || 0;
      const pending = parsed.queue_pending?.length || 0;

      return `Fila ComfyUI: ${running} running, ${pending} pendente(s).`;
    } catch (error) { logger.warn('[Image Gen Comfy U I] JSON parse failed', error); return 'Error querying queue.'; }
  }

  private async generate(args: Record<string, unknown>, serverUrl: string): Promise<string> {
    const prompt = String(args.prompt || '');
    if (!prompt) return 'Error: "prompt" is required.';

    const negativePrompt = String(args.negative_prompt || 'ugly, blurry, low quality');
    const width = typeof args.width === 'number' ? args.width : 1024;
    const height = typeof args.height === 'number' ? args.height : 1024;
    const steps = typeof args.steps === 'number' ? args.steps : 20;
    const cfgScale = typeof args.cfg_scale === 'number' ? args.cfg_scale : 7;
    const seed = typeof args.seed === 'number' ? args.seed : Math.floor(Math.random() * 2 ** 32);
    const model = String(args.model || '');

    try {
      const { execFileSync } = await import('child_process');

      const workflow: Record<string, unknown> = {
        '3': {
          class_type: 'KSampler',
          inputs: {
            seed,
            steps,
            cfg: cfgScale,
            sampler_name: 'euler_ancestral',
            scheduler: 'normal',
            denoise: 1,
            model: ['4', 0],
            positive: ['6', 0],
            negative: ['7', 0],
            latent_image: ['5', 0],
          },
        },
        '4': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: model || 'sd_xl_base_1.0.safetensors' },
        },
        '5': {
          class_type: 'EmptyLatentImage',
          inputs: { width, height, batch_size: 1 },
        },
        '6': {
          class_type: 'CLIPTextEncode',
          inputs: { text: prompt, clip: ['4', 1] },
        },
        '7': {
          class_type: 'CLIPTextEncode',
          inputs: { text: negativePrompt, clip: ['4', 1] },
        },
        '8': {
          class_type: 'VAEDecode',
          inputs: { samples: ['3', 0], vae: ['4', 2] },
        },
        '9': {
          class_type: 'SaveImage',
          inputs: { filename_prefix: 'zavorth', images: ['8', 0] },
        },
      };

      const payload = JSON.stringify({ prompt: workflow, client_id: `zavorth_${Date.now()}` });
      const tmpFile = path.join(os.tmpdir(), `comfyui_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `${serverUrl}/prompt`,
      ], { timeout: 30000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error) { /* ignore */ logger.warn('[Image Gen Comfy U I] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `ComfyUI error: ${parsed.error}`;

      return [
        'Imagem enfileirada no ComfyUI:',
        `  Prompt ID: ${parsed.prompt_id}`,
        `  Prompt: "${prompt.slice(0, 80)}"`,
        `  Tamanho: ${width}x${height}`,
        `  Steps: ${steps}`,
        `  CFG: ${cfgScale}`,
        `  Seed: ${seed}`,
        `  Modelo: ${model || 'sd_xl_base_1.0.safetensors'}`,
        '  Use "get_queue" para acompanhar progresso.',
      ].join('\n');
    } catch (error) { logger.warn('[Image Gen Comfy U I] parsing failed', error); return ''; }
  }
}
