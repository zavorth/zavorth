import { logger } from '../../../logger.js';
import fs from "fs";
import path from "path";
import { safeParseInt } from '../../../ai-gateway/shared/utils/safeParseInt.js';
export class VideoHandlerFormatSupport {
  public static firstNonEmptyString(
    ...values: Array<string | null | undefined>
  ): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  public static parseOptionalInt(
    value: string | number | undefined,
  ): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = safeParseInt(value, NaN);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  public static fileNameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const candidate = path.basename(parsed.pathname) || "video-remote.mp4";
      return candidate.includes(".") ? candidate : `${candidate}.mp4`;
    } catch (error: unknown) {logger.warn('[Video  Format] parsing failed', error); return "video-remote.mp4"; }
  }

  public static guessMimeTypeFromPath(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
      case ".mp4":
        return "video/mp4";
      case ".mov":
        return "video/quicktime";
      case ".webm":
        return "video/webm";
      case ".m4v":
        return "video/x-m4v";
      case ".mkv":
        return "video/x-matroska";
      case ".mp3":
        return "audio/mpeg";
      case ".m4a":
        return "audio/mp4";
      case ".wav":
        return "audio/wav";
      case ".ogg":
      case ".oga":
        return "audio/ogg";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".png":
        return "image/png";
      default:
        return "application/octet-stream";
    }
  }

  public static extensionFromMimeType(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
      case "video/mp4":
        return ".mp4";
      case "video/webm":
        return ".webm";
      case "video/quicktime":
        return ".mov";
      case "video/x-m4v":
        return ".m4v";
      case "video/x-matroska":
        return ".mkv";
      case "audio/mpeg":
        return ".mp3";
      case "audio/mp4":
        return ".m4a";
      case "audio/wav":
        return ".wav";
      case "audio/ogg":
        return ".ogg";
      default:
        return "";
    }
  }

  public static formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    }

    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  public static formatSecondsAsClock(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  public static formatTimestamp(totalMilliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000));
    return this.formatSecondsAsClock(totalSeconds);
  }

  public static formatMegabytes(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  public static slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "video"
    );
  }

  public static ensureDirectory(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
  }

  public static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error: unknown) {logger.warn(`Failed to remove temporary video file: ${error}`);
    }
  }
}
