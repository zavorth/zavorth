import { logger } from '../../../../logger.js';
import fs from 'fs';
import path from 'path';
import { isCapabilityUnavailableError } from '../../../../services/OptionalCapabilityGuard.js';
import { YtDlpFallback } from '../../../../gateways/channels/telegram/YtDlpFallback.js';
import { VideoHandlerUrlSupport } from '../../../../gateways/channels/telegram/video-handler/VideoHandlerUrlSupport.js';
import { VideoHandlerFormatSupport } from '../../../../gateways/channels/telegram/video-handler/VideoHandlerFormatSupport.js';
import {
  MAX_TRANSCRIPTION_BYTES,
  VideoTranscriptionPipeline,
  type VideoTranscriptResult,
} from '../../../../gateways/channels/telegram/video-handler/VideoTranscriptionPipeline.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

export class VideoYtDlpTranscriptSupport {
  public constructor(
    private readonly ytDlpFallback: YtDlpFallback,
    private readonly transcriptionPipeline: VideoTranscriptionPipeline,
  ) {}

  public async tryCaptions(videoUrl: string): Promise<VideoTranscriptResult | null> {
    if (!this.ytDlpFallback.isAvailable()) {
      return {
        transcript: '',
        source: 'yt-dlp not provisionado',
        warnings: [this.ytDlpFallback.getAvailabilityWarning() || VideoHandlerUrlSupport.buildMediaCapabilityWarning('The optional yt-dlp fallback is not provisioned on this host.')],
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
        warnings: ['Found captions via yt-dlp and avoided downloading the full video audio.'],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (isCapabilityUnavailableError(error)) {
        return {
          transcript: '',
          source: 'yt-dlp captions unavailable',
          warnings: [err.message],
        };
      }
      const errorMessage = error instanceof Error ? err.message : String(error);
      logger.warn(`[VideoHandler] yt-dlp captions failed: ${errorMessage}`);
      return {
        transcript: '',
        source: 'yt-dlp captions unavailable',
        warnings: [`Attempt to download captions via yt-dlp failed: ${errorMessage}`],
      };
    }
  }

  public async tryTranscript(videoUrl: string): Promise<VideoTranscriptResult | null> {
    if (!this.ytDlpFallback.isAvailable()) {
      return {
        transcript: '',
        source: 'yt-dlp not provisionado',
        warnings: [this.ytDlpFallback.getAvailabilityWarning() || VideoHandlerUrlSupport.buildMediaCapabilityWarning('The optional yt-dlp fallback is not provisioned on this host.')],
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
            prompt: 'Transcribe the spoken content of the YouTube video with good punctuation and preserve proper names and relevant data.',
          });

          return {
            transcript,
            source: `${downloaded.source} + OpenAI transcription`,
            warnings,
          };
        } catch (error: unknown) {
          const err = asErrorLike(error);
          const errorMessage = error instanceof Error ? err.message : String(error);
          warnings.push(`O fallback de transcription literal com OpenAI failed: ${errorMessage}`);
        }
      } else {
        warnings.push(`O audio extraido tem ${VideoHandlerFormatSupport.formatMegabytes(downloadedStats.size)} MB e sera processado em chunks para maior confiabilidade.`);
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
        VideoHandlerFormatSupport.guessMimeTypeFromPath(downloaded.audioPath),
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
          : ['The yt-dlp fallback extracted the audio, but no subsequent step produced useful text content.'],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (isCapabilityUnavailableError(error)) {
        return {
          transcript: '',
          source: 'yt-dlp unavailable',
          warnings: [err.message],
        };
      }
      const errorMessage = error instanceof Error ? err.message : String(error);
      logger.warn(`[VideoHandler] yt-dlp fallback failed: ${errorMessage}`);
      return {
        transcript: '',
        source: 'yt-dlp unavailable',
        warnings: [`O fallback com yt-dlp/ffmpeg failed: ${errorMessage}`],
      };
    } finally {
      if (downloadedAudioPath) {
        VideoHandlerFormatSupport.cleanup(downloadedAudioPath);
      }
    }
  }
}
