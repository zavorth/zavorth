import fs from 'fs';

export class CodexRemoteSidecarTerminalSupport {
  public async readTextFile(filePath: string | null): Promise<string> {
    const normalized = String(filePath || '').trim();
    if (!normalized) {
      return '';
    }
    try {
      const content = await fs.promises.readFile(normalized, 'utf8');
      return content.trim();
    } catch {
      return '';
    }
  }

  public async readTailFromFile(filePath: string | null, maxLines: number): Promise<string[]> {
    const normalized = String(filePath || '').trim();
    if (!normalized) {
      return [];
    }
    try {
      const content = await fs.promises.readFile(normalized, 'utf8');
      return content.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(-maxLines);
    } catch {
      return [];
    }
  }

  public normalizeChunk(chunk: unknown): string {
    if (typeof chunk === 'string') {
      return chunk;
    }
    if (Buffer.isBuffer(chunk)) {
      return chunk.toString('utf8');
    }
    return String(chunk ?? '');
  }

  public extractLastMeaningfulOutput(chunks: string[]): string | null {
    const combined = chunks
      .map((chunk) => this.normalizeChunk(chunk))
      .join('')
      .trim();
    if (!combined) {
      return null;
    }

    const lines = combined
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return null;
    }

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const candidate = lines[index];
      if (!/^warning[:\s]/i.test(candidate) && !/^info[:\s]/i.test(candidate)) {
        return candidate;
      }
    }

    return lines[lines.length - 1] || null;
  }
}
