import fs from "fs";
import path from "path";
import { VideoHandlerFormatSupport } from "../../../../gateways/channels/telegram/video-handler/VideoHandlerFormatSupport.js";

import {
  DEFAULT_VIDEO_REQUEST,
  MAX_TRANSCRIPT_EXCERPT_CHARS,
  type ProcessedVideoContext,
  type VideoMetadata,
} from "../../../../gateways/channels/telegram/video-handler/VideoHandlerTypes.js";

export class VideoHandlerContextSupport {
  public static buildPreparedMessage(
    context: ProcessedVideoContext,
    requestInstruction: string,
  ): string {
    const lines: string[] = [];
    const metadata = context.metadata;
    const excerpt = this.buildTranscriptExcerpt(context.transcript);

    lines.push("[Automatically prepared video context]");
    lines.push(`Source: ${metadata.sourceLabel}`);
    lines.push(`Title: ${metadata.title}`);

    if (metadata.author) {
      lines.push(`Author/channel: ${metadata.author}`);
    }

    if (metadata.sourceUrl) {
      lines.push(`URL: ${metadata.sourceUrl}`);
    }

    if (typeof metadata.durationSeconds === "number") {
      lines.push(
        `Approximate duration: ${VideoHandlerFormatSupport.formatDuration(metadata.durationSeconds)}`,
      );
    }

    if (
      typeof metadata.width === "number" &&
      typeof metadata.height === "number"
    ) {
      lines.push(`Resolution: ${metadata.width}x${metadata.height}`);
    }

    if (typeof metadata.fileSizeBytes === "number") {
      lines.push(
        `File size: ${VideoHandlerFormatSupport.formatMegabytes(metadata.fileSizeBytes)} MB`,
      );
    }

    lines.push(`Primary content source: ${context.transcriptSource}`);
    lines.push(`Full context file: ${context.contextFilePath}`);

    if (metadata.description) {
      lines.push("Video description:");
      lines.push(metadata.description);
    }

    if (context.warnings.length > 0) {
      lines.push("Limitations or notes:");
      for (const warning of context.warnings) {
        lines.push(`- ${warning}`);
      }
    }

    if (excerpt) {
      lines.push("Transcript/context excerpt:");
      lines.push(excerpt);
    } else {
      lines.push("No text transcription was obtained automatically.");
    }

    lines.push(
      `User request: ${requestInstruction || DEFAULT_VIDEO_REQUEST}`,
    );
    lines.push(
      "If the request requires more details than the above excerpt covers, use the `read_file` tool on the full context file before responding with confidence.",
    );
    lines.push(
      "If the transcript or analysis is incomplete, state that limitation explicitly in the response.",
    );

    return lines.join("\n\n");
  }

  public static buildTranscriptExcerpt(transcript: string): string {
    const normalized = transcript.trim();
    if (!normalized) {
      return "";
    }

    if (normalized.length <= MAX_TRANSCRIPT_EXCERPT_CHARS) {
      return normalized;
    }

    return `${normalized.slice(0, MAX_TRANSCRIPT_EXCERPT_CHARS).trim()}\n\n...[Truncated excerpt. Read the full context file if you need the rest]`;
  }

  public static writeContextFile(
    metadata: VideoMetadata,
    transcript: string,
    transcriptSource: string,
    warnings: string[],
    contextDir: string,
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = VideoHandlerFormatSupport.slugify(metadata.title || "video");
    const filePath = path.join(contextDir, `${timestamp}_${slug}.md`);
    const lines: string[] = [];
    lines.push(`# Video context: ${metadata.title}`);
    lines.push("");
    lines.push(`- Source: ${metadata.sourceLabel}`);

    if (metadata.sourceUrl) {
      lines.push(`- URL: ${metadata.sourceUrl}`);
    }

    if (metadata.author) {
      lines.push(`- Author/channel: ${metadata.author}`);
    }

    if (typeof metadata.durationSeconds === "number") {
      lines.push(
        `- Approximate duration: ${VideoHandlerFormatSupport.formatDuration(metadata.durationSeconds)}`,
      );
    }

    if (
      typeof metadata.width === "number" &&
      typeof metadata.height === "number"
    ) {
      lines.push(`- Resolution: ${metadata.width}x${metadata.height}`);
    }

    if (typeof metadata.fileSizeBytes === "number") {
      lines.push(
        `- File size: ${VideoHandlerFormatSupport.formatMegabytes(metadata.fileSizeBytes)} MB`,
      );
    }

    lines.push(`- Text content source: ${transcriptSource}`);

    if (metadata.description) {
      lines.push("");
      lines.push("## Description");
      lines.push(metadata.description);
    }

    if (warnings.length > 0) {
      lines.push("");
      lines.push("## Notes");
      for (const warning of warnings) {
        lines.push(`- ${warning}`);
      }
    }

    lines.push("");
    lines.push("## Transcript or text context");
    lines.push(
      transcript ||
        "Could not extract an automatic text transcript from this video.",
    );

    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    return filePath;
  }
}
