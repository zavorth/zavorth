import fs from 'fs';
import os from 'os';
import path from 'path';
import { CapabilityUnavailableError, buildCapabilityProvisionHint } from '../../../services/OptionalCapabilityGuard.js';

const YTDLP_TMP_DIR = path.join(os.tmpdir(), 'zavorth-ytdlp');
const LOCAL_FFMPEG_PATH = path.join(YTDLP_TMP_DIR, 'ffmpeg.exe');

export interface DownloadedAudioResult {
  audioPath: string;
  source: string;
}

export interface DownloadedCaptionResult {
  transcript: string;
  source: string;
}

export class YtDlpFallback {
  private ytDlpExec: ((url: string, options?: Record<string, unknown>) => Promise<unknown>) | null;
  private ffmpegPath: string | null;

  constructor() {
    this.ytDlpExec = null;
    this.ffmpegPath = null;
    this.ensureTmpDir();

    try {
      const loaded = require('youtube-dl-exec');
      this.ytDlpExec = typeof loaded === 'function' ? loaded : loaded?.default || null;
    } catch {
      this.ytDlpExec = null;
    }

    try {
      const loaded = require('ffmpeg-static');
      if (typeof loaded === 'string' && loaded) {
        fs.copyFileSync(loaded, LOCAL_FFMPEG_PATH);
        this.ffmpegPath = LOCAL_FFMPEG_PATH;
      }
    } catch {
      this.ffmpegPath = null;
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.ytDlpExec);
  }

  public getAvailabilityWarning(): string | null {
    if (!this.ytDlpExec) {
      return `O fallback opcional de yt-dlp nao esta provisionado neste host. ${buildCapabilityProvisionHint('media')}`;
    }
    if (!this.ffmpegPath) {
      return `O yt-dlp esta presente, mas o ffmpeg opcional nao foi provisionado. O Zavorth vai tentar um caminho mais leve quando possivel. ${buildCapabilityProvisionHint('media')}`;
    }
    return null;
  }

  public async downloadAudio(videoUrl: string): Promise<DownloadedAudioResult | null> {
    if (!this.ytDlpExec) {
      throw new CapabilityUnavailableError({
        capabilityId: 'media',
        dependencyName: 'youtube-dl-exec',
        reason: 'yt-dlp nao esta disponivel para extrair audio deste video.',
      });
    }

    const basename = `yt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const outputTemplate = path.join(YTDLP_TMP_DIR, `${basename}.%(ext)s`);

    const options: Record<string, unknown> = {
      output: outputTemplate,
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      forceOverwrites: true,
      addHeader: ['referer:youtube.com'],
    };

    if (this.ffmpegPath) {
      options.extractAudio = true;
      options.audioFormat = 'mp3';
      options.audioQuality = 0;
      options.ffmpegLocation = this.ffmpegPath;
    } else {
      options.format = 'bestaudio[ext=m4a]/bestaudio[acodec!=none]/bestaudio';
    }

    await this.ytDlpExec(videoUrl, options);

    const outputFile = fs.readdirSync(YTDLP_TMP_DIR)
      .filter((entry) => entry.startsWith(`${basename}.`))
      .sort()
      .map((entry) => path.join(YTDLP_TMP_DIR, entry))[0];

    if (!outputFile || !fs.existsSync(outputFile)) {
      throw new Error('yt-dlp nao gerou um arquivo de audio utilizavel.');
    }

    return {
      audioPath: outputFile,
      source: this.ffmpegPath ? 'yt-dlp + ffmpeg' : 'yt-dlp (sem ffmpeg)',
    };
  }

  public async downloadCaptions(videoUrl: string): Promise<DownloadedCaptionResult | null> {
    if (!this.ytDlpExec) {
      throw new CapabilityUnavailableError({
        capabilityId: 'media',
        dependencyName: 'youtube-dl-exec',
        reason: 'yt-dlp nao esta disponivel para buscar legendas externas deste video.',
      });
    }

    const basename = `caps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const outputTemplate = path.join(YTDLP_TMP_DIR, `${basename}.%(ext)s`);

    try {
      await this.ytDlpExec(videoUrl, {
        output: outputTemplate,
        noPlaylist: true,
        noWarnings: true,
        noCheckCertificates: true,
        skipDownload: true,
        writeAutoSub: true,
        writeSub: true,
        subLang: 'en-US,pt,en-US,en',
        subFormat: 'json3/vtt/srt/best',
        addHeader: ['referer:youtube.com'],
      });
    } catch {
      return null;
    }

    const subtitleFiles = fs.readdirSync(YTDLP_TMP_DIR)
      .filter((entry) => entry.startsWith(`${basename}.`))
      .map((entry) => path.join(YTDLP_TMP_DIR, entry))
      .filter((filePath) => /\.(json3|vtt|srt)$/i.test(filePath));

    if (subtitleFiles.length === 0) {
      return null;
    }

    const selectedFile = subtitleFiles.sort((left, right) => this.getCaptionFileRank(left) - this.getCaptionFileRank(right))[0];

    try {
      const transcript = this.parseCaptionFile(selectedFile);
      if (!transcript) {
        return null;
      }

      return {
        transcript,
        source: `yt-dlp captions (${path.extname(selectedFile).replace('.', '')})`,
      };
    } finally {
      for (const filePath of subtitleFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // Ignora falhas na limpeza de caption temporaria.
        }
      }
    }
  }

  private ensureTmpDir(): void {
    if (!fs.existsSync(YTDLP_TMP_DIR)) {
      fs.mkdirSync(YTDLP_TMP_DIR, { recursive: true });
    }
  }

  private getCaptionFileRank(filePath: string): number {
    const lower = filePath.toLowerCase();
    const languageRank = lower.includes('.en-us.') ? 0
      : lower.includes('.pt.') ? 1
      : lower.includes('.en-us.') ? 2
      : lower.includes('.en.') ? 3
      : 10;
    const extension = path.extname(filePath).toLowerCase();
    const extensionRank = extension === '.json3' ? 0 : extension === '.vtt' ? 1 : 2;
    return languageRank * 10 + extensionRank;
  }

  private parseCaptionFile(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf8');
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.json3') {
      return this.parseJson3Transcript(content);
    }

    if (extension === '.vtt') {
      return this.parseVttTranscript(content);
    }

    if (extension === '.srt') {
      return this.parseSrtTranscript(content);
    }

    return '';
  }

  private parseJson3Transcript(content: string): string {
    try {
      const payload = JSON.parse(content);
      const events = Array.isArray(payload?.events) ? payload.events : [];
      const lines: string[] = [];

      for (const event of events) {
        const segs = Array.isArray(event?.segs) ? event.segs : [];
        const text = segs
          .map((segment: any) => String(segment?.utf8 || ''))
          .join('')
          .replace(/\s+/g, ' ')
          .trim();

        if (!text) {
          continue;
        }

        const timestamp = this.formatTimestamp(typeof event?.tStartMs === 'number' ? event.tStartMs : 0);
        lines.push(`[${timestamp}] ${text}`);
      }

      return lines.join('\n').trim();
    } catch {
      return '';
    }
  }

  private parseVttTranscript(content: string): string {
    const blocks = content.split(/\r?\n\r?\n/);
    const lines: string[] = [];

    for (const block of blocks) {
      const rows = block.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
      const timeRow = rows.find((row) => row.includes('-->'));
      if (!timeRow) {
        continue;
      }

      const start = timeRow.split('-->')[0]?.trim() || '00:00:00.000';
      const text = rows
        .filter((row) => row !== timeRow && !/^\d+$/.test(row) && !/^WEBVTT/i.test(row))
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) {
        continue;
      }

      lines.push(`[${this.normalizeCaptionTimestamp(start)}] ${text}`);
    }

    return lines.join('\n').trim();
  }

  private parseSrtTranscript(content: string): string {
    const blocks = content.split(/\r?\n\r?\n/);
    const lines: string[] = [];

    for (const block of blocks) {
      const rows = block.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
      const timeRow = rows.find((row) => row.includes('-->'));
      if (!timeRow) {
        continue;
      }

      const start = timeRow.split('-->')[0]?.trim() || '00:00:00,000';
      const text = rows
        .filter((row) => row !== timeRow && !/^\d+$/.test(row))
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) {
        continue;
      }

      lines.push(`[${this.normalizeCaptionTimestamp(start)}] ${text}`);
    }

    return lines.join('\n').trim();
  }

  private normalizeCaptionTimestamp(value: string): string {
    const normalized = value.replace(',', '.');
    const [timePart] = normalized.split('.');
    const parts = timePart.split(':').map((segment) => segment.trim());
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return hours === '00' ? `${minutes}:${seconds}` : `${hours}:${minutes}:${seconds}`;
    }

    return timePart;
  }

  private formatTimestamp(totalMilliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
