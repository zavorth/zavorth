import type { InlineData } from "../../providers/ILlmProvider.js";

export const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".m4v",
  ".mkv",
]);
export const MAX_INLINE_MEDIA_BYTES = 15 * 1024 * 1024;
export const MAX_REMOTE_DOWNLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_TRANSCRIPT_EXCERPT_CHARS = 9000;
export const FETCH_TIMEOUT_MS = 20000;
export const DEFAULT_VIDEO_REQUEST =
  "Resuma este video e depois fique disponivel para conversar sobre ele com base no conteudo extraido.";
export const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,pt;q=0.9,en;q=0.8",
};
export const PREFERRED_CAPTION_LANGUAGES = ["en-US", "pt", "en", "en-US"];

export interface VideoMetadata {
  title: string;
  sourceLabel: string;
  sourceUrl?: string;
  author?: string;
  description?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
}

export interface ProcessedVideoContext {
  metadata: VideoMetadata;
  transcript: string;
  transcriptSource: string;
  warnings: string[];
  contextFilePath: string;
  inlineData?: InlineData[];
}

export interface TelegramVideoDescriptor {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface DownloadedFile {
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface YouTubeCaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: {
    simpleText?: string;
    runs?: Array<{ text: string }>;
  };
  vssId?: string;
  isTranslatable?: boolean;
}

export interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
}
