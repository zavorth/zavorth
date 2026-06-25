import { logger } from '../../../../logger.js';
import { config } from '../../../../config/index.js';
import { AudioHandler } from '../../../../gateways/channels/telegram/AudioHandler.js';
import { AudioChunker, type PreparedAudioChunk } from '../../../../gateways/channels/telegram/AudioChunker.js';
import { GeminiVideoAnalyzer, type GeminiVideoAnalysis } from '../../../../gateways/channels/telegram/GeminiVideoAnalyzer.js';
import { VideoHandlerUrlSupport } from '../../../../gateways/channels/telegram/video-handler/VideoHandlerUrlSupport.js';
import { VideoHandlerFormatSupport } from '../../../../gateways/channels/telegram/video-handler/VideoHandlerFormatSupport.js';

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
  geminiVideoAnalyzer: GeminiVideoAnalyzer;
  geminiTranscriptionFallbackAnalyzer: GeminiVideoAnalyzer;
};

export class VideoTranscriptionPipeline {
  public constructor(private readonly deps: VideoTranscriptionPipelineDeps) {}

  public async tryGeminiYouTube(videoUrl: string, title: string): Promise<GeminiVideoAnalysis | null> {
    if (!this.deps.geminiVideoAnalyzer.isEnabled()) {
      return null;
    }

    try {
      return await this.deps.geminiVideoAnalyzer.analyzeYouTubeUrl(videoUrl, title);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[VideoHandler] Gemini YouTube falhou: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini indisponivel',
        warnings: [`A analise nativa do Gemini para este link falhou: ${errorMessage}`],
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[VideoHandler] Gemini local video falhou: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini indisponivel',
        warnings: [`A analise nativa do Gemini para este arquivo falhou: ${errorMessage}`],
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[VideoHandler] Gemini local audio falhou: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini indisponivel',
        warnings: [`O fallback de audio com Gemini falhou: ${errorMessage}`],
      };
    }
  }

  public async tryChunkedMediaTranscript(filePath: string, titleHint?: string): Promise<VideoTranscriptResult | null> {
    if (!this.deps.audioChunker.isAvailable()) {
      return {
        transcript: '',
        source: 'chunking nao provisionado',
        warnings: [VideoHandlerUrlSupport.buildMediaCapabilityWarning('A trilha de segmentacao em chunks ainda nao foi provisionada neste host.')],
      };
    }

    let preparedAudioPath: string | undefined;
    let chunkPaths: string[] = [];

    try {
      const prepared = await this.deps.audioChunker.prepareChunks(filePath, AUDIO_CHUNK_SECONDS);
      preparedAudioPath = prepared.normalizedAudioPath;
      chunkPaths = prepared.chunks.map((chunk) => chunk.filePath);
      return await this.buildChunkedTranscriptFromPreparedChunks(prepared.chunks, titleHint);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        transcript: '',
        source: 'chunking indisponivel',
        warnings: [`Nao consegui segmentar o audio do arquivo em chunks: ${errorMessage}`],
      };
    } finally {
      this.deps.audioChunker.cleanupPaths([preparedAudioPath, ...chunkPaths]);
    }
  }

  public async tryChunkedAudioTranscript(audioPath: string, titleHint?: string): Promise<VideoTranscriptResult | null> {
    if (!this.deps.audioChunker.isAvailable()) {
      return {
        transcript: '',
        source: 'chunking nao provisionado',
        warnings: [VideoHandlerUrlSupport.buildMediaCapabilityWarning('A trilha de segmentacao em chunks ainda nao foi provisionada neste host.')],
      };
    }

    let preparedAudioPath: string | undefined;
    let chunkPaths: string[] = [];

    try {
      const prepared = await this.deps.audioChunker.prepareChunks(audioPath, AUDIO_CHUNK_SECONDS);
      preparedAudioPath = prepared.normalizedAudioPath;
      chunkPaths = prepared.chunks.map((chunk) => chunk.filePath);
      return await this.buildChunkedTranscriptFromPreparedChunks(prepared.chunks, titleHint);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        transcript: '',
        source: 'chunking indisponivel',
        warnings: [`Nao consegui processar o audio extraido em chunks: ${errorMessage}`],
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

      const warnings: string[] = ['Ativei o fallback final de transcricao pura via Gemini com a chave dedicada.'];
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
          source: `transcricao pura via Gemini fallback (${config.geminiTranscriptionModel})`,
          warnings,
        };
      }

      return {
        transcript: transcripts.join('\n\n'),
        source: `transcricao pura via Gemini fallback (${config.geminiTranscriptionModel})`,
        warnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        transcript: '',
        source: `transcricao pura via Gemini fallback (${config.geminiTranscriptionModel})`,
        warnings: [`O fallback final de transcricao pura via Gemini falhou: ${errorMessage}`],
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
      } catch (error) {
        lastError = error;
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[VideoHandler] Gemini transcription fallback falhou: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini transcription fallback indisponivel',
        warnings: [`A transcricao pura via Gemini fallback falhou: ${errorMessage}`],
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
    const label = `Trecho ${chunk.index + 1} (${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.startSeconds)}-${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.endSeconds)})`;
    const warnings: string[] = [];

    const chunkTranscript = await this.tryDedicatedGeminiPureTranscription(
      chunk.filePath,
      VideoHandlerFormatSupport.guessMimeTypeFromPath(chunk.filePath),
      `${titleHint || 'media'} - ${label}`,
    );

    if (chunkTranscript?.analysisText) {
      warnings.push(...chunkTranscript.warnings.map((warning) => `${label}: ${warning}`));
      return {
        label,
        text: chunkTranscript.analysisText,
        warnings,
      };
    }

    warnings.push(`${label}: a transcricao pura via Gemini fallback nao retornou texto util.`);
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
      warnings.push(`O audio foi dividido em ${chunks.length} trechos longos; priorizei Gemini nesses trechos para ganhar robustez em conteudos extensos.`);
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
      detailedChunkReports.push(`## ${result.label}\nFonte: ${result.source}\n\n${result.text}`);
    }

    if (sectionTexts.length === 0) {
      return {
        transcript: '',
        source: 'audio segmentado sem conteudo util',
        warnings,
      };
    }

    let summaryText = '';
    const summary = await this.tryGeminiSectionSummary(sectionTexts, titleHint);
    if (summary?.analysisText) {
      summaryText = summary.analysisText;
      warnings.push(...summary.warnings);
    }

    const transcript = summaryText
      ? `${summaryText}\n\n## Cobertura detalhada por trechos\n\n${detailedChunkReports.join('\n\n')}`
      : detailedChunkReports.join('\n\n');

    return {
      transcript,
      source: `audio segmentado em ${sectionTexts.length} trechos`,
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
    const label = `Trecho ${chunk.index + 1} (${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.startSeconds)}-${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.endSeconds)})`;
    const chunkPrompt = `Transcreva o conteudo falado deste trecho com boa pontuacao. Preserve nomes proprios, termos tecnicos, numeros e referencias importantes. Faixa aproximada do trecho: ${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.startSeconds)} a ${VideoHandlerFormatSupport.formatSecondsAsClock(chunk.endSeconds)}.`;
    const warnings: string[] = [];
    let chunkText = '';
    let chunkSource = '';

    if (!preferGeminiFirst) {
      try {
        chunkText = await this.transcribeWithRetries(chunk.filePath, {
          prompt: chunkPrompt,
        }, 1);
        chunkSource = 'OpenAI transcription';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`${label}: a transcricao OpenAI falhou (${errorMessage}).`);
      }
    }

    if (!chunkText) {
      const geminiChunk = await this.tryGeminiLocalAudio(
        chunk.filePath,
        VideoHandlerFormatSupport.guessMimeTypeFromPath(chunk.filePath),
        `${titleHint || 'audio'} - ${label}`,
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`${label}: a transcricao OpenAI de apoio falhou (${errorMessage}).`);
      }
    }

    if (!chunkText) {
      warnings.push(`${label}: nao consegui obter conteudo textual utilizavel desse trecho.`);
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[VideoHandler] Gemini section summary falhou: ${errorMessage}`);
      return {
        analysisText: '',
        source: 'Gemini indisponivel',
        warnings: [`A sintese final dos trechos falhou: ${errorMessage}`],
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
      while (true) {
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
