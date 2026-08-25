import { logger } from '../../../../logger.js';
import { config } from '../../../../config/index.js';
import { AudioHandler } from '../../../../gateways/channels/telegram/AudioHandler.js';
import { AudioChunker, type PreparedAudioChunk } from '../../../../gateways/channels/telegram/AudioChunker.js';
import { GeminiVideoService, type GeminiVideoAnalysis } from '../../../../providers/GeminiVideoService.js';
import { VideoHandlerUrlSupport } from '../../../../gateways/channels/telegram/video-handler/VideoHandlerUrlSupport.js';
import { VideoHandlerFormatSupport } from '../../../../gateways/channels/telegram/video-handler/VideoHandlerFormatSupport.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

export const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;
const AUDIO_CHUNK_SECONDS = 20 * 60;
const TRANSCRIPTION_ATTEMPTS = 2;

export type VideoTranscriptResult = {
  transcript: string;
  source: string;
  warnings: string[];
};

export type VideoTranscriptionPipelineDeps = {
  audioHandler: AudioHandler;
  audioChunker: AudioChunker;
  geminiVideoAnalyzer: GeminiVideoService;
  geminiTranscriptionFallbackAnalyzer: GeminiVideoService;
};

export class VideoTranscriptionPipeline {
  public constructor(private readonly deps: VideoTranscriptionPipelineDeps) {}

  public async tryGeminiYouTube(videoUrl: string, title: string): Promise<GeminiVideoAnalysis | null> {
    if (!this.deps.geminiVideoAnalyzer.isEnabled()) {
      return null;
    }

    try {
      return await this.deps.geminiVideoAnalyzer.analyzeYouTubeUrl(videoUrl, title);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      logger.warn(`[VideoHandler] Gemini YouTube failed: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini unavailable',
        warnings: [`Gemini native analysis for this link failed: ${errorMessage}`],
      };
    }
  }

  public async tryGeminiLocalVideo(
    filePath: string,
    mimeType: string,
    titleHint?: string,
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.deps.geminiVideoAnalyzer.isEnabled()) {
      return null;
    }

    try {
      return await this.deps.geminiVideoAnalyzer.analyzeLocalVideo(filePath, mimeType, titleHint);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      logger.warn(`[VideoHandler] Gemini local video failed: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini unavailable',
        warnings: [`The configured native video analysis provider could not process this file: ${errorMessage}`],
      };
    }
  }

  public async tryGeminiLocalAudio(
    filePath: string,
    mimeType: string,
    titleHint?: string,
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.deps.geminiVideoAnalyzer.isEnabled()) {
      return null;
    }

    try {
      return await this.deps.geminiVideoAnalyzer.analyzeLocalAudio(filePath, mimeType, titleHint);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      logger.warn(`[VideoHandler] Gemini local audio failed: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini unavailable',
        warnings: [`The Gemini audio fallback failed: ${errorMessage}`],
      };
    }
  }

  public async tryChunkedMediaTranscript(filePath: string, titleHint?: string): Promise<VideoTranscriptResult | null> {
    if (!this.deps.audioChunker.isAvailable()) {
      return {
        transcript: '',
        source: 'chunking not provisioned',
        warnings: [VideoHandlerUrlSupport.buildMediaCapabilityWarning('The chunked segmentation track is still not provisioned on this host.')],
      };
    }

    let preparedAudioPath: string | undefined;
    let chunkPaths: string[] = [];

    try {
      const prepared = await this.deps.audioChunker.prepareChunks(filePath, AUDIO_CHUNK_SECONDS);
      preparedAudioPath = prepared.normalizedAudioPath;
      chunkPaths = prepared.chunks.map((chunk) => chunk.filePath);
      return await this.buildChunkedTranscriptFromPreparedChunks(prepared.chunks, titleHint);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      return {
        transcript: '',
        source: 'chunking unavailable',
        warnings: [`Could not split the file audio into chunks: ${errorMessage}`],
      };
    } finally {
      this.deps.audioChunker.cleanupPaths([preparedAudioPath, ...chunkPaths]);
    }
  }

  public async tryChunkedAudioTranscript(audioPath: string, titleHint?: string): Promise<VideoTranscriptResult | null> {
    if (!this.deps.audioChunker.isAvailable()) {
      return {
        transcript: '',
        source: 'chunking not provisioned',
        warnings: [VideoHandlerUrlSupport.buildMediaCapabilityWarning('The chunked segmentation track is still not provisioned on this host.')],
      };
    }

    let preparedAudioPath: string | undefined;
    let chunkPaths: string[] = [];

    try {
      const prepared = await this.deps.audioChunker.prepareChunks(audioPath, AUDIO_CHUNK_SECONDS);
      preparedAudioPath = prepared.normalizedAudioPath;
      chunkPaths = prepared.chunks.map((chunk) => chunk.filePath);
      return await this.buildChunkedTranscriptFromPreparedChunks(prepared.chunks, titleHint);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      return {
        transcript: '',
        source: 'chunking unavailable',
        warnings: [`Could not process extracted audio in chunks: ${errorMessage}`],
      };
    } finally {
      this.deps.audioChunker.cleanupPaths([preparedAudioPath, ...chunkPaths]);
    }
  }

  public async tryDedicatedGeminiFallbackTranscript(
    filePath: string,
    titleHint?: string,
  ): Promise<VideoTranscriptResult | null> {
    if (!this.deps.geminiTranscriptionFallbackAnalyzer.isEnabled()) {
      return null;
    }

    if (!this.deps.audioChunker.isAvailable()) {
      const directTranscript = await this.tryDedicatedGeminiPureTranscription(
        filePath,
        VideoHandlerFormatSupport.guessMimeTypeFromPath(filePath),
        titleHint,
      );

      if (!directTranscript) {
        return null;
      }

      return {
        transcript: directTranscript.analysisText,
        source: directTranscript.source,
        warnings: directTranscript.warnings,
      };
    }

    let preparedAudioPath: string | undefined;
    let chunkPaths: string[] = [];

    try {
      const prepared = await this.deps.audioChunker.prepareChunks(filePath, AUDIO_CHUNK_SECONDS);
      preparedAudioPath = prepared.normalizedAudioPath;
      chunkPaths = prepared.chunks.map((chunk) => chunk.filePath);

      const warnings: string[] = ['Enabled the final plain transcription fallback via Gemini with the dedicated key.'];
      const chunkResults = await this.mapWithConcurrency(
        prepared.chunks,
        Math.max(1, config.videoChunkConcurrency),
        async (chunk) => this.processDedicatedFallbackChunk(chunk, titleHint),
      );
      const transcripts: string[] = [];

      for (const result of chunkResults) {
        warnings.push(...result.warnings);
        if (result.text) {
          transcripts.push(`## ${result.label}\n\n${result.text}`);
        }
      }

      if (transcripts.length === 0) {
        return {
          transcript: '',
          source: `plain transcription through fallback (${config.geminiTranscriptionModel})`,
          warnings,
        };
      }

      return {
        transcript: transcripts.join('\n\n'),
        source: `plain transcription through fallback (${config.geminiTranscriptionModel})`,
        warnings,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      return {
        transcript: '',
        source: `plain transcription through fallback (${config.geminiTranscriptionModel})`,
        warnings: [`The final plain transcription fallback via Gemini failed: ${errorMessage}`],
      };
    } finally {
      this.deps.audioChunker.cleanupPaths([preparedAudioPath, ...chunkPaths]);
    }
  }

  public async transcribeWithRetries(
    filePath: string,
    options: { language?: string; prompt?: string },
    attempts: number = TRANSCRIPTION_ATTEMPTS,
  ): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.deps.audioHandler.transcribe(filePath, options);
      } catch (error: unknown) {lastError = error;
        if (attempt < attempts) {
          await VideoHandlerFormatSupport.sleep(attempt * 1500);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async tryDedicatedGeminiPureTranscription(
    filePath: string,
    mimeType: string,
    titleHint?: string,
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.deps.geminiTranscriptionFallbackAnalyzer.isEnabled()) {
      return null;
    }

    try {
      return await this.deps.geminiTranscriptionFallbackAnalyzer.transcribeLocalAudio(filePath, mimeType, titleHint);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      logger.warn(`[VideoHandler] Gemini transcription fallback failed: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini transcription fallback unavailable',
        warnings: [`A plain transcription through fallback failed: ${errorMessage}`],
      };
    }
  }

  private async processDedicatedFallbackChunk(
    chunk: PreparedAudioChunk,
    titleHint?: string,
  ): Promise<{
    label: string;
    text: string;
    warnings: string[];
  }> {
    const label = `snippet ${chunk.index + 1} (${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.startSeconds)}-${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.endSeconds)})`;
    const warnings: string[] = [];

    const chunkTranscript = await this.tryDedicatedGeminiPureTranscription(
      chunk.filePath,
      VideoHandlerFormatSupport.guessMimeTypeFromPath(chunk.filePath),
      `${titleHint || 'media'} ? ${label}`,
    );

    if (chunkTranscript?.analysisText) {
      warnings.push(...chunkTranscript.warnings.map((warning) => `${label}: ${warning}`));
      return {
        label,
        text: chunkTranscript.analysisText,
        warnings,
      };
    }

    warnings.push(`${label}: pure Gemini fallback transcription did not return useful text.`);
    return {
      label,
      text: '',
      warnings,
    };
  }

  private async buildChunkedTranscriptFromPreparedChunks(
    chunks: PreparedAudioChunk[],
    titleHint?: string,
  ): Promise<VideoTranscriptResult> {
    const warnings: string[] = [];
    const sectionTexts: Array<{ label: string; text: string }> = [];
    const detailedChunkReports: string[] = [];
    const preferGeminiFirst = chunks.length > 4;

    if (preferGeminiFirst) {
      warnings.push(`The audio was split into ${chunks.length} long sections; Gemini was prioritized for those sections to gain robustness on extensive content.`);
    }

    const chunkResults = await this.mapWithConcurrency(
      chunks,
      Math.max(1, config.videoChunkConcurrency),
      async (chunk) => this.processPrimaryChunk(chunk, titleHint, preferGeminiFirst),
    );

    for (const result of chunkResults) {
      warnings.push(...result.warnings);
      if (!result.text) {
        continue;
      }

      sectionTexts.push({
        label: result.label,
        text: result.text,
      });
      detailedChunkReports.push(`## ${result.label}\nSource: ${result.source}\n\n${result.text}`);
    }

    if (sectionTexts.length === 0) {
      return {
        transcript: '',
        source: 'segmented audio without useful content',
        warnings,
      };
    }

    let summaryText = '';
    const summary = await this.tryGeminiSectionSummary(sectionTexts, titleHint);
    if (summary?.analysisText) {
      summaryText = summary.analysisText;
      warnings.push(...summary.warnings);
    }

    const transcript = summaryText ? `${summaryText}\n\n## Detailed segment coverage\n\n${detailedChunkReports.join('\n\n')}`
      : detailedChunkReports.join('\n\n');

    return {
      transcript,
      source: `audio segmented into ${sectionTexts.length} sections`,
      warnings,
    };
  }

  private async processPrimaryChunk(
    chunk: PreparedAudioChunk,
    titleHint: string | undefined,
    preferGeminiFirst: boolean,
  ): Promise<{
    label: string;
    text: string;
    source: string;
    warnings: string[];
  }> {
    const label = `Section ${chunk.index + 1} (${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.startSeconds)}-${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.endSeconds)})`;
    const chunkPrompt = `Transcribe the spoken content of this section with good punctuation. Preserve proper names, technical terms, numbers, and important references. Approximate section range: ${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.startSeconds)} to ${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.endSeconds)}.`;
    const warnings: string[] = [];
    let chunkText = '';
    let chunkSource = '';

    if (!preferGeminiFirst) {
      try {
        chunkText = await this.transcribeWithRetries(chunk.filePath, {
          prompt: chunkPrompt,
        }, 1);
        chunkSource = 'OpenAI transcription';
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const errorMessage = error instanceof Error ? err.message : String(error);
        warnings.push(`${label}: OpenAI transcription failed (${errorMessage}).`);
      }
    }

    if (!chunkText) {
      const geminiChunk = await this.tryGeminiLocalAudio(
        chunk.filePath,
        VideoHandlerFormatSupport.guessMimeTypeFromPath(chunk.filePath),
        `${titleHint || 'audio'} ? ${label}`,
      );

      if (geminiChunk?.analysisText) {
        chunkText = geminiChunk.analysisText;
        chunkSource = geminiChunk.source;
        warnings.push(...geminiChunk.warnings.map((warning) => `${label}: ${warning}`));
      }
    }

    if (!chunkText && preferGeminiFirst) {
      try {
        chunkText = await this.transcribeWithRetries(chunk.filePath, {
          prompt: chunkPrompt,
        }, 1);
        chunkSource = 'OpenAI transcription';
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const errorMessage = error instanceof Error ? err.message : String(error);
        warnings.push(`${label}: OpenAI transcription support failed (${errorMessage}).`);
      }
    }

    if (!chunkText) {
      warnings.push(`${label}: could not obtain usable text content from this section.`);
    }

    return {
      label,
      text: chunkText,
      source: chunkSource,
      warnings,
    };
  }

  private async tryGeminiSectionSummary(
    sections: Array<{ label: string; text: string }>,
    titleHint?: string,
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.deps.geminiVideoAnalyzer.isEnabled() || sections.length === 0) {
      return null;
    }

    try {
      return await this.deps.geminiVideoAnalyzer.summarizeTextSections(sections, titleHint);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      logger.warn(`[VideoHandler] Gemini section summary failed: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini unavailable',
        warnings: [`The final section synthesis failed: ${errorMessage}`],
      };
    }
  }

  private async mapWithConcurrency<TItem, TResult>(
    items: TItem[],
    concurrency: number,
    mapper: (item: TItem, index: number) => Promise<TResult>,
  ): Promise<TResult[]> {
    const results = new Array<TResult>(items.length);
    let currentIndex = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const index = currentIndex;
        currentIndex += 1;

        if (index >= items.length) {
          return;
        }

        results[index] = await mapper(items[index], index);
      }
    });

    await Promise.all(workers);
    return results;
  }
}
