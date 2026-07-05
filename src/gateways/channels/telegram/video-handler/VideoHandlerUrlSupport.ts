import path from "path";

import { buildCapabilityProvisionHint } from "../../../../services/OptionalCapabilityGuard.js";
import {
  DEFAULT_VIDEO_REQUEST,
  SUPPORTED_VIDEO_EXTENSIONS,
  type YouTubeOEmbedResponse,
} from "../../../../gateways/channels/telegram/video-handler/VideoHandlerTypes.js";
import { VideoHandlerFetchSupport } from "../../../../gateways/channels/telegram/video-handler/VideoHandlerFetchSupport.js";
import { logger } from '../../../../logger';

export class VideoHandlerUrlSupport {
  public static extractInstructionFromText(text: string, url: string): string {
    const stripped = text.replace(url, " ").replace(/\s+/g, " ").trim();
    return stripped || DEFAULT_VIDEO_REQUEST;
  }

  public static buildMediaCapabilityWarning(reason: string): string {
    return `${reason} ${buildCapabilityProvisionHint("media")}`.trim();
  }

  public static extractFirstSupportedVideoUrl(text: string): string | null {
    const urls = text.match(/https?:\/\/\S+/gi) || [];

    for (const rawUrl of urls) {
      const sanitized = rawUrl.replace(/[)>.,]+$/, "");
      if (this.isYouTubeUrl(sanitized) || this.isDirectVideoUrl(sanitized)) {
        return sanitized;
      }
    }

    return null;
  }

  public static isYouTubeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host.includes("youtube.com") || host.includes("youtu.be");
    } catch (error) { logger.warn('[Video  Url] parsing failed', error); return false; }
  }

  public static isDirectVideoUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return SUPPORTED_VIDEO_EXTENSIONS.has(
        path.extname(parsed.pathname).toLowerCase(),
      );
    } catch (error) { logger.warn('[Video  Url] parsing failed', error); return false; }
  }

  public static extractYouTubeVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes("youtu.be")) {
        return parsed.pathname.split("/").filter(Boolean)[0] || null;
      }

      if (parsed.searchParams.get("v")) {
        return parsed.searchParams.get("v");
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        parts[0] === "shorts" ||
        parts[0] === "embed" ||
        parts[0] === "live"
      ) {
        return parts[1] || null;
      }

      return null;
    } catch (error) { logger.warn('[Video  Url] parsing failed', error); return null; }
  }

  public static async fetchYouTubeOEmbed(
    videoUrl: string,
  ): Promise<YouTubeOEmbedResponse | null> {
    try {
      const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
      const response = await VideoHandlerFetchSupport.fetchJson(endpoint);
      return typeof response === "object" && response !== null
        ? (response as YouTubeOEmbedResponse)
        : null;
    } catch (error) { logger.warn('[Video  Url] network request failed', error); return null; }
  }
}
