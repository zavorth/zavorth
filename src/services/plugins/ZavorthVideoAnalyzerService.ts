import fs from 'fs';
import path from 'path';
import os from 'os';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { getBestProvider, getAvailableProviders, callVisionProvider, listProviders } from './MultimodalProviderSelector.js';
import { safeParseInt } from '../../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../../logger.js';

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
      case 'get_metadata': return await this.getMetadata(videoPath!);
      case 'generate_summary': return await this.generateSummary(videoPath!, args);
      case 'detect_scenes': return await this.detectScenes(videoPath!);
      case 'extract_thumbnail': return await this.extractThumbnail(videoPath!);
      case 'list_capabilities': return this.listCapabilities();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async analyzeVideo(videoPath: string): Promise<string> {
    if (!fs.existsSync(videoPath)) return `Error: "${videoPath}" not found.`;

    const metadata = await this.getMetadata(videoPath);
    const lines: string[] = ['Video Analysis:', ...metadata.split('\n')];

    const provider = getBestProvider('video');
    if (!provider) {
      lines.push('', 'Note: No video provider available. Configure GEMINI_API_KEY or OPENAI_API_KEY.');
      return lines.join('\n');
    }

    try {
      const apiKey = process.env[provider.apiKeyEnv]!;
      const videoBuffer = fs.readFileSync(videoPath);
      const base64 = videoBuffer.slice(0, 20 * 1024 * 1024).toString('base64');
      const analysis = await callVisionProvider(provider, base64, 'video/mp4', 'Analyze this video. Describe what happens, identify key scenes, objects, and any text visible.', apiKey);
      lines.push('', 'AI Analysis:', analysis);
    } catch (error: any) {
      lines.push('', `Analysis error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return lines.join('\n');
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
    } catch (error: any) { logger.warn('[Zavorth Video Analyzer] filesystem operation failed', error); return ''; }
  }

  private async getMetadata(videoPath: string): Promise<string> {
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
      const { execFileSync } = await import('child_process');
      const probe = execFileSync('ffprobe', [
        '-v', 'quiet', '-print_format', 'json',
        '-show_format', '-show_streams',
        videoPath,
      ], { timeout: 10000 }).toString();

      const parsed = JSON.parse(probe) as { format?: { duration?: string; bit_rate?: string }; streams?: Array<{ codec_type: string; width?: number; height?: number; codec_name?: string; r_frame_rate?: string }> };
      if (parsed.format) {
        lines.push(`Duration: ${parseFloat(parsed.format.duration || '0').toFixed(1)}s`);
        lines.push(`Bitrate: ${safeParseInt(parsed.format.bit_rate, 0) / 1000}kbps`);
      }
      if (parsed.streams) {
        const video = parsed.streams.find((s) => s.codec_type === 'video');
        if (video) {
          lines.push(`Resolution: ${video.width}x${video.height}`);
          lines.push(`Codec: ${video.codec_name}`);
          lines.push(`FPS: ${parseFloat(video.r_frame_rate || '0').toFixed(1)}`);
        }
      }
    } catch (error: any) { /* ffprobe not available */ logger.warn('[Zavorth Video Analyzer] parsing failed', error); }

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

      const parsed = JSON.parse(result) as { frames?: Array<{ pkt_pts_time?: string }> };
      const scenes = parsed.frames?.length || 0;
      return `Detected ${scenes} scene changes in video.`;
    } catch (error: any) { logger.warn('[Zavorth Video Analyzer] JSON parse failed', error); return 'Scene detection requires ffmpeg with lavfi support.'; }
  }

  private async extractThumbnail(videoPath: string): Promise<string> {
    if (!fs.existsSync(videoPath)) return `Error: "${videoPath}" not found.`;

    const outputPath = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);
    try {
      const { execFileSync } = await import('child_process');
      execFileSync('ffmpeg', ['-i', videoPath, '-ss', '00:00:01', '-vframes', '1', outputPath], { timeout: 10000 });
      return `Thumbnail saved: ${outputPath}`;
    } catch (error: any) { logger.warn('[Zavorth Video Analyzer] filesystem operation failed', error); return 'Thumbnail extraction requires ffmpeg.'; }
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
