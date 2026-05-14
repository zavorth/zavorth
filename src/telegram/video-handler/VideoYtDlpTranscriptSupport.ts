import fs from 'fs';
import path from 'path';
import { isCapabilityUnavailableError } from '../../services/OptionalCapabilityGuard.js';
import { YtDlpFallback } from '../YtDlpFallback.js';
import { VideoHandlerHelpers } from './VideoHandlerHelpers.js';
import {
  MAX_TRANSCRIPTION_BYTES,
  VideoTranscriptionPipeline,
  type VideoTranscriptResult,
} from './VideoTranscriptionPipeline.js';

export class VideoYtDlpTranscriptSupport {
  public constructor(
    private readonly ytDlpFallback: YtDlpFallback,
    private readonly transcriptionPipeline: VideoTranscriptionPipeline,
  ) {}

  public async tryCaptions(videoUrl: string): Promise<VideoTranscriptResult | null> {
    if (!this.ytDlpFallback.isAvailable()) {
      return {
        transcript: '',
        source: 'yt-dlp nao provisionado',
        warnings: [this.ytDlpFallback.getAvailabilityWarning() || VideoHandlerHelpers.buildMediaCapabilityWarning('O fallback opcional de yt-dlp nao esta provisionado neste host.')],
      };
    }

    try {
      const captions = await this.ytDlpFallback.downloadCaptions(videoUrl);
      if (!captions?.transcript) {
        return null;
      }

      return {
        transcript: captions.transcript,
        source: captions.source,
        warnings: ['Encontrei legendas via yt-dlp e evitei baixar o audio completo do video.'],
      };
    } catch (error) {
      if (isCapabilityUnavailableError(error)) {
        return {
          transcript: '',
          source: 'yt-dlp captions indisponivel',
          warnings: [error.message],
        };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[VideoHandler] yt-dlp captions falhou: ${errorMessage}`);
      return {
        transcript: '',
        source: 'yt-dlp captions indisponivel',
        warnings: [`A tentativa de baixar legendas via yt-dlp falhou: ${errorMessage}`],
      };
    }
  }

  public async tryTranscript(videoUrl: string): Promise<VideoTranscriptResult | null> {
    if (!this.ytDlpFallback.isAvailable()) {
      return {
        transcript: '',
        source: 'yt-dlp nao provisionado',
        warnings: [this.ytDlpFallback.getAvailabilityWarning() || VideoHandlerHelpers.buildMediaCapabilityWarning('O fallback opcional de yt-dlp nao esta provisionado neste host.')],
      };
    }

    let downloadedAudioPath: string | null = null;

    try {
      const downloaded = await this.ytDlpFallback.downloadAudio(videoUrl);
      if (!downloaded) {
        return null;
      }

      downloadedAudioPath = downloaded.audioPath;
      const warnings: string[] = [];
      const downloadedStats = fs.statSync(downloaded.audioPath);

      if (downloadedStats.size <= MAX_TRANSCRIPTION_BYTES) {
        try {
          const transcript = await this.transcriptionPipeline.transcribeWithRetries(downloaded.audioPath, {
            prompt: 'Transcreva o conteudo falado do video do YouTube com boa pontuacao e preserve nomes proprios e dados relevantes.',
          });

          return {
            transcript,
            source: `${downloaded.source} + OpenAI transcription`,
            warnings,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          warnings.push(`O fallback de transcricao literal com OpenAI falhou: ${errorMessage}`);
        }
      } else {
        warnings.push(`O audio extraido tem ${VideoHandlerHelpers.formatMegabytes(downloadedStats.size)} MB e sera processado em chunks para maior confiabilidade.`);
      }

      const chunkedTranscript = await this.transcriptionPipeline.tryChunkedAudioTranscript(
        downloaded.audioPath,
        path.basename(downloaded.audioPath),
      );
      if (chunkedTranscript) {
        warnings.push(...chunkedTranscript.warnings);
        if (chunkedTranscript.transcript) {
          return {
            transcript: chunkedTranscript.transcript,
            source: `${downloaded.source} + ${chunkedTranscript.source}`,
            warnings,
          };
        }
      }

      const geminiAudioAnalysis = await this.transcriptionPipeline.tryGeminiLocalAudio(
        downloaded.audioPath,
        VideoHandlerHelpers.guessMimeTypeFromPath(downloaded.audioPath),
        path.basename(downloaded.audioPath),
      );

      if (geminiAudioAnalysis?.analysisText) {
        warnings.push(...geminiAudioAnalysis.warnings);
        return {
          transcript: geminiAudioAnalysis.analysisText,
          source: `${downloaded.source} + ${geminiAudioAnalysis.source}`,
          warnings,
        };
      }

      const dedicatedGeminiTranscript = await this.transcriptionPipeline.tryDedicatedGeminiFallbackTranscript(
        downloaded.audioPath,
        path.basename(downloaded.audioPath),
      );

      if (dedicatedGeminiTranscript) {
        warnings.push(...dedicatedGeminiTranscript.warnings);
        if (dedicatedGeminiTranscript.transcript) {
          return {
            transcript: dedicatedGeminiTranscript.transcript,
            source: `${downloaded.source} + ${dedicatedGeminiTranscript.source}`,
            warnings,
          };
        }
      }

      return {
        transcript: '',
        source: downloaded.source,
        warnings: warnings.length > 0
          ? warnings
          : ['O fallback com yt-dlp conseguiu extrair o audio, mas nenhuma etapa posterior produziu conteudo textual util.'],
      };
    } catch (error) {
      if (isCapabilityUnavailableError(error)) {
        return {
          transcript: '',
          source: 'yt-dlp indisponivel',
          warnings: [error.message],
        };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[VideoHandler] yt-dlp fallback falhou: ${errorMessage}`);
      return {
        transcript: '',
        source: 'yt-dlp indisponivel',
        warnings: [`O fallback com yt-dlp/ffmpeg falhou: ${errorMessage}`],
      };
    } finally {
      if (downloadedAudioPath) {
        VideoHandlerHelpers.cleanup(downloadedAudioPath);
      }
    }
  }
}
