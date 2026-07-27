import { asErrorLike } from '../utils/errorLike';
import * as fs from 'fs';
import * as path from 'path';

interface SemanticChunk {
  text: string;
  sourceFile: string;
  keywords: string[];
}

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tar', '.gz',
    '.7z', '.rar', '.exe', '.dll', '.so', '.dylib', '.bin', '.mp3', '.mp4', '.wav',
    '.avi', '.mkv', '.mov', '.flac', '.ogg', '.woff', '.woff2', '.ttf', '.eot'
  ]);
  if (binaryExtensions.has(ext)) {
    return true;
  }

  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8000);
    const bytesRead = fs.readSync(fd, buffer, 0, 8000, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
  } catch (error: unknown) {return true;
  }
  return false;
}

export class VectorSemanticStore {
  private chunks: SemanticChunk[] = [];
  private indexPath: string;

  constructor(workspacePath: string) {
    if (!workspacePath || typeof workspacePath !== 'string' || workspacePath.trim() === '') {
      throw new Error('Invalid workspace path');
    }
    const zavorthDir = path.join(workspacePath, '.zavorth');
    if (!fs.existsSync(zavorthDir)) {
      fs.mkdirSync(zavorthDir, { recursive: true });
    }
    this.indexPath = path.join(zavorthDir, 'semantic-index.json');
    this.loadIndex();
  }

  private loadIndex() {
    try {
      if (fs.existsSync(this.indexPath)) {
        this.chunks = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
      }
    } catch (error: unknown) {this.chunks = [];
    }
  }

  private saveIndex() {
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify(this.chunks, null, 2), 'utf8');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to save semantic index:', err);
    }
  }

  /**
   * Chunks a file and adds it to the index.
   */
  public async indexFile(filePath: string, relativePath: string) {
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      return;
    }
    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      return;
    }

    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`File does not exist: ${filePath}`);
        return;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        console.warn(`Path is not a file: ${filePath}`);
        return;
      }

      // Max size check (5MB)
      if (stats.size > 5 * 1024 * 1024) {
        console.warn(`Skipping large file ${filePath} (${stats.size} bytes)`);
        return;
      }

      // Binary detection check
      if (isBinaryFile(filePath)) {
        console.warn(`Skipping binary file: ${filePath}`);
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');

      // Simple paragraph-based chunker
      const paragraphs = content.split(/\n\s*\n/);
      const newChunks: SemanticChunk[] = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 20)
        .map(text => {
          // Extract keywords in a Unicode-safe way (matching letters/numbers globally)
          const cleanText = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
          const words = cleanText.split(/\s+/).filter(Boolean);
          const keywords = Array.from(new Set(words.filter(w => w.length > 4)));
          return {
            text,
            sourceFile: relativePath,
            keywords
          };
        });

      // Filter out old chunks for this file
      this.chunks = this.chunks.filter(c => c.sourceFile !== relativePath).concat(newChunks);
      this.saveIndex();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error(`Failed to index file ${filePath}:`, err);
    }
  }

  /**
   * Runs local semantic lookup using keyword overlap matching.
   * Matches across all channels/locations of Zavorth.
   */
  public query(queryText: string, limit: number = 3): string[] {
    const sanitizedLimit = Math.max(1, limit);
    if (!queryText || typeof queryText !== 'string' || queryText.trim() === '') {
      return [];
    }

    const queryWords = queryText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (queryWords.length === 0) return [];

    const scored = this.chunks.map(chunk => {
      let score = 0;
      for (const word of queryWords) {
        if (chunk.keywords.includes(word)) {
          score += 2;
        } else if (chunk.text.toLowerCase().includes(word)) {
          score += 1;
        }
      }
      return { chunk, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, sanitizedLimit)
      .map(s => `[${s.chunk.sourceFile}]: ${s.chunk.text}`);
  }
}
