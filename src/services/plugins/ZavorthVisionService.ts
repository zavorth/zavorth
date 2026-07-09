import fs from 'fs';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { getBestProvider, getAvailableProviders, callVisionProvider, listProviders } from './MultimodalProviderSelector.js';
import { logger } from '../../logger.js';

export class ZavorthVisionService extends BaseTool {
  public readonly name = 'zavorth_vision';

  public readonly description =
    'Vision intelligence — analyze images, screenshots, documents, charts, diagrams. Extract text (OCR), identify objects, describe scenes.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'analyze', 'ocr', 'describe', 'compare', 'extract_text', 'identify_objects'.",
      },
      image_path: {
        type: 'string',
        description: 'Path to image file.',
      },
      image_url: {
        type: 'string',
        description: 'URL of image.',
      },
      prompt: {
        type: 'string',
        description: 'Specific question about the image.',
      },
      second_image_path: {
        type: 'string',
        description: 'Second image for comparison.',
      },
      language: {
        type: 'string',
        description: 'OCR language. Default: eng.',
      },
      detail_level: {
        type: 'string',
        description: "Detail level: 'brief', 'detailed', 'exhaustive'. Default: 'detailed'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    const validActions = ['analyze', 'ocr', 'describe', 'compare', 'extract_text', 'identify_objects'];
    if (!validActions.includes(action)) return `Error: action "${action}" is invalid.`;

    const imagePath = typeof args.image_path === 'string' ? args.image_path : undefined;
    const imageUrl = typeof args.image_url === 'string' ? args.image_url : undefined;

    if (!imagePath && !imageUrl) {
      return 'Error: "image_path" or "image_url" is required.';
    }

    switch (action) {
      case 'analyze': return await this.analyzeImage(args);
      case 'ocr': return await this.ocrImage(args);
      case 'describe': return await this.describeImage(args);
      case 'compare': return await this.compareImages(args);
      case 'extract_text': return await this.extractText(args);
      case 'identify_objects': return await this.identifyObjects(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async analyzeImage(args: Record<string, unknown>): Promise<string> {
    const imagePath = String(args.image_path || '');
    const prompt = String(args.prompt || 'Analyze this image in detail.');
    const detailLevel = String(args.detail_level || 'detailed');

    if (!fs.existsSync(imagePath)) return `Error: "${imagePath}" not found.`;

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = this.getMimeType(imagePath);

    const provider = getBestProvider('vision');
    if (!provider) {
      return `Error: No vision provider available. Configure one of: ${getAvailableProviders('vision').map(p => p.apiKeyEnv).join(', ')}`;
    }

    try {
      const apiKey = process.env[provider.apiKeyEnv]!;
      return await callVisionProvider(provider, base64, mimeType, `${prompt} Detail level: ${detailLevel}`, apiKey);
    } catch (error: any) { logger.warn('[Zavorth Vision] operation failed', error); return ''; }
  }

  private async ocrImage(args: Record<string, unknown>): Promise<string> {
    const imagePath = String(args.image_path || '');
    const language = String(args.language || 'eng');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('tesseract', [imagePath, 'stdout', '-l', language], {
        timeout: 30000,
        maxBuffer: 5 * 1024 * 1024,
      }).toString();
      return `OCR result:\n${result}`;
    } catch (error: any) { logger.warn('[Zavorth Vision] process execution failed', error); return ''; }
  }

  private async describeImage(args: Record<string, unknown>): Promise<string> {
    return this.analyzeImage({ ...args, prompt: 'Describe this image in detail. What do you see?' });
  }

  private async compareImages(args: Record<string, unknown>): Promise<string> {
    return 'Image comparison requires two images. Provide image_path and second_image_path.';
  }

  private async extractText(args: Record<string, unknown>): Promise<string> {
    return this.ocrImage(args);
  }

  private async identifyObjects(args: Record<string, unknown>): Promise<string> {
    return this.analyzeImage({ ...args, prompt: 'Identify all objects in this image. List each object with its location.' });
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
    return map[ext] || 'image/jpeg';
  }
}
