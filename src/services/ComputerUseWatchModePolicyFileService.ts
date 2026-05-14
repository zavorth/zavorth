import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  WatchModeRunBudget,
  WatchModeScreenshotRedactionMode,
  WatchModeSensitiveScreenPolicy,
} from './computer-use-watch-mode/ComputerUseWatchModeSharedTypes.js';

export type ComputerUseWatchModePolicyDocument = {
  version: number;
  updatedAt: string | null;
  strictApprovalDefault: boolean;
  allowedApps: string[];
  allowedSites: string[];
  screenshotTtlMs: number;
  maxScreenshotBytes: number;
  screenshotRedactionMode: WatchModeScreenshotRedactionMode;
  sensitiveScreenPolicy: WatchModeSensitiveScreenPolicy;
  defaultBudget: WatchModeRunBudget;
};

type ComputerUseWatchModePolicyFileRuntime = {
  now?: () => Date;
  projectRoot?: string;
  policyFile?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

const DEFAULT_POLICY: ComputerUseWatchModePolicyDocument = {
  version: 1,
  updatedAt: null,
  strictApprovalDefault: true,
  allowedApps: [],
  allowedSites: [],
  screenshotTtlMs: 24 * 60 * 60 * 1000,
  maxScreenshotBytes: 250 * 1024 * 1024,
  screenshotRedactionMode: 'redacted',
  sensitiveScreenPolicy: 'pause',
  defaultBudget: {
    maxIterations: 8,
    maxDurationMs: 10 * 60 * 1000,
    maxScreenshots: 24,
    maxMemoryMb: 512,
    idleTtlMs: 2 * 60 * 1000,
    delayBetweenActionsMs: 1200,
    screenshotTtlMs: 24 * 60 * 60 * 1000,
    maxScreenshotBytes: 250 * 1024 * 1024,
    screenshotRedactionMode: 'redacted',
    sensitiveScreenPolicy: 'pause',
  },
};

export class ComputerUseWatchModePolicyFileService {
  private readonly now: () => Date;
  private readonly policyFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: ComputerUseWatchModePolicyFileRuntime = {}) {
    const projectRoot = runtime.projectRoot || config.projectRoot;
    this.now = runtime.now || (() => new Date());
    this.policyFile = runtime.policyFile || path.join(projectRoot, 'config', 'watch-mode-policy.json');
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readPolicy(): ComputerUseWatchModePolicyDocument {
    try {
      if (!this.existsSyncImpl(this.policyFile)) {
        return { ...DEFAULT_POLICY };
      }
      return this.normalizeDocument(JSON.parse(this.readFileSyncImpl(this.policyFile, 'utf8')) as Record<string, any>);
    } catch {
      return { ...DEFAULT_POLICY };
    }
  }

  public savePolicy(input: Partial<ComputerUseWatchModePolicyDocument>): ComputerUseWatchModePolicyDocument {
    const normalized = this.normalizeDocument({
      ...this.readPolicy(),
      ...input,
      updatedAt: this.now().toISOString(),
    });
    this.mkdirSyncImpl(path.dirname(this.policyFile), { recursive: true });
    this.writeFileSyncImpl(this.policyFile, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  }

  public setStrictApprovalDefault(value: boolean): ComputerUseWatchModePolicyDocument {
    return this.savePolicy({
      strictApprovalDefault: value === true,
    });
  }

  public allowApp(app: string): ComputerUseWatchModePolicyDocument {
    const current = this.readPolicy();
    return this.savePolicy({
      allowedApps: [...current.allowedApps, app],
    });
  }

  public allowSite(site: string): ComputerUseWatchModePolicyDocument {
    const current = this.readPolicy();
    return this.savePolicy({
      allowedSites: [...current.allowedSites, site],
    });
  }

  private normalizeDocument(raw: Partial<ComputerUseWatchModePolicyDocument>): ComputerUseWatchModePolicyDocument {
    return {
      version: Number.isFinite(raw.version) ? Number(raw.version) : 1,
      updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
        ? raw.updatedAt.trim()
        : null,
      strictApprovalDefault: raw.strictApprovalDefault !== false,
      allowedApps: this.normalizeAppList(raw.allowedApps),
      allowedSites: this.normalizeSiteList(raw.allowedSites),
      screenshotTtlMs: this.positiveNumber(raw.screenshotTtlMs, DEFAULT_POLICY.screenshotTtlMs),
      maxScreenshotBytes: this.positiveNumber(raw.maxScreenshotBytes, DEFAULT_POLICY.maxScreenshotBytes),
      screenshotRedactionMode: this.normalizeRedactionMode(raw.screenshotRedactionMode),
      sensitiveScreenPolicy: this.normalizeSensitiveScreenPolicy(raw.sensitiveScreenPolicy),
      defaultBudget: this.normalizeBudget(raw.defaultBudget),
    };
  }

  private normalizeBudget(value: unknown): WatchModeRunBudget {
    const raw = value && typeof value === 'object' ? value as Partial<WatchModeRunBudget> : {};
    const screenshotTtlMs = this.positiveNumber(raw.screenshotTtlMs, this.positiveNumber((value as any)?.screenshotTtlMs, DEFAULT_POLICY.screenshotTtlMs));
    const maxScreenshotBytes = this.positiveNumber(raw.maxScreenshotBytes, DEFAULT_POLICY.maxScreenshotBytes);
    return {
      maxIterations: this.positiveNumber(raw.maxIterations, DEFAULT_POLICY.defaultBudget.maxIterations),
      maxDurationMs: this.positiveNumber(raw.maxDurationMs, DEFAULT_POLICY.defaultBudget.maxDurationMs),
      maxScreenshots: this.positiveNumber(raw.maxScreenshots, DEFAULT_POLICY.defaultBudget.maxScreenshots),
      maxMemoryMb: this.positiveNumber(raw.maxMemoryMb, DEFAULT_POLICY.defaultBudget.maxMemoryMb),
      idleTtlMs: this.positiveNumber(raw.idleTtlMs, DEFAULT_POLICY.defaultBudget.idleTtlMs),
      delayBetweenActionsMs: this.positiveNumber(raw.delayBetweenActionsMs, DEFAULT_POLICY.defaultBudget.delayBetweenActionsMs),
      screenshotTtlMs,
      maxScreenshotBytes,
      screenshotRedactionMode: this.normalizeRedactionMode(raw.screenshotRedactionMode),
      sensitiveScreenPolicy: this.normalizeSensitiveScreenPolicy(raw.sensitiveScreenPolicy),
    };
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : fallback;
  }

  private normalizeRedactionMode(value: unknown): WatchModeScreenshotRedactionMode {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'metadata-only' || normalized === 'raw') {
      return normalized;
    }
    return 'redacted';
  }

  private normalizeSensitiveScreenPolicy(value: unknown): WatchModeSensitiveScreenPolicy {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'redact' || normalized === 'allow') {
      return normalized;
    }
    return 'pause';
  }

  private normalizeAppList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((entry) => this.normalizeApp(entry))
      .filter((entry, index, list) => Boolean(entry) && list.indexOf(entry) === index);
  }

  private normalizeSiteList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((entry) => this.normalizeSite(entry))
      .filter((entry, index, list) => Boolean(entry) && list.indexOf(entry) === index);
  }

  private normalizeApp(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private normalizeSite(value: unknown): string {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) {
      return '';
    }
    try {
      const target = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
      return new URL(target).hostname.trim().toLowerCase();
    } catch {
      return raw
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/u, '')
        .replace(/^\.+/u, '')
        .trim()
        .toLowerCase();
    }
  }
}
