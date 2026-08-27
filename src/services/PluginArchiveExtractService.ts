import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

const MAX_ARCHIVE_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 10_000;

export type PluginArchiveExtractResult = {
  ok: boolean;
  method?: 'system' | 'pure';
  error?: string;
  filesWritten?: number;
};

export type PluginArchiveExtractRuntime = {
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  spawnSyncFn?: typeof spawnSync;
  preferSystemTools?: boolean;
};

/**
 * Cross-platform archive extraction with pure Node fallbacks for ZIP and TGZ.
 */
export class PluginArchiveExtractService {
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly spawnSyncFn: typeof spawnSync;
  private readonly preferSystemTools: boolean;

  constructor(runtime: PluginArchiveExtractRuntime = {}) {
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.spawnSyncFn = runtime.spawnSyncFn || spawnSync;
    this.preferSystemTools = runtime.preferSystemTools === true;
  }

  public extract(
    archivePath: string,
    extractDir: string,
    options?: { format?: 'zip' | 'tgz' | 'tar' | 'auto'; baseName?: string },
  ): PluginArchiveExtractResult {
    const resolvedArchive = path.resolve(archivePath);
    const resolvedExtract = path.resolve(extractDir);
    if (!this.existsSync(resolvedArchive)) {
      return { ok: false, error: `Archive not found: ${resolvedArchive}` };
    }

    try {
      this.mkdirSync(resolvedExtract, { recursive: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `Unable to create extract dir: ${message}` };
    }

    const format = this.resolveFormat(options?.format || 'auto', options?.baseName || resolvedArchive);
    if (format === 'zip') {
      return this.extractZip(resolvedArchive, resolvedExtract);
    }
    if (format === 'tgz' || format === 'tar') {
      return this.extractTgz(resolvedArchive, resolvedExtract, format === 'tar');
    }
    return { ok: false, error: `Unsupported archive format for ${path.basename(resolvedArchive)}` };
  }

  public extractZipBuffer(buffer: Buffer, extractDir: string): PluginArchiveExtractResult {
    try {
      this.mkdirSync(extractDir, { recursive: true });
      const filesWritten = this.pureExtractZip(buffer, extractDir);
      return { ok: true, method: 'pure', filesWritten };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, method: 'pure', error: message };
    }
  }

  public extractTgzBuffer(buffer: Buffer, extractDir: string, alreadyGunzipped = false): PluginArchiveExtractResult {
    try {
      this.mkdirSync(extractDir, { recursive: true });
      let tarBuffer: Buffer;
      if (alreadyGunzipped) {
        tarBuffer = buffer;
      } else {
        try {
          tarBuffer = zlib.gunzipSync(buffer, { maxOutputLength: MAX_ARCHIVE_TOTAL_BYTES });
        } catch (gzipError: unknown) {
          // Some tools write .tgz URLs that are not gzip; try plain tar.
          try {
            const filesWritten = this.pureExtractTar(buffer, extractDir);
            if (filesWritten > 0) {
              return { ok: true, method: 'pure', filesWritten };
            }
          } catch {
            /* fall through */
          }
          const message = gzipError instanceof Error ? gzipError.message : String(gzipError);
          return { ok: false, method: 'pure', error: `tgz extract failed: ${message}` };
        }
      }
      const filesWritten = this.pureExtractTar(tarBuffer, extractDir);
      return { ok: true, method: 'pure', filesWritten };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, method: 'pure', error: `tgz extract failed: ${message}` };
    }
  }

  private extractZip(archivePath: string, extractDir: string): PluginArchiveExtractResult {
    if (this.preferSystemTools) {
      const system = this.trySystemZip(archivePath, extractDir);
      if (system.ok) {
        return system;
      }
    }
    try {
      const buffer = this.readFileSync(archivePath);
      const filesWritten = this.pureExtractZip(buffer, extractDir);
      return { ok: true, method: 'pure', filesWritten };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, method: 'pure', error: `zip extract failed: ${message}` };
    }
  }

  private extractTgz(archivePath: string, extractDir: string, plainTar: boolean): PluginArchiveExtractResult {
    if (this.preferSystemTools) {
      const system = this.trySystemTar(archivePath, extractDir);
      if (system.ok) {
        return system;
      }
    }
    try {
      const buffer = this.readFileSync(archivePath);
      if (plainTar) {
        const filesWritten = this.pureExtractTar(buffer, extractDir);
        return { ok: true, method: 'pure', filesWritten };
      }
      return this.extractTgzBuffer(buffer, extractDir, false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, method: 'pure', error: `tgz extract failed: ${message}` };
    }
  }

  private trySystemZip(archivePath: string, extractDir: string): PluginArchiveExtractResult {
    if (process.platform === 'win32') {
      const ps = this.spawnSyncFn(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
        ],
        { encoding: 'utf8' },
      );
      if (!ps.error && ps.status === 0) {
        return { ok: true, method: 'system' };
      }
    }
    const unzip = this.spawnSyncFn('unzip', ['-o', archivePath, '-d', extractDir], { encoding: 'utf8' });
    if (!unzip.error && unzip.status === 0) {
      return { ok: true, method: 'system' };
    }
    return { ok: false, method: 'system', error: 'system zip tools unavailable' };
  }

  private trySystemTar(archivePath: string, extractDir: string): PluginArchiveExtractResult {
    const result = this.spawnSyncFn(
      process.platform === 'win32' ? 'tar.exe' : 'tar',
      ['-xzf', archivePath, '-C', extractDir],
      { encoding: 'utf8' },
    );
    if (!result.error && result.status === 0) {
      return { ok: true, method: 'system' };
    }
    return { ok: false, method: 'system', error: 'system tar unavailable' };
  }

  /**
   * Minimal ZIP reader: local file headers + store/deflate methods.
   */
  private pureExtractZip(buffer: Buffer, extractDir: string): number {
    let offset = 0;
    let filesWritten = 0;
    let totalWritten = 0;
    let entriesSeen = 0;
    const resolvedRoot = path.resolve(extractDir);

    while (offset + 30 <= buffer.length) {
      const signature = buffer.readUInt32LE(offset);
      if (signature === 0x02014b50 || signature === 0x06054b50) {
        // central directory or end of central directory
        break;
      }
      if (signature !== 0x04034b50) {
        break;
      }

      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const nameLength = buffer.readUInt16LE(offset + 26);
      const extraLength = buffer.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const nameEnd = nameStart + nameLength;
      if (nameEnd > buffer.length) {
        throw new Error('Truncated ZIP local header name');
      }
      const entryName = buffer.subarray(nameStart, nameEnd).toString('utf8');
      entriesSeen += 1;
      if (entriesSeen > MAX_ARCHIVE_ENTRIES) {
        throw new Error(`ZIP contains more than ${MAX_ARCHIVE_ENTRIES} entries`);
      }
      if (uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES || totalWritten + uncompressedSize > MAX_ARCHIVE_TOTAL_BYTES) {
        throw new Error(`ZIP extraction size limit exceeded at ${entryName}`);
      }
      const dataStart = nameEnd + extraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) {
        throw new Error(`Truncated ZIP entry: ${entryName}`);
      }

      const safeRel = this.safeRelativePath(entryName);
      if (safeRel === null) {
        throw new Error(`Path traversal rejected in ZIP entry: ${entryName}`);
      }

      const dest = path.resolve(resolvedRoot, safeRel);
      if (!dest.startsWith(resolvedRoot + path.sep) && dest !== resolvedRoot) {
        throw new Error(`Path escape rejected in ZIP entry: ${entryName}`);
      }

      if (entryName.endsWith('/') || entryName.endsWith('\\')) {
        this.mkdirSync(dest, { recursive: true });
        offset = dataEnd;
        continue;
      }

      this.mkdirSync(path.dirname(dest), { recursive: true });
      const compressed = buffer.subarray(dataStart, dataEnd);
      let content: Buffer;
      if (compression === 0) {
        content = Buffer.from(compressed);
      } else if (compression === 8) {
        content = zlib.inflateRawSync(compressed, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES });
      } else {
        throw new Error(`Unsupported ZIP compression method ${compression} for ${entryName}`);
      }
      if (content.length > MAX_ARCHIVE_ENTRY_BYTES || totalWritten > MAX_ARCHIVE_TOTAL_BYTES) {
        throw new Error(`ZIP extraction size limit exceeded at ${entryName}`);
      }
      totalWritten += content.length;
      if (totalWritten > MAX_ARCHIVE_TOTAL_BYTES) {
        throw new Error(`ZIP extraction size limit exceeded at ${entryName}`);
      }
      this.writeFileSync(dest, content);
      filesWritten += 1;
      offset = dataEnd;
    }

    if (filesWritten === 0 && buffer.length > 0) {
      // May be empty archive or only directories
      return filesWritten;
    }
    return filesWritten;
  }

  /**
   * Basic ustar tar parser (type 0/file and 5/dir).
   */
  private pureExtractTar(buffer: Buffer, extractDir: string): number {
    let offset = 0;
    let filesWritten = 0;
    let totalWritten = 0;
    let entriesSeen = 0;
    const resolvedRoot = path.resolve(extractDir);
    const blockSize = 512;

    while (offset + blockSize <= buffer.length) {
      const header = buffer.subarray(offset, offset + blockSize);
      if (isZeroBlock(header)) {
        break;
      }

      const name = readTarString(header, 0, 100);
      const size = parseOctal(readTarString(header, 124, 12));
      const typeFlag = String.fromCharCode(header[156] || 0);
      const prefix = readTarString(header, 345, 155);
      const fullName = prefix ? `${prefix}/${name}` : name;

      entriesSeen += 1;
      if (entriesSeen > MAX_ARCHIVE_ENTRIES) {
        throw new Error(`tar contains more than ${MAX_ARCHIVE_ENTRIES} entries`);
      }
      if (size > MAX_ARCHIVE_ENTRY_BYTES || totalWritten + size > MAX_ARCHIVE_TOTAL_BYTES) {
        throw new Error(`tar extraction size limit exceeded at ${fullName || '<unknown>'}`);
      }

      offset += blockSize;
      const dataSize = size;
      const padded = Math.ceil(dataSize / blockSize) * blockSize;
      const data = buffer.subarray(offset, offset + dataSize);
      offset += padded;

      if (!fullName) {
        continue;
      }

      const isDir = typeFlag === '5' || fullName.endsWith('/');
      const isFile = typeFlag === '0' || typeFlag === '\0' || typeFlag === '';

      if (!isDir && !isFile) {
        continue;
      }

      const safeRel = this.safeRelativePath(fullName);
      if (safeRel === null) {
        throw new Error(`Path traversal rejected in tar entry: ${fullName}`);
      }
      const dest = path.resolve(resolvedRoot, safeRel);
      if (!dest.startsWith(resolvedRoot + path.sep) && dest !== resolvedRoot) {
        throw new Error(`Path escape rejected in tar entry: ${fullName}`);
      }

      if (isDir) {
        this.mkdirSync(dest, { recursive: true });
        continue;
      }

      this.mkdirSync(path.dirname(dest), { recursive: true });
      this.writeFileSync(dest, data);
      totalWritten += data.length;
      filesWritten += 1;
    }

    return filesWritten;
  }

  private safeRelativePath(entryName: string): string | null {
    const normalized = String(entryName || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
    if (!normalized) {
      return null;
    }
    const parts = normalized.split('/').filter((part) => part && part !== '.');
    if (parts.some((part) => part === '..')) {
      return null;
    }
    return parts.join(path.sep);
  }

  private resolveFormat(
    format: 'zip' | 'tgz' | 'tar' | 'auto',
    hint: string,
  ): 'zip' | 'tgz' | 'tar' | 'unknown' {
    if (format !== 'auto') {
      return format;
    }
    const lower = String(hint || '').toLowerCase();
    if (lower.endsWith('.zip')) {
      return 'zip';
    }
    if (lower.endsWith('.tgz') || lower.endsWith('.tar.gz')) {
      return 'tgz';
    }
    if (lower.endsWith('.tar')) {
      return 'tar';
    }
    return 'unknown';
  }
}

function isZeroBlock(block: Buffer): boolean {
  for (let i = 0; i < block.length; i += 1) {
    if (block[i] !== 0) {
      return false;
    }
  }
  return true;
}

function readTarString(header: Buffer, start: number, length: number): string {
  const slice = header.subarray(start, start + length);
  let end = slice.indexOf(0);
  if (end < 0) {
    end = slice.length;
  }
  return slice.subarray(0, end).toString('utf8').trim();
}

function parseOctal(value: string): number {
  const cleaned = String(value || '').replace(/\0/g, '').trim();
  if (!cleaned) {
    return 0;
  }
  const parsed = Number.parseInt(cleaned, 8);
  return Number.isFinite(parsed) ? parsed : 0;
}
