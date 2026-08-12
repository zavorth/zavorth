export type ZavorthTokenCompressionMode = 'aggressive' | 'standard' | 'default';

export type ZavorthTokenCompressionResult = {
  compressedText: string;
  originalCharCount: number;
  compressedCharCount: number;
  savingsPercentage: number;
};

const BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_PATTERN = /\/\/[^\r\n]*/g;
const FENCE_PATTERN = /```[^\n]*\n([\s\S]*?)```/g;

function compressTextContent(text: string, mode: ZavorthTokenCompressionMode): string {
  const withoutComments = text.replace(BLOCK_COMMENT_PATTERN, '').replace(LINE_COMMENT_PATTERN, '');
  if (mode === 'aggressive') {
    return withoutComments
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');
  }
  return withoutComments.replace(/\s+/g, ' ').trim();
}

export const ZavorthTokenEconomyCompressor = {
  compressText(text: string, mode: ZavorthTokenCompressionMode = 'standard'): ZavorthTokenCompressionResult {
    const compressedText = compressTextContent(text, mode);
    const originalCharCount = text.length;
    const compressedCharCount = compressedText.length;
    const savingsPercentage = originalCharCount > 0
      ? Number((((originalCharCount - compressedCharCount) / originalCharCount) * 100).toFixed(2))
      : 0;
    return {
      compressedText,
      originalCharCount,
      compressedCharCount,
      savingsPercentage,
    };
  },

  compressCodeBlocks(markdown: string, mode: ZavorthTokenCompressionMode = 'standard'): string {
    return markdown.replace(FENCE_PATTERN, (match: string, body: string) => {
      const compressed = compressTextContent(body, mode);
      const bodyIndex = match.indexOf(body);
      const prefix = match.slice(0, bodyIndex);
      const suffix = match.slice(bodyIndex + body.length);
      return `${prefix}${compressed}${suffix}`;
    });
  },
};
