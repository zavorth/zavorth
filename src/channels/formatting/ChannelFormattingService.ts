export type ChannelMessagePlatform =
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | 'signal'
  | 'imessage'
  | 'teams'
  | 'email';

const PLATFORM_MESSAGE_CHAR_LIMITS: Record<ChannelMessagePlatform, number> = {
  telegram: 4096,
  discord: 2000,
  slack: 4000,
  whatsapp: 4096,
  signal: 4096,
  imessage: 4096,
  teams: 4096,
  email: 4096,
};

const FALLBACK_MESSAGE_CHAR_LIMIT = 3500;

const CODE_FENCE_OPEN_PATTERN = /^\s{0,3}(```|~~~)\s*([\w+-]*)\s*$/;
const CODE_FENCE_CLOSE_PATTERN = /^\s{0,3}(```|~~~)\s*$/;

type MessageSegment =
  | { kind: 'text'; content: string }
  | { kind: 'code'; fence: string; language: string; content: string };

/**
 * Splits outbound channel messages into platform-sized chunks without
 * breaking fenced code blocks, table rows, or words. A code block longer
 * than the limit is split by lines and each fragment is re-wrapped in the
 * original fence so every chunk stays renderable on its own.
 */
export class ChannelFormattingService {
  public static resolveMessageCharLimit(platform: ChannelMessagePlatform): number {
    return PLATFORM_MESSAGE_CHAR_LIMITS[platform] ?? FALLBACK_MESSAGE_CHAR_LIMIT;
  }

  public static chunkMessageForPlatform(platform: ChannelMessagePlatform, text: string): string[] {
    return this.chunkMessage(text, this.resolveMessageCharLimit(platform));
  }

  public static chunkMessage(text: string, charLimit: number): string[] {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n');
    const limit = Math.max(1, Math.floor(charLimit));
    if (normalized.length <= limit) {
      return [normalized];
    }
    const segments = segmentMessage(normalized);
    const chunks: string[] = [];
    let current = '';
    for (const segment of segments) {
      const rendered = renderSegment(segment);
      if (rendered.length > limit) {
        if (current.trim().length > 0) {
          chunks.push(current);
          current = '';
        }
        for (const piece of splitOversizedSegment(segment, limit)) {
          chunks.push(piece);
        }
        continue;
      }
      if (current.length === 0) {
        current = rendered;
      } else if (current.length + 2 + rendered.length <= limit) {
        current = `${current}\n\n${rendered}`;
      } else {
        chunks.push(current);
        current = rendered;
      }
    }
    if (current.trim().length > 0 || chunks.length === 0) {
      chunks.push(current);
    }
    return chunks.filter((chunk, index) => index === 0 || chunk.trim().length > 0);
  }
}

function segmentMessage(text: string): MessageSegment[] {
  const lines = text.split('\n');
  const segments: MessageSegment[] = [];
  let paragraphLines: string[] = [];
  let fence: string | null = null;
  let fenceLanguage = '';
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      segments.push({ kind: 'text', content: paragraphLines.join('\n') });
      paragraphLines = [];
    }
  };

  for (const line of lines) {
    if (fence === null) {
      const openMatch = CODE_FENCE_OPEN_PATTERN.exec(line);
      if (openMatch) {
        flushParagraph();
        fence = openMatch[1];
        fenceLanguage = openMatch[2] ?? '';
        codeLines = [];
        continue;
      }
      paragraphLines.push(line);
      continue;
    }
    if (CODE_FENCE_CLOSE_PATTERN.test(line) && line.trim().startsWith(fence)) {
      segments.push({ kind: 'code', fence, language: fenceLanguage, content: codeLines.join('\n') });
      fence = null;
      fenceLanguage = '';
      codeLines = [];
      continue;
    }
    codeLines.push(line);
  }
  flushParagraph();
  if (fence !== null) {
    segments.push({ kind: 'code', fence, language: fenceLanguage, content: codeLines.join('\n') });
  }
  return segments;
}

function renderSegment(segment: MessageSegment): string {
  if (segment.kind === 'text') {
    return segment.content;
  }
  return `${segment.fence}${segment.language}\n${segment.content}\n${segment.fence}`;
}

function splitOversizedSegment(segment: MessageSegment, limit: number): string[] {
  if (segment.kind === 'code') {
    return splitOversizedCodeBlock(segment, limit);
  }
  return splitPlainText(segment.content, limit);
}

function splitOversizedCodeBlock(
  segment: Extract<MessageSegment, { kind: 'code' }>,
  limit: number,
): string[] {
  const openingFence = `${segment.fence}${segment.language}`;
  const closingFence = segment.fence;
  const overhead = openingFence.length + closingFence.length + 2;
  const bodyLimit = Math.max(1, limit - overhead);
  const pieces: string[] = [];
  let currentBody = '';
  for (const line of segment.content.split('\n')) {
    for (const hardPiece of hardSplitToken(line, bodyLimit)) {
      const candidate = currentBody.length === 0 ? hardPiece : `${currentBody}\n${hardPiece}`;
      if (candidate.length > bodyLimit && currentBody.length > 0) {
        pieces.push(currentBody);
        currentBody = hardPiece;
      } else {
        currentBody = candidate;
      }
    }
  }
  if (currentBody.length > 0 || pieces.length === 0) {
    pieces.push(currentBody);
  }
  return pieces.map((body) => `${openingFence}\n${body}\n${closingFence}`);
}

function splitPlainText(content: string, limit: number): string[] {
  const chunks: string[] = [];
  let current = '';
  const atomicPieces = content.split('\n').flatMap((line) => hardSplitToken(line, limit));
  for (const piece of atomicPieces) {
    const separator = current.length === 0 ? '' : '\n';
    if (current.length + separator.length + piece.length <= limit) {
      current = `${current}${separator}${piece}`;
      continue;
    }
    if (current.length > 0) {
      chunks.push(current);
    }
    current = piece;
  }
  if (current.length > 0 || chunks.length === 0) {
    chunks.push(current);
  }
  return chunks;
}

/** Splits a single line at word boundaries; words longer than the limit are cut. */
function hardSplitToken(line: string, limit: number): string[] {
  if (line.length <= limit) {
    return [line];
  }
  const pieces: string[] = [];
  let remaining = line;
  while (remaining.length > limit) {
    let breakIndex = remaining.lastIndexOf(' ', limit);
    if (breakIndex <= 0) {
      breakIndex = limit;
    }
    pieces.push(remaining.slice(0, breakIndex).trimEnd());
    remaining = remaining.slice(breakIndex).trimStart();
  }
  if (remaining.length > 0) {
    pieces.push(remaining);
  }
  return pieces;
}
