import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { config } from '../../config/index.js';

export interface PublishOptions {
  packagePath: string;
  authToken?: string;
  signLocal: boolean;
  requestedBy?: string;
}

export type PublishResult = {
  ok: boolean;
  releaseId: string;
  packageId: string;
  version: string;
  signature: string;
  packageSha256: string;
  fileCount: number;
  outputFile: string;
  uploadStatus: 'prepared' | 'published';
};

type PublisherRuntime = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  registryEndpoint?: string;
  outputDir?: string;
};

export class ZavorthPackagePublisher {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly registryEndpoint: string;
  private readonly outputDir: string;

  constructor(runtime: string | PublisherRuntime = 'https://registry.zavorth.ai/v1/publish') {
    const resolvedRuntime = typeof runtime === 'string'
      ? { registryEndpoint: runtime }
      : runtime;
    this.now = resolvedRuntime.now || (() => new Date());
    this.fetchImpl = resolvedRuntime.fetchImpl || globalThis.fetch || null;
    this.existsSync = resolvedRuntime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = resolvedRuntime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = resolvedRuntime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = resolvedRuntime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readdirSync = resolvedRuntime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = resolvedRuntime.statSync || fs.statSync.bind(fs);
    this.registryEndpoint = String(
      resolvedRuntime.registryEndpoint || 'https://registry.zavorth.ai/v1/publish',
    ).trim();
    this.outputDir = resolvedRuntime.outputDir
      || path.resolve(config.projectRoot, 'data', 'runtime', 'platform-publish');
  }

  public async publish(options: PublishOptions): Promise<string> {
    const result = await this.publishDetailed(options);
    return result.releaseId;
  }

  public async publishDetailed(options: PublishOptions): Promise<PublishResult> {
    const packageRoot = path.resolve(String(options.packagePath || '').trim());
    const manifestPath = path.join(packageRoot, 'plugin.json');
    if (!this.existsSync(manifestPath)) {
      throw new Error('plugin.json not found. Not a valid Zavorth extension.');
    }

    const manifest = JSON.parse(this.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    const packageId = String(manifest.id || '').trim();
    const version = String(manifest.version || '').trim();
    if (!packageId || !version) {
      throw new Error('plugin.json precisa de id e version.');
    }

    const inventory = this.collectInventory(packageRoot);
    const packageSha256 = sha256Hex(JSON.stringify({
      manifest,
      inventory,
    }));
    const signature = options.signLocal
      ? `sha256:${packageSha256}`
      : `unsigned:${packageSha256}`;
    const releaseId = `${packageId}@${version}`;
    const timestamp = this.now().toISOString().replace(/[:.]/g, '-');
    const packageDir = path.join(this.outputDir, sanitizeForPath(packageId));
    const outputFile = path.join(packageDir, `${timestamp}.json`);
    const payload = {
      releaseId,
      packageId,
      version,
      manifest,
      fileCount: inventory.length,
      inventory,
      packageSha256,
      signature,
      preparedAt: this.now().toISOString(),
      registryEndpoint: this.registryEndpoint,
    };
    this.mkdirSync(packageDir, { recursive: true });
    this.writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf8');

    let uploadStatus: PublishResult['uploadStatus'] = 'prepared';
    if (this.fetchImpl && this.registryEndpoint && String(options.authToken || '').trim()) {
      try {
        const response = await this.fetchImpl(this.registryEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: String(options.authToken || '').trim(),
          },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          uploadStatus = 'published';
        }
      } catch (error: any) { const err = error; const e = error;
        uploadStatus = 'prepared';
      }
    }

    return {
      ok: true,
      releaseId,
      packageId,
      version,
      signature,
      packageSha256,
      fileCount: inventory.length,
      outputFile,
      uploadStatus,
    };
  }

  private collectInventory(packageRoot: string): Array<{ path: string; sha256: string; size: number }> {
    const inventory: Array<{ path: string; sha256: string; size: number }> = [];
    const walk = (currentDir: string) => {
      for (const entry of this.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path.join(currentDir, entry.name);
        const relativePath = path.relative(packageRoot, absolutePath).replace(/\\/g, '/');
        if (!relativePath || relativePath.startsWith('.git/')) {
          continue;
        }
        if (entry.isDirectory()) {
          walk(absolutePath);
          continue;
        }
        const stat = this.statSync(absolutePath);
        const contents = this.readFileSync(absolutePath);
        inventory.push({
          path: relativePath,
          sha256: sha256Buffer(contents),
          size: Number(stat.size || 0),
        });
      }
    };
    walk(packageRoot);
    return inventory.sort((left, right) => left.path.localeCompare(right.path, 'en-US'));
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(String(input || ''), 'utf8').digest('hex');
}

function sha256Buffer(input: Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function sanitizeForPath(value: string): string {
  return String(value || '')
    .replace(/[^a-z0-9_\-.@]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
