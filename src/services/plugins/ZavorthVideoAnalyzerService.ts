import fs from 'fs';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

export class ZavorthVideoAnalyzerService extends BaseTool {
  public readonly name = 'zavorth_video_analyzer';

  public readonly description =
    'Video intelligence — analyze videos for content, scenes, objects, text, and generate summaries. Extract frames and thumbnails.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'analyze', 'extract_frames', 'get_metadata', 'generate_summary', 'detect_scenes', 'extract_thumbnail'.",
      },
      video_path: {
        type: 'string',
        description: 'Path to video file.',
      },
      frame_interval: {
        type: 'number',
        description: 'Interval in seconds between extracted frames. Default: 5.',
      },
      max_frames: {
        type: 'number',
        description: 'Maximum frames to extract. Default: 10.',
      },
      output_dir: {
        type: 'string',
        description: 'Directory for extracted frames.',
      },
      prompt: {
        type: 'string',
        description: 'Specific question about the video.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    const validActions = ['analyze', 'extract_frames', 'get_metadata', 'generate_summary', 'detect_scenes', 'extract_thumbnail', 'list_capabilities'];
    if (!validActions.includes(action)) return `Error: action "${action}" is invalid.`;

    const videoPath = typeof args.video_path === 'string' ? args.video_path : undefined;
    if (!videoPath && action !== 'list_capabilities') return 'Error: "video_path" is required.';

    switch (action) {
      case 'analyze': return await this.analyzeVideo(videoPath!);
      case 'extract_frames': return await this.extractFrames(videoPath!, args);
      case 'get_metadata': return this.getMetadata(videoPath!);
      case 'generate_summary': return await this.generateSummary(videoPath!, args);
      case 'detect_scenes': return await this.detectScenes(videoPath!);
      case 'extract_thumbnail': return await this.extractThumbnail(videoPath!);
      case 'list_capabilities': return this.listCapabilities();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async analyzeVideo(videoPath: string): Promise<string> {
    if (!fs.existsSync(videoPath)) return `Error: "${videoPath}" not found.`;

    const metadata = this.getVideoMetadata(videoPath);
    const lines: string[] = ['Video Analysis:', ...metadata.split('\n')];

    const videoBuffer = fs.readFileSync(videoPath);
    const base64 = videoBuffer.slice(0, 20 * 1024 * 1024).toString('base64');

    // Try Gemini first (best multimodal support)
    if (process.env.GEMINI_API_KEY) {
      try {
        const analysis = await this.analyzeVideoWithGemini(base64);
        if (analysis) lines.push('', 'AI Analysis:', analysis);
        return lines.join('\n');
      } catch { /* fallback */ }
    }

    // Try OpenAI (frame-by-frame analysis)
    if (process.env.OPENAI_API_KEY) {
      try {
        const analysis = await this.analyzeVideoWithOpenAI(videoPath);
        if (analysis) lines.push('', 'AI Analysis:', analysis);
        return lines.join('\n');
      } catch { /* fallback */ }
    }

    // Try Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const analysis = videoBuffer.length < 5 * 1024 * 1024 ? 'Video too large for Anthropic (max 5MB).' : 'Video analysis via Anthropic not available.';
        lines.push('', 'AI Analysis:', analysis);
        return lines.join('\n');
      } catch { /* fallback */ }
    }

    lines.push('', 'Note: No vision API configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY for AI analysis.');
    return lines.join('\n');
  }

  private async analyzeVideoWithGemini(base64: string): Promise<string> {
    const { execFileSync } = await import('child_process');
    const apiKey = process.env.GEMINI_API_KEY!;
    const payload = JSON.stringify({
      contents: [{ parts: [
        { text: 'Analyze this video. Describe what happens, identify key scenes, objects, and any text visible.' },
        { inline_data: { mime_type: 'video/mp4', data: base64 } },
      ] }],
    });
    const tmpFile = path.join(require('os').tmpdir(), `video_gemini_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, payload);
    try {
      const result = execFileSync('curl', [
        '-s', '-X', 'POST', '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      ], { timeout: 120000 }).toString();
      const parsed = JSON.parse(result);
      return parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
  }

  private async analyzeVideoWithOpenAI(videoPath: string): Promise<string> {
    const { execFileSync } = await import('child_process');
    const apiKey = process.env.OPENAI_API_KEY!;
    const frames = this.extractFramesSync(videoPath, 3);
    const contents = [
      { type: 'text', text: 'Analyze these video frames. Describe what happens, identify key scenes, objects, and any text visible.' },
      ...frames.map((f: string) => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${fs.readFileSync(f).toString('base64')}` } })),
    ];
    const payload = JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: contents }],
      max_tokens: 2048,
    });
    const tmpFile = path.join(require('os').tmpdir(), `video_openai_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, payload);
    try {
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        'https://api.openai.com/v1/chat/completions',
      ], { timeout: 120000 }).toString();
      const parsed = JSON.parse(result);
      return parsed.choices?.[0]?.message?.content || '';
    } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
  }

  private extractFramesSync(videoPath: string, count: number): string[] {
    const { execFileSync } = require('child_process');
    const outputDir = path.join(require('os').tmpdir(), `frames_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });
    try {
      execFileSync('ffmpeg', [
        '-i', videoPath, '-vf', 'fps=1/5', '-frames:v', String(count),
        path.join(outputDir, 'frame_%04d.png'),
      ], { timeout: 30000 });
      return fs.readdirSync(outputDir).filter((f) => f.endsWith('.map')).map((f) => path.join(outputDir, f));
    } catch { return []; }
  }

  private async extractFrames(videoPath: string, args: Record<string, unknown>): Promise<string> {
    if (!fs.existsSync(videoPath)) return `Error: "${videoPath}" not found.`;

    const interval = typeof args.frame_interval === 'number' ? args.frame_interval : 5;
    const maxFrames = typeof args.max_frames === 'number' ? args.max_frames : 10;
    const outputDir = typeof args.output_dir === 'string' ? args.output_dir : path.join(os.tmpdir(), `frames_${Date.now()}`);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('ffmpeg', [
        '-i', videoPath,
        '-vf', `fps=1/${interval}`,
        '-frames:v', String(maxFrames),
        path.join(outputDir, 'frame_%04d.png'),
      ], { timeout: 60000 });

      const frames = fs.readdirSync(outputDir).filter((f) => f.endsWith('.png'));
      return `Extracted ${frames.length} frames to ${outputDir}`;
    } catch (error: unknown) {
      return `Error extracting frames: ${error instanceof Error ? error.message : String(error)}. Is ffmpeg installed?`;
    }
  }

  private getMetadata(videoPath: string): string {
    if (!fs.existsSync(videoPath)) return `Error: "${videoPath}" not found.`;

    const stat = fs.statSync(videoPath);
    const ext = path.extname(videoPath).toLowerCase();
    const sizeMB = stat.size / (1024 * 1024);

    const lines: string[] = [
      `File: ${path.basename(videoPath)}`,
      `Format: ${ext}`,
      `Size: ${sizeMB.toFixed(2)} MB`,
      `Modified: ${stat.mtime.toISOString()}`,
    ];

    try {
      const { execFileSync } = require('child_process');
      const probe = execFileSync('ffprobe', [
        '-v', 'quiet', '-print_format', 'json',
        '-show_format', '-show_streams',
        videoPath,
      ], { timeout: 10000 }).toString();

      const parsed = JSON.parse(probe);
      if (parsed.format) {
        lines.push(`Duration: ${parseFloat(parsed.format.duration || '0').toFixed(1)}s`);
        lines.push(`Bitrate: ${parseInt(parsed.format.bit_rate || '0') / 1000}kbps`);
      }
      if (parsed.streams) {
        const video = parsed.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
        if (video) {
          lines.push(`Resolution: ${video.width}x${video.height}`);
          lines.push(`Codec: ${video.codec_name}`);
          lines.push(`FPS: ${parseFloat(video.r_frame_rate || '0').toFixed(1)}`);
        }
      }
    } catch { /* ffprobe not available */ }

    return lines.join('\n');
  }

  private async generateSummary(videoPath: string, args: Record<string, unknown>): Promise<string> {
    return this.analyzeVideo(videoPath);
  }

  private async detectScenes(videoPath: string): Promise<string> {
    if (!fs.existsSync(videoPath)) return `Error: "${videoPath}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('ffprobe', [
        '-v', 'quiet', '-show_frames',
        '-of', 'json',
        '-f', 'lavfi', `movie=${videoPath},select='gt(scene,0.3)'`,
      ], { timeout: 30000 }).toString();

      const parsed = JSON.parse(result);
      const scenes = parsed.frames?.length || 0;
      return `Detected ${scenes} scene changes in video.`;
    } catch {
      return 'Scene detection requires ffmpeg with lavfi support.';
    }
  }

  private async extractThumbnail(videoPath: string): Promise<string> {
    if (!fs.existsSync(videoPath)) return `Error: "${videoPath}" not found.`;

    const outputPath = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);
    try {
      const { execFileSync } = await import('child_process');
      execFileSync('ffmpeg', ['-i', videoPath, '-ss', '00:00:01', '-vframes', '1', outputPath], { timeout: 10000 });
      return `Thumbnail saved: ${outputPath}`;
    } catch {
      return 'Thumbnail extraction requires ffmpeg.';
    }
  }

  private listCapabilities(): string {
    return [
      'Video Analyzer Capabilities:',
      '  analyze: Full video analysis (metadata + AI description)',
      '  extract_frames: Extract frames at intervals via ffmpeg',
      '  get_metadata: Video metadata (duration, resolution, codec, fps)',
      '  generate_summary: AI-generated video summary',
      '  detect_scenes: Scene change detection via ffmpeg',
      '  extract_thumbnail: Extract thumbnail frame',
    ].join('\n');
  }
}
