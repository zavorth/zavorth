import fs from 'fs';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

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

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return 'Error: GEMINI_API_KEY or OPENAI_API_KEY required for vision.';

    try {
      const { execFileSync } = await import('child_process');
      const imageBuffer = fs.readFileSync(imagePath);
      const base64 = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(imagePath);

      if (process.env.GEMINI_API_KEY) {
        const payload = JSON.stringify({
          contents: [{ parts: [
            { text: `${prompt} Detail level: ${detailLevel}` },
            { inline_data: { mime_type: mimeType, data: base64.slice(0, 4 * 1024 * 1024) } },
          ] }],
        });
        const tmpFile = path.join(require('os').tmpdir(), `vision_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, payload);
        try {
          const result = execFileSync('curl', [
            '-s', '-X', 'POST',
            '-H', 'Content-Type: application/json',
            '-d', `@${tmpFile}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          ], { timeout: 60000 }).toString();
          const parsed = JSON.parse(result);
          return parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available.';
        } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
      }

      return 'Error: No vision API key configured.';
    } catch (error: unknown) {
      return `Error analyzing image: ${error instanceof Error ? error.message : String(error)}`;
    }
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
    } catch (error: unknown) {
      return `OCR error: ${error instanceof Error ? error.message : String(error)}. Is tesseract installed?`;
    }
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
