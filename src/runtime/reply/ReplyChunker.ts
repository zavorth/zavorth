export type ReplyChunkerInput = {
  text: string;
  maxLength: number;
};

export type ReplyTextChunk = {
  index: number;
  total: number;
  text: string;
};

export class ReplyChunker {
  public chunk(input: ReplyChunkerInput): ReplyTextChunk[] {
    const maxLength = Math.max(1, Math.floor(input.maxLength));
    const text = String(input.text ?? '');
    if (text.length <= maxLength) {
      return [{ index: 0, total: 1, text }];
    }

    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > maxLength) {
      const splitAt = this.findSplitPoint(remaining, maxLength);
      chunks.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }
    chunks.push(remaining);

    return chunks.map((chunk, index) => ({
      index,
      total: chunks.length,
      text: chunk,
    }));
  }

  private findSplitPoint(text: string, maxLength: number): number {
    const paragraphBreak = text.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > Math.floor(maxLength * 0.5)) {
      return paragraphBreak + 2;
    }

    const lineBreak = text.lastIndexOf('\n', maxLength);
    if (lineBreak > Math.floor(maxLength * 0.5)) {
      return lineBreak + 1;
    }

    const wordBreak = text.lastIndexOf(' ', maxLength);
    if (wordBreak > Math.floor(maxLength * 0.5)) {
      return wordBreak + 1;
    }

    return maxLength;
  }
}
