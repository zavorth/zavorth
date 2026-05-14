import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { CapabilityUnavailableError } from '../services/OptionalCapabilityGuard.js';

const AUDIO_TMP_DIR = path.join(os.tmpdir(), 'zavorth-audio-chunks');

export interface PreparedAudioChunk {
  filePath: string;
  index: number;
  startSeconds: number;
  endSeconds: number;
}

export interface PreparedAudioChunksResult {
  normalizedAudioPath?: string;
  chunks: PreparedAudioChunk[];
}

export class AudioChunker {
  private ffmpegPath: string | null;

  constructor() {
    this.ffmpegPath = null;
    this.ensureTmpDir();

    try {
      const loaded = require('ffmpeg-static');
      this.ffmpegPath = typeof loaded === 'string' && loaded ? loaded : null;
    } catch {
      this.ffmpegPath = null;
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.ffmpegPath);
  }

  public async prepareChunks(sourcePath: string, chunkSeconds: number): Promise<PreparedAudioChunksResult> {
    if (!this.ffmpegPath) {
      throw new CapabilityUnavailableError({
        capabilityId: 'media',
        dependencyName: 'ffmpeg-static',
        reason: 'ffmpeg-static nao esta disponivel para preparar chunks de audio.',
      });
    }

    const baseName = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const chunkPattern = path.join(AUDIO_TMP_DIR, `${baseName}_chunk_%03d.mp3`);

    await this.runFfmpeg([
      '-y',
      '-i',
      sourcePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '48k',
      '-f',
      'segment',
      '-segment_time',
      String(chunkSeconds),
      '-reset_timestamps',
      '1',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '48k',
      chunkPattern,
    ]);

    const chunkPrefix = `${baseName}_chunk_`;
    const chunks = fs.readdirSync(AUDIO_TMP_DIR)
      .filter((entry) => entry.startsWith(chunkPrefix) && entry.endsWith('.mp3'))
      .sort()
      .map((entry, index) => ({
        filePath: path.join(AUDIO_TMP_DIR, entry),
        index,
        startSeconds: index * chunkSeconds,
        endSeconds: (index + 1) * chunkSeconds,
      }));

    if (chunks.length === 0) {
      throw new Error('ffmpeg nao gerou nenhum chunk de audio utilizavel.');
    }

    return {
      chunks,
    };
  }

  public cleanupPaths(paths: Array<string | null | undefined>): void {
    for (const filePath of paths) {
      if (!filePath) {
        continue;
      }

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`[AudioChunker] Falha ao remover temporario: ${error}`);
      }
    }
  }

  private ensureTmpDir(): void {
    if (!fs.existsSync(AUDIO_TMP_DIR)) {
      fs.mkdirSync(AUDIO_TMP_DIR, { recursive: true });
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ffmpegPath) {
        reject(new CapabilityUnavailableError({
          capabilityId: 'media',
          dependencyName: 'ffmpeg-static',
          reason: 'ffmpeg-static nao esta disponivel para executar o pipeline multimidia.',
        }));
        return;
      }

      const child = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stderr = '';

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`ffmpeg saiu com codigo ${code}: ${stderr.trim()}`));
      });
    });
  }
}
