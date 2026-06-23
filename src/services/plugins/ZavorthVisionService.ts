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

    if (!fs.existsSync(imagePath)) return `Error: "${imagePath}" not found.`;

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = this.getMimeType(imagePath);

    // Try Gemini first (best quality, free tier available)
    if (process.env.GEMINI_API_KEY) {
      try { return await this.analyzeWithGemini(base64, mimeType, prompt, detailLevel); } catch { /* fallback */ }
    }

    // Try OpenAI GPT-4 Vision
    if (process.env.OPENAI_API_KEY) {
      try { return await this.analyzeWithOpenAI(base64, mimeType, prompt, detailLevel); } catch { /* fallback */ }
    }

    // Try Anthropic Claude Vision
    if (process.env.ANTHROPIC_API_KEY) {
      try { return await this.analyzeWithAnthropic(base64, mimeType, prompt, detailLevel); } catch { /* fallback */ }
    }

    return 'Error: No vision API key configured (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY required).';
  }

  private async analyzeWithGemini(base64: string, mimeType: string, prompt: string, detailLevel: string): Promise<string> {
    const { execFileSync } = await import('child_process');
    const apiKey = process.env.GEMINI_API_KEY!;
    const payload = JSON.stringify({
      contents: [{ parts: [
        { text: `${prompt} Detail level: ${detailLevel}` },
        { inline_data: { mime_type: mimeType, data: base64.slice(0, 4 * 1024 * 1024) } },
      ] }],
    });
    const tmpFile = path.join(require('os').tmpdir(), `vision_gemini_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, payload);
    try {
      const result = execFileSync('curl', [
        '-s', '-X', 'POST', '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      ], { timeout: 60000 }).toString();
      const parsed = JSON.parse(result);
      return parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available.';
    } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
  }

  private async analyzeWithOpenAI(base64: string, mimeType: string, prompt: string, detailLevel: string): Promise<string> {
    const { execFileSync } = await import('child_process');
    const apiKey = process.env.OPENAI_API_KEY!;
    const payload = JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [
        { type: 'text', text: `${prompt} Detail level: ${detailLevel}` },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64.slice(0, 4 * 1024 * 1024)}` } },
      ] }],
      max_tokens: 2048,
    });
    const tmpFile = path.join(require('os').tmpdir(), `vision_openai_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, payload);
    try {
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        'https://api.openai.com/v1/chat/completions',
      ], { timeout: 60000 }).toString();
      const parsed = JSON.parse(result);
      return parsed.choices?.[0]?.message?.content || 'No analysis available.';
    } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
  }

  private async analyzeWithAnthropic(base64: string, mimeType: string, prompt: string, detailLevel: string): Promise<string> {
    const { execFileSync } = await import('child_process');
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64.slice(0, 4 * 1024 * 1024) } },
        { type: 'text', text: `${prompt} Detail level: ${detailLevel}` },
      ] }],
    });
    const tmpFile = path.join(require('os').tmpdir(), `vision_anthropic_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, payload);
    try {
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `x-api-key: ${apiKey}`,
        '-H', 'anthropic-version: 2023-06-01',
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        'https://api.anthropic.com/v1/messages',
      ], { timeout: 60000 }).toString();
      const parsed = JSON.parse(result);
      return parsed.content?.[0]?.text || 'No analysis available.';
    } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
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
