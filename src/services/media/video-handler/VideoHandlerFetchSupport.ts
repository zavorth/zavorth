import fs from "fs";
import path from "path";
import type { Context } from "grammy";
import { config } from "../../../config/index.js";
import type { InlineData } from "../../../providers/ILlmProvider.js";
import { safeFetch } from "../../../security/SafeFetchService.js";
import { safeParseInt } from '../../../ai-gateway/shared/utils/safeParseInt.js';
import {
  DEFAULT_HEADERS,
  FETCH_TIMEOUT_MS,
  MAX_INLINE_MEDIA_BYTES,
  MAX_REMOTE_DOWNLOAD_BYTES,
  SUPPORTED_VIDEO_EXTENSIONS,
  type DownloadedFile,
} from "./VideoHandlerTypes.js";
import { VideoHandlerFormatSupport } from "./VideoHandlerFormatSupport.js";

import { logger } from '../../../logger';
import { asErrorLike } from '../../../utils/errorLike.js';

export class VideoHandlerFetchSupport {
  public static async fetchThumbnailInlineData(
    videoId: string,
  ): Promise<InlineData[] | undefined> {
    try {
      const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const response = await this.fetchWithTimeout(thumbnailUrl);
      if (!response.ok) {
        return undefined;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_INLINE_MEDIA_BYTES) {
        return undefined;
      }

      return [{ mimeType: "image/jpeg", data: buffer.toString("base64") }];
    } catch (error: unknown) {logger.warn('[Video] network request failed', error); return undefined; }
  }

  public static async buildInlineData(
    filePath: string,
    mimeType: string,
    fileSizeBytes: number,
  ): Promise<InlineData[] | undefined> {
    if (fileSizeBytes <= 0 || fileSizeBytes > MAX_INLINE_MEDIA_BYTES) {
      return undefined;
    }

    const normalizedMimeType =
      mimeType || VideoHandlerFormatSupport.guessMimeTypeFromPath(filePath);
    if (
      !normalizedMimeType.startsWith("video/") &&
      !normalizedMimeType.startsWith("image/")
    ) {
      return undefined;
    }

    const buffer = fs.readFileSync(filePath);
    return [{ mimeType: normalizedMimeType, data: buffer.toString("base64") }];
  }

  public static async downloadTelegramFile(
    ctx: Context,
    fileId: string,
    fileName?: string,
    mimeType?: string,
  ): Promise<DownloadedFile> {
    const fileInfo = await ctx.api.getFile(fileId);
    if (!fileInfo.file_path) {
      throw new Error("Telegram did not return a path for the video.");
    }

    const inferredName = fileName || path.basename(fileInfo.file_path);
    const inferredMimeType =
      mimeType || VideoHandlerFormatSupport.guessMimeTypeFromPath(inferredName);
    const extension =
      path.extname(inferredName) ||
      VideoHandlerFormatSupport.extensionFromMimeType(inferredMimeType) ||
      ".mp4";
    const outputPath = path.join(
      config.tmpDir,
      `video_${Date.now()}${extension}`,
    );
    const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
    const response = await this.fetchWithTimeout(fileUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to baixar o video do Telegram (${response.status}).`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    return {
      filePath: outputPath,
      fileName: inferredName,
      mimeType: inferredMimeType,
      fileSizeBytes: buffer.length,
    };
  }

  public static async downloadRemoteVideo(
    videoUrl: string,
  ): Promise<DownloadedFile> {
    const response = await this.fetchWithTimeout(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download remote video (${response.status}).`);
    }

    const contentType = response.headers.get("content-type") || "";
    const fileName = VideoHandlerFormatSupport.fileNameFromUrl(videoUrl);
    const extension =
      path.extname(fileName) ||
      VideoHandlerFormatSupport.extensionFromMimeType(contentType) ||
      ".mp4";

    if (
      !contentType.startsWith("video/") &&
      !SUPPORTED_VIDEO_EXTENSIONS.has(extension.toLowerCase())
    ) {
      throw new Error(
        "The provided URL does not appear to point to a supported video file.",
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = safeParseInt(contentLengthHeader, 0);
      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_REMOTE_DOWNLOAD_BYTES
      ) {
        throw new Error(
          `Remote video exceeds the limit of ${VideoHandlerFormatSupport.formatMegabytes(MAX_REMOTE_DOWNLOAD_BYTES)} MB for automatic download.`,
        );
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_REMOTE_DOWNLOAD_BYTES) {
      throw new Error(
        `Remote video exceeds the limit of ${VideoHandlerFormatSupport.formatMegabytes(MAX_REMOTE_DOWNLOAD_BYTES)} MB for automatic processing.`,
      );
    }

    const outputPath = path.join(
      config.tmpDir,
      `remote_video_${Date.now()}${extension}`,
    );
    fs.writeFileSync(outputPath, buffer);

    return {
      filePath: outputPath,
      fileName,
      mimeType:
        contentType ||
        VideoHandlerFormatSupport.guessMimeTypeFromPath(fileName),
      fileSizeBytes: buffer.length,
    };
  }

  public static async fetchJson(url: string): Promise<unknown> {
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON (${response.status}).`);
    }
    const raw = await response.text();
    return this.parseJsonPayload(raw, url);
  }

  public static async fetchText(url: string): Promise<string> {
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch text (${response.status}).`);
    }
    return response.text();
  }

  public static async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      return await safeFetch(url, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
      }, {
        serviceName: "Video handler fetch",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  public static parseJsonPayload(raw: string, sourceLabel: string): unknown {
    const sanitized = String(raw || "")
      .replace(/^\uFEFF/, "")
      .replace(/^\)\]\}'\s*/, "")
      .trim();

    try {
      return JSON.parse(sanitized);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      const preview = sanitized.slice(0, 180).replace(/\s+/g, " ");
      throw new Error(
        `Failed to interpretar JSON de ${sourceLabel}: ${message}. Preview: ${preview}`,
      );
    }
  }
}
