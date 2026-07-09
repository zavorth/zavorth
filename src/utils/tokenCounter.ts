import { getEncoding } from 'js-tiktoken';

let encodingInstance: any = null;

function getEncodingInstance() {
  if (!encodingInstance) {
    encodingInstance = getEncoding('cl100k_base');
  }
  return encodingInstance;
}

/**
 * Counts the exact number of tokens in a string using cl100k_base (tiktoken).
 */
export function countTokens(text: string): number {
  if (!text) {
    return 0;
  }
  try {
    return getEncodingInstance().encode(text).length;
  } catch (err: any) { const error = err; const e = err;
    // Fallback to rough estimation in case of error
    return Math.ceil(text.length / 4);
  }
}

/**
 * Counts the tokens for a list of messages following ChatML tokenization format.
 */
export function countMessagesTokens(
  messages: Array<{
    role: string;
    content: string | null;
    name?: string | null;
    toolName?: string | null;
  }>
): number {
  let numTokens = 0;
  for (const message of messages) {
    numTokens += 4; // Every message format overhead: <|im_start|>{role}\n{content}<|im_end|>\n
    if (message.content) {
      numTokens += countTokens(message.content);
    }
    const name = message.name || message.toolName;
    if (name) {
      numTokens += countTokens(name);
      numTokens += 1; // Offset for name
    }
  }
  numTokens += 3; // Primed with <|im_start|>assistant\n
  return numTokens;
}
