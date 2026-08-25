import { logger } from '../../../logger.js';
import fs from 'fs';
import path from 'path';
import { Context } from 'grammy';
import { config } from '../../../config/index.js';
import { InlineData } from '../../../providers/ILlmProvider.js';
import { AudioHandler } from '../../../gateways/channels/telegram/AudioHandler.js';
import { AudioChunker } from '../../../gateways/channels/telegram/AudioChunker.js';
import { GeminiVideoService } from '../../../providers/GeminiVideoService.js';
import { StorageMaintenance } from '../../../gateways/channels/telegram/StorageMaintenance.js';
import { YtDlpFallback } from '../../../gateways/channels/telegram/YtDlpFallback.js';
import {
  type ProcessedVideoContext,
  type TelegramVideoDescriptor,
  type VideoMetadata,
  type YouTubeCaptionTrack,
} from '../../../gateways/channels/telegram/video-handler/VideoHandlerTypes.js';
import {
  MAX_TRANSCRIPTION_BYTES,
  VideoTranscriptionPipeline,
} from '../../../gateways/channels/telegram/video-handler/VideoTranscriptionPipeline.js';
import { VideoYtDlpTranscriptSupport } from '../../../gateways/channels/telegram/video-handler/VideoYtDlpTranscriptSupport.js';

import { VideoHandlerHelpers } from '../../../gateways/channels/telegram/video-handler/VideoHandlerHelpers.js';
import { asErrorLike } from '../../../utils/errorLike.js';
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv']);
const MAX_NATIVE_YOUTUBE_GEMINI_DURATION_SECONDS = 30 * 60;

type YouTubePlayerResponse = {
  videoDetails?: {
    title?: string;
    author?: string;
    shortDescription?: string;
    lengthSeconds?: string | number;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: YouTubeCaptionTrack[];
    };
  };
};

export interface PreparedVideoInput {
  messageText: string;
  inlineData?: InlineData[];
}

export class VideoHandler {
  private audioHandler: AudioHandler;
  private audioChunker: AudioChunker;
  private videoContextDir: string;
  private geminiVideoAnalyzer: GeminiVideoService;
  private geminiTranscriptionFallbackAnalyzer: GeminiVideoService;
  private storageMaintenance: StorageMaintenance;
  private ytDlpFallback: YtDlpFallback;
  private transcriptionPipeline: VideoTranscriptionPipeline;
  private ytDlpTranscriptSupport: VideoYtDlpTranscriptSupport;

  constructor() {
    this.audioHandler = new AudioHandler();
    this.audioChunker = new AudioChunker();
    this.videoContextDir = path.join(config.dataDir, 'video-contexts');
    this.geminiVideoAnalyzer = new GeminiVideoService();
    this.geminiTranscriptionFallbackAnalyzer = new GeminiVideoService({
      apiKey: config.geminiTranscriptionApiKey,
      model: config.geminiTranscriptionModel,
    });
    this.storageMaintenance = new StorageMaintenance();
    this.ytDlpFallback = new YtDlpFallback();
    this.transcriptionPipeline = new VideoTranscriptionPipeline({
      audioHandler: this.audioHandler,
      audioChunker: this.audioChunker,
      geminiVideoAnalyzer: this.geminiVideoAnalyzer,
      geminiTranscriptionFallbackAnalyzer: this.geminiTranscriptionFallbackAnalyzer,
    });
    this.ytDlpTranscriptSupport = new VideoYtDlpTranscriptSupport(
      this.ytDlpFallback,
      this.transcriptionPipeline,
    );
    VideoHandlerHelpers.ensureDirectory(config.tmpDir);
    VideoHandlerHelpers.ensureDirectory(this.videoContextDir);

    try {
      const cleanupSummary = this.storageMaintenance.run();
      if (cleanupSummary.deletedFiles > 0) {
        logger.info(`[VideoHandler] Cleanup completed: deleted ${cleanupSummary.deletedFiles} files and freed ${VideoHandlerHelpers.formatMegabytes(cleanupSummary.freedBytes)} MB.`);
      }
    } catch (error: unknown) {logger.warn(`[VideoHandler] Automatic cleanup failed: ${error}`);
    }
  }

  public containsSupportedVideoUrl(text: string): boolean {
    return VideoHandlerHelpers.extractFirstSupportedVideoUrl(text) !== null;
  }

  public async prepareFromText(text: string): Promise<PreparedVideoInput | null> {
    const videoUrl = VideoHandlerHelpers.extractFirstSupportedVideoUrl(text);
    if (!videoUrl) {
      return null;
    }

    const requestInstruction = VideoHandlerHelpers.extractInstructionFromText(text, videoUrl);
    const processed = VideoHandlerHelpers.isYouTubeUrl(videoUrl)
      ? await this.processYouTubeVideo(videoUrl)
      : await this.processRemoteVideo(videoUrl);

    return {
      messageText: VideoHandlerHelpers.buildPreparedMessage(processed, requestInstruction),
      inlineData: processed.inlineData,
    };
  }

  public async prepareFromTelegramVideo(
    ctx: Context,
    descriptor: TelegramVideoDescriptor,
  ): Promise<PreparedVideoInput> {
    const downloaded = await VideoHandlerHelpers.downloadTelegramFile(
      ctx,
      descriptor.fileId,
      descriptor.fileName,
      descriptor.mimeType,
    );

    try {
      const processed = await this.processLocalVideoFile(downloaded.filePath, downloaded.mimeType, {
        title: downloaded.fileName,
        sourceLabel: 'Telegram video upload',
        width: descriptor.width,
        height: descriptor.height,
        durationSeconds: descriptor.durationSeconds,
        fileSizeBytes: downloaded.fileSizeBytes,
      });

      return {
        messageText: VideoHandlerHelpers.buildPreparedMessage(
          processed,
          descriptor.caption || 'Summarize this video and then be available to discuss it based on the extracted content.',
        ),
        inlineData: processed.inlineData,
      };
    } finally {
      VideoHandlerHelpers.cleanup(downloaded.filePath);
    }
  }

  public isVideoDocument(fileName: string, mimeType: string): boolean {
    return mimeType.startsWith('video/') || SUPPORTED_VIDEO_EXTENSIONS.has(path.extname(fileName).toLowerCase());
  }

  private async processYouTubeVideo(videoUrl: string): Promise<ProcessedVideoContext> {
    const videoId = VideoHandlerHelpers.extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Could not identify the YouTube video ID.');
    }

    const watchHtml = await VideoHandlerHelpers.fetchText(`https://www.youtube.com/watch...v=${videoId}&hl=en-US&persist_hl=1`);
    const playerResponse = VideoHandlerHelpers.extractYouTubePlayerResponse(watchHtml) as YouTubePlayerResponse | null;
    const oEmbed = await VideoHandlerHelpers.fetchYouTubeOEmbed(videoUrl);

    const videoDetails = playerResponse?.videoDetails ?? {};
    const title = VideoHandlerHelpers.firstNonEmptyString(videoDetails.title, oEmbed?.title) || `Video ${videoId}`;
    const author = VideoHandlerHelpers.firstNonEmptyString(videoDetails.author, oEmbed?.author_name);
    const description = VideoHandlerHelpers.firstNonEmptyString(videoDetails.shortDescription);
    const durationSeconds = VideoHandlerHelpers.parseOptionalInt(videoDetails.lengthSeconds);
    const warnings: string[] = [];

    let transcript = '';
    let transcriptSource = 'youtube-metadata';

    if (!durationSeconds || durationSeconds <= MAX_NATIVE_YOUTUBE_GEMINI_DURATION_SECONDS) {
      const geminiAnalysis = await this.transcriptionPipeline.tryGeminiYouTube(videoUrl, title);
      if (geminiAnalysis) {
        transcript = geminiAnalysis.analysisText;
        transcriptSource = geminiAnalysis.source;
        warnings.push(...geminiAnalysis.warnings);
      }
    } else {
      warnings.push(`Skipped native Gemini URL analysis because the video is ${VideoHandlerHelpers.formatDuration(durationSeconds)} and this path tends to fail for very long videos.`);
    }

    if (!transcript) {
      const selectedTrack = VideoHandlerHelpers.chooseYouTubeCaptionTrack(
        playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [],
      );

      if (selectedTrack) {
        transcript = await VideoHandlerHelpers.fetchYouTubeTranscript(selectedTrack.baseUrl);
        transcriptSource = `YouTube captions (${selectedTrack.languageCode || 'no language specified'})`;
      } else {
        warnings.push('Could not find a public caption or transcript for this YouTube video.');
      }
    }

    if (!transcript) {
      if (!this.ytDlpFallback.isAvailable()) {
        const availabilityWarning = this.ytDlpFallback.getAvailabilityWarning();
        if (availabilityWarning) {
          warnings.push(availabilityWarning);
        }
      } else {
        const ytDlpCaptions = await this.ytDlpTranscriptSupport.tryCaptions(videoUrl);
        if (ytDlpCaptions) {
          warnings.push(...ytDlpCaptions.warnings);
          if (ytDlpCaptions.transcript) {
            transcript = ytDlpCaptions.transcript;
            transcriptSource = ytDlpCaptions.source;
          }
        }
      }
    }

    if (!transcript && this.ytDlpFallback.isAvailable()) {
      const ytDlpTranscript = await this.ytDlpTranscriptSupport.tryTranscript(videoUrl);
      if (ytDlpTranscript) {
        transcript = ytDlpTranscript.transcript;
        transcriptSource = ytDlpTranscript.source;
        warnings.push(...ytDlpTranscript.warnings);
      }
    }

    if (!transcript && description) {
      transcript = `Video description:\n${description}`;
      transcriptSource = 'video description';
      warnings.push('Used only the video description as fallback because there was no public caption and no additional extractor succeeded.');
    }

    if (!transcript) {
      warnings.push('Could not obtain reliable text content from this video.');
    }

    const inlineData = await VideoHandlerHelpers.fetchThumbnailInlineData(videoId);
    const metadata: VideoMetadata = {
      title,
      sourceLabel: 'YouTube',
      sourceUrl: videoUrl,
      author,
      description,
      durationSeconds,
    };

    const contextFilePath = VideoHandlerHelpers.writeContextFile(
      metadata,
      transcript,
      transcriptSource,
      warnings,
      this.videoContextDir,
    );

    return {
      metadata,
      transcript,
      transcriptSource,
      warnings,
      contextFilePath,
      inlineData,
    };
  }

  private async processRemoteVideo(videoUrl: string): Promise<ProcessedVideoContext> {
    const downloaded = await VideoHandlerHelpers.downloadRemoteVideo(videoUrl);

    try {
      return await this.processLocalVideoFile(downloaded.filePath, downloaded.mimeType, {
        title: downloaded.fileName,
        sourceLabel: 'Direct video URL',
        sourceUrl: videoUrl,
        fileSizeBytes: downloaded.fileSizeBytes,
      });
    } finally {
      VideoHandlerHelpers.cleanup(downloaded.filePath);
    }
  }

  private async processLocalVideoFile(
    filePath: string,
    mimeType: string,
    metadataInput: Partial<VideoMetadata>,
  ): Promise<ProcessedVideoContext> {
    const stats = fs.statSync(filePath);
    const warnings: string[] = [];

    let transcript = '';
    let transcriptSource = 'no transcription';

    const geminiAnalysis = await this.transcriptionPipeline.tryGeminiLocalVideo(
      filePath,
      mimeType,
      metadataInput.title,
    );
    if (geminiAnalysis) {
      transcript = geminiAnalysis.analysisText;
      transcriptSource = geminiAnalysis.source;
      warnings.push(...geminiAnalysis.warnings);
    }

    if (!transcript && stats.size <= MAX_TRANSCRIPTION_BYTES) {
      try {
        transcript = await this.transcriptionPipeline.transcribeWithRetries(filePath, {
          prompt: 'Transcribe the spoken content of the video with punctuation and proper names when possible.',
        });
        transcriptSource = 'OpenAI transcription';
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const errorMessage = error instanceof Error ? err.message : String(error);
        warnings.push(`Could not transcribe the video audio: ${errorMessage}`);
      }
    } else if (!transcript) {
      warnings.push(`The video is ${VideoHandlerHelpers.formatMegabytes(stats.size)} MB and exceeds the ${VideoHandlerHelpers.formatMegabytes(MAX_TRANSCRIPTION_BYTES)} MB limit for traditional automatic transcription.`);
    }

    if (!transcript) {
      const chunkedTranscript = await this.transcriptionPipeline.tryChunkedMediaTranscript(
        filePath,
        metadataInput.title,
      );
      if (chunkedTranscript) {
        warnings.push(...chunkedTranscript.warnings);
        if (chunkedTranscript.transcript) {
          transcript = chunkedTranscript.transcript;
          transcriptSource = chunkedTranscript.source;
        }
      }
    }

    if (!transcript) {
      const dedicatedGeminiTranscript = await this.transcriptionPipeline.tryDedicatedGeminiFallbackTranscript(
        filePath,
        metadataInput.title,
      );
      if (dedicatedGeminiTranscript) {
        warnings.push(...dedicatedGeminiTranscript.warnings);
        if (dedicatedGeminiTranscript.transcript) {
          transcript = dedicatedGeminiTranscript.transcript;
          transcriptSource = dedicatedGeminiTranscript.source;
        }
      }
    }

    const inlineData = await VideoHandlerHelpers.buildInlineData(filePath, mimeType, stats.size);
    if (!inlineData && !transcript) {
      warnings.push('Could not extract transcription or attach an inline version of the video for direct analysis.');
    }

    const metadata: VideoMetadata = {
      title: metadataInput.title || path.basename(filePath),
      sourceLabel: metadataInput.sourceLabel || 'Video',
      sourceUrl: metadataInput.sourceUrl,
      author: metadataInput.author,
      description: metadataInput.description,
      durationSeconds: metadataInput.durationSeconds,
      width: metadataInput.width,
      height: metadataInput.height,
      fileSizeBytes: metadataInput.fileSizeBytes ?? stats.size,
    };

    const contextFilePath = VideoHandlerHelpers.writeContextFile(
      metadata,
      transcript,
      transcriptSource,
      warnings,
      this.videoContextDir,
    );

    return {
      metadata,
      transcript,
      transcriptSource,
      warnings,
      contextFilePath,
      inlineData,
    };
  }

  private parseJsonPayload(raw: string, sourceLabel: string): unknown {
    return VideoHandlerHelpers.parseJsonPayload(raw, sourceLabel);
  }

  private extractYouTubePlayerResponse(html: string): unknown {
    return VideoHandlerHelpers.extractYouTubePlayerResponse(html);
  }
}
