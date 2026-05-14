import fs from 'fs';
import path from 'path';
import { Context } from 'grammy';
import { config } from '../config/index.js';
import { InlineData } from '../providers/ILlmProvider.js';
import { AudioHandler } from './AudioHandler.js';
import { AudioChunker } from './AudioChunker.js';
import { GeminiVideoAnalyzer } from './GeminiVideoAnalyzer.js';
import { StorageMaintenance } from './StorageMaintenance.js';
import { YtDlpFallback } from './YtDlpFallback.js';
import {
  VideoHandlerHelpers,
  type ProcessedVideoContext,
  type TelegramVideoDescriptor,
  type VideoMetadata,
} from './video-handler/VideoHandlerHelpers.js';
import {
  MAX_TRANSCRIPTION_BYTES,
  VideoTranscriptionPipeline,
} from './video-handler/VideoTranscriptionPipeline.js';
import { VideoYtDlpTranscriptSupport } from './video-handler/VideoYtDlpTranscriptSupport.js';

const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv']);
const MAX_NATIVE_YOUTUBE_GEMINI_DURATION_SECONDS = 30 * 60;

export interface PreparedVideoInput {
  messageText: string;
  inlineData?: InlineData[];
}

export class VideoHandler {
  private audioHandler: AudioHandler;
  private audioChunker: AudioChunker;
  private videoContextDir: string;
  private geminiVideoAnalyzer: GeminiVideoAnalyzer;
  private geminiTranscriptionFallbackAnalyzer: GeminiVideoAnalyzer;
  private storageMaintenance: StorageMaintenance;
  private ytDlpFallback: YtDlpFallback;
  private transcriptionPipeline: VideoTranscriptionPipeline;
  private ytDlpTranscriptSupport: VideoYtDlpTranscriptSupport;

  constructor() {
    this.audioHandler = new AudioHandler();
    this.audioChunker = new AudioChunker();
    this.videoContextDir = path.join(config.dataDir, 'video-contexts');
    this.geminiVideoAnalyzer = new GeminiVideoAnalyzer();
    this.geminiTranscriptionFallbackAnalyzer = new GeminiVideoAnalyzer({
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
        console.log(`[VideoHandler] Limpeza automatica concluiu ${cleanupSummary.deletedFiles} arquivos e liberou ${VideoHandlerHelpers.formatMegabytes(cleanupSummary.freedBytes)} MB.`);
      }
    } catch (error) {
      console.warn(`[VideoHandler] A limpeza automatica falhou: ${error}`);
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
        sourceLabel: 'Upload de video no Telegram',
        width: descriptor.width,
        height: descriptor.height,
        durationSeconds: descriptor.durationSeconds,
        fileSizeBytes: downloaded.fileSizeBytes,
      });

      return {
        messageText: VideoHandlerHelpers.buildPreparedMessage(
          processed,
          descriptor.caption || 'Resuma este video e depois fique disponivel para conversar sobre ele com base no conteudo extraido.',
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
      throw new Error('Nao consegui identificar o ID do video do YouTube.');
    }

    const watchHtml = await VideoHandlerHelpers.fetchText(`https://www.youtube.com/watch?v=${videoId}&hl=en-US&persist_hl=1`);
    const playerResponse = VideoHandlerHelpers.extractYouTubePlayerResponse(watchHtml);
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
      warnings.push(`Pulei a analise nativa do Gemini por URL porque o video tem ${VideoHandlerHelpers.formatDuration(durationSeconds)} e esse caminho tende a falhar em videos muito longos.`);
    }

    if (!transcript) {
      const selectedTrack = VideoHandlerHelpers.chooseYouTubeCaptionTrack(
        playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [],
      );

      if (selectedTrack) {
        transcript = await VideoHandlerHelpers.fetchYouTubeTranscript(selectedTrack.baseUrl);
        transcriptSource = `legendas do YouTube (${selectedTrack.languageCode || 'sem idioma informado'})`;
      } else {
        warnings.push('Nao encontrei legenda/transcricao publica neste video do YouTube.');
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
      transcript = `Descricao do video:\n${description}`;
      transcriptSource = 'descricao do video';
      warnings.push('Usei apenas a descricao do video como fallback porque nao havia legenda publica e nenhum extrator adicional teve sucesso.');
    }

    if (!transcript) {
      warnings.push('Nao consegui obter um conteudo textual confiavel deste video.');
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
        sourceLabel: 'URL direta de video',
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
    let transcriptSource = 'sem transcricao';

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
          prompt: 'Transcreva o conteudo falado do video com pontuacao e nomes proprios quando possivel.',
        });
        transcriptSource = 'OpenAI transcription';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`Nao consegui transcrever o audio do video: ${errorMessage}`);
      }
    } else if (!transcript) {
      warnings.push(`O video tem ${VideoHandlerHelpers.formatMegabytes(stats.size)} MB e excede o limite de ${VideoHandlerHelpers.formatMegabytes(MAX_TRANSCRIPTION_BYTES)} MB para transcricao automatica tradicional.`);
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
      warnings.push('Nao consegui extrair transcricao nem anexar uma versao inline do video para analise direta.');
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
