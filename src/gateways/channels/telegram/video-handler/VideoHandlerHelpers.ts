import type { Context } from 'grammy';
import type { InlineData } from '../../../../providers/ILlmProvider.js';
import { VideoHandlerContextSupport } from './VideoHandlerContextSupport.js';
import { VideoHandlerFetchSupport } from './VideoHandlerFetchSupport.js';
import { VideoHandlerFormatSupport } from './VideoHandlerFormatSupport.js';
import { VideoHandlerTranscriptSupport } from './VideoHandlerTranscriptSupport.js';
import type {
  DownloadedFile,
  ProcessedVideoContext,
  VideoMetadata,
  YouTubeCaptionTrack,
  YouTubeOEmbedResponse,
} from './VideoHandlerTypes.js';
import { VideoHandlerUrlSupport } from './VideoHandlerUrlSupport.js';

export class VideoHandlerHelpers {
  public static ensureDirectory(directoryPath: string): void {
    VideoHandlerFormatSupport.ensureDirectory(directoryPath);
  }

  public static cleanup(filePath: string): void {
    VideoHandlerFormatSupport.cleanup(filePath);
  }

  public static formatMegabytes(bytes: number): string {
    return VideoHandlerFormatSupport.formatMegabytes(bytes);
  }

  public static formatDuration(totalSeconds: number): string {
    return VideoHandlerFormatSupport.formatDuration(totalSeconds);
  }

  public static firstNonEmptyString(...values: Array<string | null | undefined>): string | undefined {
    return VideoHandlerFormatSupport.firstNonEmptyString(...values);
  }

  public static parseOptionalInt(value: string | number | undefined): number | undefined {
    return VideoHandlerFormatSupport.parseOptionalInt(value);
  }

  public static extractFirstSupportedVideoUrl(text: string): string | null {
    return VideoHandlerUrlSupport.extractFirstSupportedVideoUrl(text);
  }

  public static extractInstructionFromText(text: string, url: string): string {
    return VideoHandlerUrlSupport.extractInstructionFromText(text, url);
  }

  public static isYouTubeUrl(url: string): boolean {
    return VideoHandlerUrlSupport.isYouTubeUrl(url);
  }

  public static extractYouTubeVideoId(url: string): string | null {
    return VideoHandlerUrlSupport.extractYouTubeVideoId(url);
  }

  public static fetchYouTubeOEmbed(videoUrl: string): Promise<YouTubeOEmbedResponse | null> {
    return VideoHandlerUrlSupport.fetchYouTubeOEmbed(videoUrl);
  }

  public static fetchText(url: string): Promise<string> {
    return VideoHandlerFetchSupport.fetchText(url);
  }

  public static parseJsonPayload(raw: string, sourceLabel: string): unknown {
    return VideoHandlerFetchSupport.parseJsonPayload(raw, sourceLabel);
  }

  public static fetchThumbnailInlineData(videoId: string): Promise<InlineData[] | undefined> {
    return VideoHandlerFetchSupport.fetchThumbnailInlineData(videoId);
  }

  public static buildInlineData(
    filePath: string,
    mimeType: string,
    fileSizeBytes: number,
  ): Promise<InlineData[] | undefined> {
    return VideoHandlerFetchSupport.buildInlineData(filePath, mimeType, fileSizeBytes);
  }

  public static downloadTelegramFile(
    ctx: Context,
    fileId: string,
    fileName?: string,
    mimeType?: string,
  ): Promise<DownloadedFile> {
    return VideoHandlerFetchSupport.downloadTelegramFile(ctx, fileId, fileName, mimeType);
  }

  public static downloadRemoteVideo(videoUrl: string): Promise<DownloadedFile> {
    return VideoHandlerFetchSupport.downloadRemoteVideo(videoUrl);
  }

  public static extractYouTubePlayerResponse(html: string): unknown {
    return VideoHandlerTranscriptSupport.extractYouTubePlayerResponse(html);
  }

  public static chooseYouTubeCaptionTrack(tracks: YouTubeCaptionTrack[]): YouTubeCaptionTrack | null {
    return VideoHandlerTranscriptSupport.chooseYouTubeCaptionTrack(tracks);
  }

  public static fetchYouTubeTranscript(baseUrl: string): Promise<string> {
    return VideoHandlerTranscriptSupport.fetchYouTubeTranscript(baseUrl);
  }

  public static buildPreparedMessage(context: ProcessedVideoContext, requestInstruction: string): string {
    return VideoHandlerContextSupport.buildPreparedMessage(context, requestInstruction);
  }

  public static buildTranscriptExcerpt(transcript: string): string {
    return VideoHandlerContextSupport.buildTranscriptExcerpt(transcript);
  }

  public static writeContextFile(
    metadata: VideoMetadata,
    transcript: string,
    transcriptSource: string,
    warnings: string[],
    contextDir: string,
  ): string {
    return VideoHandlerContextSupport.writeContextFile(
      metadata,
      transcript,
      transcriptSource,
      warnings,
      contextDir,
    );
  }
}
