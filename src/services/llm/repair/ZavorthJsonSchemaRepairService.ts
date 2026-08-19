export interface JsonRepairResult<T = unknown> {
  readonly success: boolean;
  readonly repaired: boolean;
  readonly data?: T;
  readonly originalText: string;
  readonly repairedText: string;
  readonly errorMessage?: string;
}

export class ZavorthJsonSchemaRepairService {
  public parseSafe<T = unknown>(rawText: string, fallback?: T): JsonRepairResult<T> {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {
        success: false,
        repaired: false,
        data: fallback,
        originalText: rawText,
        repairedText: '',
        errorMessage: 'Input text is empty',
      };
    }

    // Try direct native parse first
    try {
      const parsed = JSON.parse(trimmed) as T;
      return {
        success: true,
        repaired: false,
        data: parsed,
        originalText: rawText,
        repairedText: trimmed,
      };
    } catch {
      // Direct parse failed, proceed to deterministic repair
    }

    const candidateJson = this.extractFirstJsonSlice(trimmed) || trimmed;
    const repairedText = this.repairJsonString(candidateJson);

    try {
      const parsed = JSON.parse(repairedText) as T;
      return {
        success: true,
        repaired: true,
        data: parsed,
        originalText: rawText,
        repairedText,
      };
    } catch (err: unknown) {
      return {
        success: false,
        repaired: true,
        data: fallback,
        originalText: rawText,
        repairedText,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public extractFirstJsonSlice(text: string): string | null {
    const startIdx = text.indexOf('{');
    if (startIdx < 0) {
      const startArrayIdx = text.indexOf('[');
      if (startArrayIdx < 0) return null;
      return this.sliceBalanced(text, startArrayIdx, '[', ']');
    }

    return this.sliceBalanced(text, startIdx, '{', '}');
  }

  private sliceBalanced(text: string, startIndex: number, openChar: string, closeChar: string): string | null {
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === openChar) {
          depth++;
        } else if (char === closeChar) {
          depth--;
          if (depth === 0) {
            return text.substring(startIndex, i + 1);
          }
        }
      }
    }

    // If string ended before balanced closing, return remainder to allow auto-repair to balance it
    return text.substring(startIndex);
  }

  public repairJsonString(input: string): string {
    let text = input.trim();

    // Strip markdown code fence prefixes if present
    if (text.startsWith('```json')) {
      text = text.substring(7).trim();
    } else if (text.startsWith('```')) {
      text = text.substring(3).trim();
    }
    if (text.endsWith('```')) {
      text = text.substring(0, text.length - 3).trim();
    }

    const openBraces: string[] = [];
    let inString = false;
    let isEscaped = false;
    const outputChars: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (isEscaped) {
        outputChars.push(char);
        isEscaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        outputChars.push(char);
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        outputChars.push(char);
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') {
          openBraces.push(char);
          outputChars.push(char);
        } else if (char === '}') {
          if (openBraces.length > 0 && openBraces[openBraces.length - 1] === '{') {
            openBraces.pop();
            this.removeTrailingComma(outputChars);
            outputChars.push(char);
          }
        } else if (char === ']') {
          if (openBraces.length > 0 && openBraces[openBraces.length - 1] === '[') {
            openBraces.pop();
            this.removeTrailingComma(outputChars);
            outputChars.push(char);
          }
        } else {
          outputChars.push(char);
        }
      } else {
        outputChars.push(char);
      }
    }

    // If loop ended while inside an unclosed string, close the quote
    if (inString) {
      outputChars.push('"');
    }

    // Remove any trailing comma before auto-closing remaining braces
    this.removeTrailingComma(outputChars);

    // Auto-close any unclosed open brackets in reverse order
    while (openBraces.length > 0) {
      const unclosed = openBraces.pop();
      if (unclosed === '{') {
        outputChars.push('}');
      } else if (unclosed === '[') {
        outputChars.push(']');
      }
    }

    return outputChars.join('');
  }

  private removeTrailingComma(chars: string[]): void {
    let idx = chars.length - 1;
    while (idx >= 0 && (chars[idx] === ' ' || chars[idx] === '\n' || chars[idx] === '\r' || chars[idx] === '\t')) {
      idx--;
    }
    if (idx >= 0 && chars[idx] === ',') {
      chars.splice(idx, 1);
    }
  }
}
