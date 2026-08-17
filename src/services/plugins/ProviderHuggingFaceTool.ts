import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { logger } from '../../logger.js';

export class ProviderHuggingFaceTool extends BaseTool {
  public readonly name = 'zavorth_huggingface';

  public readonly description =
    'HuggingFace Inference API — run open-source models directly via API. Suporta text generation, image generation, audio, e mais.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'text_generation', 'image_generation', 'audio_transcription', 'list_models', 'check_status'.",
      },
      model: {
        type: 'string',
        description: 'Modelo HF (ex: meta-llama/Meta-Llama-3-8B-Instruct).',
      },
      prompt: {
        type: 'string',
        description: 'Prompt for text generation.',
      },
      image_path: {
        type: 'string',
        description: 'Image path para analysis.',
      },
      audio_path: {
        type: 'string',
        description: 'Path to audio for transcription.',
      },
      max_tokens: {
        type: 'number',
        description: 'Maximum tokens. Default: 256.',
      },
      temperature: {
        type: 'number',
        description: 'Temperature (0-1). Default: 0.7.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    switch (action) {
      case 'list_models': return this.listModels();
      case 'check_status': return await this.checkStatus();
      case 'text_generation':
      case 'image_generation':
      case 'audio_transcription': {
        const apiKey = process.env.HF_API_TOKEN || process.env.HUGGINGFACE_TOKEN;
        if (!apiKey) return 'Error: HF_API_TOKEN not configured. Get at https://huggingface.co/settings/tokens';
        if (action === 'text_generation') return await this.textGeneration(args, apiKey);
        if (action === 'image_generation') return await this.imageGeneration(args, apiKey);
        return await this.audioTranscription(args, apiKey);
      }
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private listModels(): string {
    return [
      'Modelos populares no HuggingFace:',
      '',
      '  Text Generation:',
      '    meta-llama/Meta-Llama-3-8B-Instruct',
      '    mistralai/Mistral-7B-Instruct-v0.2',
      '    google/gemma-2-9b-it',
      '    Qwen/Qwen2-72B-Instruct',
      '    deepseek-ai/DeepSeek-V2-Chat',
      '',
      '  Image Generation:',
      '    stabilityai/stable-diffusion-xl-base-1.0',
      '    black-forest-labs/FLUX.1-schnell',
      '    runwayml/stable-diffusion-v1-5',
      '',
      '  Audio:',
      '    openai/whisper-large-v3',
      '    facebook/seamless-m4t-v2-large',
      '',
      '  Mais em: https://huggingface.co/models',
    ].join('\n');
  }

  private async checkStatus(): Promise<string> {
    const apiKey = process.env.HF_API_TOKEN || process.env.HUGGINGFACE_TOKEN;
    if (!apiKey) return 'HuggingFace: Token not configured.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-H', `Authorization: Bearer ${apiKey}`,
        'https://huggingface.co/api/whoami-v2',
      ], { timeout: 10000 }).toString();

      const parsed = JSON.parse(result);
      if (parsed.error) return `HuggingFace: Error ${parsed.error}`;
      return `HuggingFace: Connected. User: ${parsed.name || 'unknown'}, Plan: ${parsed.plan || 'free'}`;
    } catch (error: unknown) {logger.warn('[Hugging Face] JSON parse failed', error); return ''; }
  }

  private async textGeneration(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const model = String(args.model || 'meta-llama/Meta-Llama-3-8B-Instruct');
    const prompt = String(args.prompt || '');
    if (!prompt) return 'Error: "prompt" is required. for text_generation.';

    const maxTokens = typeof args.max_tokens === 'number' ? args.max_tokens : 256;
    const temperature = typeof args.temperature === 'number' ? args.temperature : 0.7;

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: maxTokens, temperature, return_full_text: false },
      });

      const tmpFile = path.join(os.tmpdir(), `hf_text_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `https://api-inference.huggingface.co/models/${model}`,
      ], { timeout: 120000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Hugging Face] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `HF error: ${parsed.error}`;

      const text = Array.isArray(parsed) ? parsed[0]?.generated_text : parsed.generated_text || result;
      return `Resposta (${model}):\n${text}`;
    } catch (error: unknown) {logger.warn('[Hugging Face] JSON parse failed', error); return ''; }
  }

  private async imageGeneration(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const model = String(args.model || 'stabilityai/stable-diffusion-xl-base-1.0');
    const prompt = String(args.prompt || '');
    if (!prompt) return 'Error: "prompt" is required. for image_generation.';

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({ inputs: prompt });
      const tmpFile = path.join(os.tmpdir(), `hf_img_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const outputPath = path.join(os.tmpdir(), `hf_image_${Date.now()}.png`);
      execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        '-o', outputPath,
        `https://api-inference.huggingface.co/models/${model}`,
      ], { timeout: 120000 });

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Hugging Face] file cleanup failed', error); }

      if (fs.existsSync(outputPath)) {
        return `Imagem gerada: ${outputPath}`;
      }
      return 'Error: Image was not generated.';
    } catch (error: unknown) {logger.warn('[Hugging Face] file cleanup failed', error); return ''; }
  }

  private async audioTranscription(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const model = String(args.model || 'openai/whisper-large-v3');
    const audioPath = String(args.audio_path || '');
    if (!audioPath) return 'Error: "audio_path" is required.';
    if (!fs.existsSync(audioPath)) return `Error: file "${audioPath}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-F', `file=@${audioPath}`,
        `https://api-inference.huggingface.co/models/${model}`,
      ], { timeout: 120000 }).toString();

      const parsed = JSON.parse(result);
      if (parsed.error) return `HF error: ${parsed.error}`;
      return `Transcricao: ${parsed.text || result}`;
    } catch (error: unknown) {logger.warn('[Hugging Face] JSON parse failed', error); return ''; }
  }
}
