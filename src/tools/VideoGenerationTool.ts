
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export class VideoGenerationTool extends BaseTool {
  public readonly name = 'generate_video';

  public readonly description =
    'Generates videos from a text prompt or base image.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed text description of the video to generate.',
      },
      duration: {
        type: 'number',
        description: 'Video duration in seconds (1-60). Default: 5.',
      },
      resolution: {
        type: 'string',
        description: "Video resolution. Examples: '720p', '1080p', '4k'. Default: '1080p'.",
      },
      fps: {
        type: 'number',
        description: 'Frames per second (12-60). Default: 24.',
      },
      style: {
        type: 'string',
        description: "Visual style of the video. Examples: 'realistic', 'cinematic', 'animated', 'timelapse'.",
      },
      reference_image: {
        type: 'string',
        description: 'Path or URL of a base image to generate the video from.',
      },
    },
    required: ['prompt'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const prompt = String(args.prompt || '');
    if (!prompt) {
      return 'Error: the "prompt" parameter is required.';
    }

    const duration = typeof args.duration === 'number' ? args.duration : 5;
    const resolution = typeof args.resolution === 'string' ? args.resolution : '1080p';
    const fps = typeof args.fps === 'number' ? args.fps : 24;
    const style = typeof args.style === 'string' ? args.style : 'realistic';
    const referenceImage = typeof args.reference_image === 'string' ? args.reference_image : null;

    if (duration < 1 || duration > 60) {
      return 'Error: duration must be between 1 and 60 seconds.';
    }
    if (fps < 12 || fps > 60) {
      return 'Error: fps must be between 12 and 60.';
    }

    const validResolutions = ['720p', '1080p', '4k'];
    if (!validResolutions.includes(resolution)) {
      return `Error: resolution "${resolution}" is not supported. Use: ${validResolutions.join(', ')}.`;
    }

    const endpoint = String(process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT || '').trim();
    const apiKey = String(process.env.ZAVORTH_VIDEO_GENERATION_API_KEY || '').trim();
    if (!endpoint) {
      return 'Error: video backend is not configured. Configure ZAVORTH_VIDEO_GENERATION_ENDPOINT to run real generation.';
    }

    try {
      const response = await safeFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          duration,
          resolution,
          fps,
          style,
          reference_image: referenceImage,
        }),
      }, {
        serviceName: 'Video generation tool',
      });
      const text = await response.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (error: unknown) {logger.warn('[Video Generation] JSON parse failed', error);
    payload = { rawText: text.slice(0, 1000) };
  }
      if (!response.ok) {
        return `Video generation error: backend returned HTTP ${response.status}.`;
      }

      const videoId = String(payload.id || payload.videoId || payload.jobId || `video-${Date.now()}`);
      const status = String(payload.status || 'submitted');
      const outputUrl = String(payload.url || payload.outputUrl || payload.downloadUrl || '');

      return [
        'Video submitted for real generation successfully.',
        `  - Video ID: ${videoId}`,
        `  - Status: ${status}`,
        `  - Prompt: "${prompt}"`,
        `  - Duration: ${duration}s`,
        `  - Resolution: ${resolution}`,
        `  - FPS: ${fps}`,
        `  - Style: ${style}`,
        outputUrl ? `  - URL: ${outputUrl}` : '  - URL: unavailable in backend response',
      ].join('\n');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Video Generation] creation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Video generation error: ${message}`;
  }
  }
}
