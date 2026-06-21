import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { safeFetch } from '../security/SafeFetchService.js';

export class VideoGenerationTool extends BaseTool {
  public readonly name = 'generate_video';

  public readonly description =
    'Gera vídeos a partir de um prompt textual ou imagem base.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Descrição textual detalhada do vídeo a ser gerado.',
      },
      duration: {
        type: 'number',
        description: 'Duração do vídeo em segundos (1-60). Default: 5.',
      },
      resolution: {
        type: 'string',
        description: "Resolução do vídeo. Exemplos: '720p', '1080p', '4k'. Default: '1080p'.",
      },
      fps: {
        type: 'number',
        description: 'Frames por segundo (12-60). Default: 24.',
      },
      style: {
        type: 'string',
        description: "Estilo visual do vídeo. Exemplos: 'realistic', 'cinematic', 'animated', 'timelapse'.",
      },
      reference_image: {
        type: 'string',
        description: 'Caminho ou URL de uma imagem base para gerar o vídeo a partir dela.',
      },
    },
    required: ['prompt'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const prompt = String(args.prompt || '');
    if (!prompt) {
      return 'Erro: o parametro "prompt" e obrigatorio.';
    }

    const duration = typeof args.duration === 'number' ? args.duration : 5;
    const resolution = typeof args.resolution === 'string' ? args.resolution : '1080p';
    const fps = typeof args.fps === 'number' ? args.fps : 24;
    const style = typeof args.style === 'string' ? args.style : 'realistic';
    const referenceImage = typeof args.reference_image === 'string' ? args.reference_image : null;

    if (duration < 1 || duration > 60) {
      return 'Erro: duracao deve estar entre 1 e 60 segundos.';
    }
    if (fps < 12 || fps > 60) {
      return 'Erro: fps deve estar entre 12 e 60.';
    }

    const validResolutions = ['720p', '1080p', '4k'];
    if (!validResolutions.includes(resolution)) {
      return `Erro: resolucao "${resolution}" nao suportada. Use: ${validResolutions.join(', ')}.`;
    }

    const endpoint = String(process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT || '').trim();
    const apiKey = String(process.env.ZAVORTH_VIDEO_GENERATION_API_KEY || '').trim();
    if (!endpoint) {
      return 'Erro: backend de video nao configurado. Configure ZAVORTH_VIDEO_GENERATION_ENDPOINT para executar geracao real.';
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
      } catch {
        payload = { rawText: text.slice(0, 1000) };
      }
      if (!response.ok) {
        return `Erro ao gerar video: backend retornou HTTP ${response.status}.`;
      }

      const videoId = String(payload.id || payload.videoId || payload.jobId || `video-${Date.now()}`);
      const status = String(payload.status || 'submitted');
      const outputUrl = String(payload.url || payload.outputUrl || payload.downloadUrl || '');

      return [
        'Video enviado para geracao real com sucesso.',
        `  - Video ID: ${videoId}`,
        `  - Status: ${status}`,
        `  - Prompt: "${prompt}"`,
        `  - Duracao: ${duration}s`,
        `  - Resolucao: ${resolution}`,
        `  - FPS: ${fps}`,
        `  - Estilo: ${style}`,
        outputUrl ? `  - URL: ${outputUrl}` : '  - URL: indisponivel no retorno do backend',
      ].join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro ao gerar video: ${message}`;
    }
  }
}
