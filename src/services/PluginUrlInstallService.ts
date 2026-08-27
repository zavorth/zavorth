import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import {
  fetchPublicHttpsBuffer,
  validatePublicHttpsUrl,
} from '../security/PublicHttpsFetch.js';

const MAX_PLUGIN_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_PLUGIN_REDIRECTS = 5;

import { PluginArchiveExtractService } from './PluginArchiveExtractService.js';
import {
  PluginSignatureService,
  type PluginVerifyResult,
  type PluginVerifyOptions,
} from './PluginSignatureService.js';

export type PluginUrlDownloadResult = {
  ok: boolean;
  archivePath?: string;
  extractDir?: string;
  pluginId?: string;
  packageDir?: string;
  error?: string;
  bytes?: number;
  verify?: PluginVerifyResult;
  extractMethod?: string;
};

export type PluginUrlInstallRuntime = {
  now?: () => Date;
  projectRoot?: string;
  fetchBuffer?: (url: string) => Promise<Buffer>;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  rmSync?: typeof fs.rmSync;
  spawnSyncFn?: typeof spawnSync;
  networkEnabled?: boolean;
  archiveExtract?: PluginArchiveExtractService;
  signatureService?: PluginSignatureService;
  verifyOptions?: PluginVerifyOptions;
};

export class PluginUrlInstallService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly fetchBuffer: (url: string) => Promise<Buffer>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly rmSync: typeof fs.rmSync;
  private readonly spawnSyncFn: typeof spawnSync;
  private readonly networkEnabled: boolean;
  private readonly archiveExtract: PluginArchiveExtractService;
  private readonly signatureService: PluginSignatureService;
  private readonly verifyOptions: PluginVerifyOptions;

  constructor(runtime: PluginUrlInstallRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.fetchBuffer = runtime.fetchBuffer || ((url) => fetchPublicHttpsBuffer(url, {
      maxBytes: MAX_PLUGIN_DOWNLOAD_BYTES,
      maxRedirects: MAX_PLUGIN_REDIRECTS,
      timeoutMs: 60_000,
    }));
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.rmSync = runtime.rmSync || fs.rmSync.bind(fs);
    this.spawnSyncFn = runtime.spawnSyncFn || spawnSync;
    this.networkEnabled = runtime.networkEnabled !== false
      && process.env.ZAVORTH_DISABLE_NETWORK !== '1'
      && process.env.ZAVORTH_OFFLINE !== '1';
    this.archiveExtract = runtime.archiveExtract || new PluginArchiveExtractService({
      existsSync: this.existsSync,
      mkdirSync: this.mkdirSync,
      writeFileSync: this.writeFileSync,
      readFileSync: this.readFileSync,
      spawnSyncFn: this.spawnSyncFn,
      // Remote archives are untrusted. Pure extraction enforces entry paths and
      // never materializes archive symlinks.
      preferSystemTools: false,
    });
    this.signatureService = runtime.signatureService || new PluginSignatureService({
      existsSync: this.existsSync,
      readFileSync: this.readFileSync,
      readdirSync: this.readdirSync,
    });
    this.verifyOptions = runtime.verifyOptions || {};
  }

  public isUrlSpec(spec: string): boolean {
    return /^https?:\/\//iu.test(String(spec || '').trim());
  }

  public async downloadAndExtract(urlSpec: string): Promise<PluginUrlDownloadResult> {
    const url = String(urlSpec || '').trim();
    if (!this.isUrlSpec(url)) {
      return { ok: false, error: 'Spec is not an http(s) URL.' };
    }
    const urlPolicyError = validatePublicHttpsUrl(url);
    if (urlPolicyError) {
      return { ok: false, error: urlPolicyError };
    }
    if (!this.networkEnabled) {
      return {
        ok: false,
        error: 'Network is disabled (ZAVORTH_DISABLE_NETWORK/ZAVORTH_OFFLINE). Cannot download plugin URL.',
      };
    }

    const cacheDir = path.join(this.projectRoot, '.zavorth', 'cache', 'plugin-downloads');
    this.mkdirSync(cacheDir, { recursive: true });
    const stamp = createHash('sha256').update(`${url}|${this.now().toISOString()}`).digest('hex').slice(0, 12);
    const urlPath = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })();
    const baseName = path.basename(urlPath || 'plugin.tgz') || 'plugin.tgz';
    const archivePath = path.join(cacheDir, `${stamp}-${baseName}`);
    const extractDir = path.join(cacheDir, `${stamp}-extract`);

    let buffer: Buffer;
    try {
      buffer = await this.fetchBuffer(url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `Download failed: ${message}` };
    }
    if (buffer.length > MAX_PLUGIN_DOWNLOAD_BYTES) {
      return {
        ok: false,
        error: `Plugin download exceeds ${MAX_PLUGIN_DOWNLOAD_BYTES} bytes.`,
      };
    }

    this.writeFileSync(archivePath, buffer);
    this.mkdirSync(extractDir, { recursive: true });

    const extractError = this.extractArchive(archivePath, extractDir, baseName);
    if (extractError.error) {
      return {
        ok: false,
        archivePath,
        extractDir,
        bytes: buffer.length,
        error: extractError.error,
        extractMethod: extractError.method,
      };
    }

    const packageRoot = this.findPackageRoot(extractDir);
    if (!packageRoot) {
      return {
        ok: false,
        archivePath,
        extractDir,
        bytes: buffer.length,
        error: 'Extracted archive does not contain a Plugin OS package (manifest.json or index.js).',
        extractMethod: extractError.method,
      };
    }

    const verify = this.signatureService.verifyPackage(packageRoot, this.verifyOptions);
    if (!verify.ok) {
      return {
        ok: false,
        archivePath,
        extractDir,
        bytes: buffer.length,
        error: `Signature verification failed (${verify.status}): ${verify.findings.join('; ')}`,
        verify,
        extractMethod: extractError.method,
      };
    }

    const pluginId = this.readPluginId(packageRoot) || this.slugFromUrl(url);
    const packagesRoot = path.resolve(this.projectRoot, '.zavorth', 'plugins');
    const packageDir = path.resolve(packagesRoot, pluginId);
    if (!isInside(packagesRoot, packageDir) || packageDir === packagesRoot) {
      return { ok: false, error: `Unsafe plugin id rejected: ${pluginId}` };
    }
    this.mkdirSync(packagesRoot, { recursive: true });
    if (this.existsSync(packageDir)) {
      try {
        this.rmSync(packageDir, { recursive: true, force: true });
      } catch {
        /* soft-fail overwrite */
      }
    }
    this.copyDir(packageRoot, packageDir);

    return {
      ok: true,
      archivePath,
      extractDir,
      pluginId,
      packageDir,
      bytes: buffer.length,
      verify,
      extractMethod: extractError.method,
    };
  }

  /**
   * Verify an already-extracted local package directory (optional local install path check).
   */
  public verifyLocalPackage(
    packageDir: string,
    options?: PluginVerifyOptions,
  ): PluginVerifyResult {
    return this.signatureService.verifyPackage(packageDir, options || this.verifyOptions);
  }

  private extractArchive(
    archivePath: string,
    extractDir: string,
    baseName: string,
  ): { error: string | null; method?: string } {
    const lower = baseName.toLowerCase();
    if (lower.endsWith('.zip') || lower.endsWith('.tgz') || lower.endsWith('.tar.gz') || lower.endsWith('.tar')) {
      const result = this.archiveExtract.extract(archivePath, extractDir, { baseName });
      if (!result.ok) {
        return { error: result.error || 'extract failed', method: result.method };
      }
      return { error: null, method: result.method };
    }
    // Treat as a single-file package payload when not an archive.
    try {
      const dest = path.join(extractDir, baseName);
      this.writeFileSync(dest, this.readFileSync(archivePath));
      return { error: null, method: 'raw' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `Unable to place downloaded file: ${message}`, method: 'raw' };
    }
  }

  private findPackageRoot(extractDir: string): string | null {
    const queue = [extractDir];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const manifest = path.join(current, 'manifest.json');
      const legacy = path.join(current, 'zavorth.plugin.json');
      const indexJs = path.join(current, 'index.js');
      if (this.existsSync(manifest) || this.existsSync(legacy) || this.existsSync(indexJs)) {
        return current;
      }
      let entries: string[] = [];
      try {
        entries = this.readdirSync(current);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git') {
          continue;
        }
        const child = path.join(current, entry);
        try {
          const stat = fs.lstatSync(child);
          if (stat.isSymbolicLink()) {
            continue;
          }
          if (stat.isDirectory()) {
            queue.push(child);
          }
        } catch {
          /* skip */
        }
      }
    }
    return null;
  }

  private readPluginId(packageDir: string): string | null {
    for (const name of ['manifest.json', 'zavorth.plugin.json', 'plugin.json', 'package.json']) {
      const file = path.join(packageDir, name);
      if (!this.existsSync(file)) {
        continue;
      }
      try {
        const raw = JSON.parse(this.readFileSync(file, 'utf8')) as Record<string, unknown>;
        const id = String(raw.id || raw.name || '').trim();
        if (id) {
          return this.normalizeId(id);
        }
      } catch {
        /* soft-fail */
      }
    }
    return null;
  }

  private slugFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const base = path.basename(pathname).replace(/\.(tgz|tar\.gz|tar|zip)$/iu, '');
      return this.normalizeId(base) || `url-plugin-${Date.now()}`;
    } catch {
      return `url-plugin-${Date.now()}`;
    }
  }

  private copyDir(source: string, destination: string): void {
    this.mkdirSync(destination, { recursive: true });
    for (const entry of this.readdirSync(source)) {
      const from = path.join(source, entry);
      const to = path.join(destination, entry);
      const stat = fs.lstatSync(from);
      if (stat.isSymbolicLink()) {
        throw new Error(`Plugin package symlink rejected: ${entry}`);
      }
      if (stat.isDirectory()) {
        this.copyDir(from, to);
      } else {
        this.writeFileSync(to, this.readFileSync(from));
      }
    }
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/\.{2,}/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 128);
  }
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
