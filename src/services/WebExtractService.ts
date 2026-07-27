
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type WebExtractMode = 'fetch' | 'readability' | 'crawl' | 'browser-capture';

export type WebExtractArtifactRef = {
  artifactId: string;
  contentType: string;
  storageRef: string;
};

export type WebExtractProviderEvidence = {
  providerId: string;
  mode: WebExtractMode;
  target: string;
  metadata: Record<string, unknown>;
};

export type WebExtractPolicyDecision = {
  allowed: boolean;
  reason: string;
  robotsPolicy: 'respect' | 'operator-approved';
  maxPages: number;
  maxBytes: number;
  browserLaunchAllowed: boolean;
};

export type WebExtractLimits = {
  maxPages: number;
  maxLinks: number;
  maxChars: number;
  maxBytes: number;
  timeoutMs: number;
};

export type WebExtractLiveAdapterInput = {
  mode: WebExtractMode;
  target: string;
  limits: WebExtractLimits;
  policyDecision: WebExtractPolicyDecision;
};

export type WebExtractLiveAdapterOutput = {
  title: string;
  text: string;
  html?: string | null;
  links: string[];
  screenshot?: Buffer | null;
  contentType: string;
  providerEvidence: WebExtractProviderEvidence;
};

export interface IWebExtractLiveAdapter {
  readonly adapterId: string;
  readonly providerId: string;
  readonly supportedModes: readonly WebExtractMode[];
  extract(input: WebExtractLiveAdapterInput): Promise<WebExtractLiveAdapterOutput>;
}

export type WebExtractLiveResult = {
  ok: boolean;
  mode: WebExtractMode;
  target: string;
  artifact: WebExtractArtifactRef | null;
  screenshotArtifact: WebExtractArtifactRef | null;
  title: string | null;
  textLength: number;
  links: string[];
  policyDecision: WebExtractPolicyDecision;
  providerEvidence: WebExtractProviderEvidence | null;
  receiptId: string;
  processedAt: string;
  error: string | null;
};

export type WebExtractPlan = {
  ok: boolean;
  mode: WebExtractMode;
  target: string;
  outputArtifactId: string;
  receiptId: string;
  networkCallRequired: false;
  browserLaunchRequired: false;
  secretValuesSerialized: false;
  summary: string;
};

type WebExtractServiceOptions = {
  artifactDir?: string;
  adapters?: IWebExtractLiveAdapter[];
  now?: () => Date;
};

export class WebExtractService {
  private readonly artifactDir: string;
  private readonly adapters: Map<string, IWebExtractLiveAdapter>;
  private readonly now: () => Date;

  constructor(options: WebExtractServiceOptions = {}) {
    this.artifactDir = options.artifactDir || path.join(config.dataDir, 'artifacts', 'web-extract');
    this.adapters = new Map();
    for (const adapter of options.adapters || []) {
      this.adapters.set(adapter.adapterId, adapter);
    }
    this.now = options.now || (() => new Date());
  }

  public buildPlan(input: {
    mode: WebExtractMode;
    target: string;
  }): WebExtractPlan {
    const target = String(input.target || '').trim() || 'about:blank';
    const normalized = target
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'target';

    return {
      ok: true,
      mode: input.mode,
      target,
      outputArtifactId: `web.extract.${input.mode}.${normalized}`,
      receiptId: `web.extract.${input.mode}.${normalized}.receipt`,
      networkCallRequired: false,
      browserLaunchRequired: false,
      secretValuesSerialized: false,
      summary: `${input.mode} extraction envelope planned without live network or browser IO.`,
    };
  }

  public async executeLive(input: {
    mode: WebExtractMode;
    target: string;
    adapterId?: string | null;
    limits?: Partial<WebExtractLimits>;
    allowBrowserLaunch?: boolean;
  }): Promise<WebExtractLiveResult> {
    const processedAt = this.now().toISOString();
    const target = String(input.target || '').trim();
    const mode = input.mode;
    const policyDecision = this.evaluatePolicy(mode, target, input.limits, Boolean(input.allowBrowserLaunch));
    if (!policyDecision.allowed) {
      return this.errorResult(mode, target, policyDecision, processedAt, policyDecision.reason);
    }

    const adapter = this.selectAdapter(mode, input.adapterId || null);
    if (!adapter) {
      return this.errorResult(mode, target, policyDecision, processedAt, `No live web extraction adapter is configured for ${mode}.`);
    }

    try {
      const output = await adapter.extract({
        mode,
        target,
        limits: {
          maxPages: policyDecision.maxPages,
          maxLinks: input.limits?.maxLinks || 25,
          maxChars: input.limits?.maxChars || 12_000,
          maxBytes: policyDecision.maxBytes,
          timeoutMs: input.limits?.timeoutMs || 15_000,
        },
        policyDecision,
      });
      const artifact = await this.storeExtractionArtifact(mode, target, output);
      const screenshotArtifact = output.screenshot
        ? await this.storeBinaryArtifact('web.screenshot', 'image/png', output.screenshot)
        : null;
      return {
        ok: true,
        mode,
        target,
        artifact,
        screenshotArtifact,
        title: output.title || null,
        textLength: output.text.length,
        links: output.links,
        policyDecision,
        providerEvidence: output.providerEvidence,
        receiptId: `${artifact.artifactId}.receipt`,
        processedAt,
        error: null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Web Extract] operation failed', error);
    return this.errorResult(
        mode,
        target,
        policyDecision,
        processedAt,
        error instanceof Error ? err.message : String(error),
      );
  }
  }

  private evaluatePolicy(
    mode: WebExtractMode,
    target: string,
    limits: Partial<WebExtractLimits> | undefined,
    allowBrowserLaunch: boolean,
  ): WebExtractPolicyDecision {
    if (!/^https?:\/\//i.test(target)) {
      return {
        allowed: false,
        reason: 'web.extract live execution requires an http(s) target.',
        robotsPolicy: 'respect',
        maxPages: 0,
        maxBytes: 0,
        browserLaunchAllowed: false,
      };
    }

    const browserLaunchAllowed = mode !== 'browser-capture' || allowBrowserLaunch;
    return {
      allowed: browserLaunchAllowed,
      reason: browserLaunchAllowed ? 'Network extraction allowed under crawl limits and robots policy.'
        : 'browser-capture requires explicit browser launch approval.',
      robotsPolicy: 'respect',
      maxPages: Math.min(Math.max(limits?.maxPages || 1, 1), 10),
      maxBytes: Math.min(Math.max(limits?.maxBytes || 1_500_000, 1), 5_000_000),
      browserLaunchAllowed,
    };
  }

  private selectAdapter(mode: WebExtractMode, adapterId: string | null): IWebExtractLiveAdapter | null {
    if (adapterId) {
      const selected = this.adapters.get(adapterId);
      if (selected?.supportedModes.includes(mode)) {
        return selected;
      }
    }
    for (const adapter of this.adapters.values()) {
      if (adapter.supportedModes.includes(mode)) {
        return adapter;
      }
    }
    return null;
  }

  private async storeExtractionArtifact(
    mode: WebExtractMode,
    target: string,
    output: WebExtractLiveAdapterOutput,
  ): Promise<WebExtractArtifactRef> {
    await fs.promises.mkdir(this.artifactDir, { recursive: true });
    const artifactId = `web.extract.${mode}.${randomUUID()}`;
    const storageRef = path.join(this.artifactDir, `${artifactId}.json`);
    await fs.promises.writeFile(
      storageRef,
      JSON.stringify({
        artifactId,
        mode,
        target,
        title: output.title,
        text: output.text,
        html: output.html || null,
        links: output.links,
        providerEvidence: output.providerEvidence,
        generatedAt: this.now().toISOString(),
        secretValuesSerialized: false,
      }, null, 2),
      'utf8',
    );
    return {
      artifactId,
      contentType: 'application/json',
      storageRef,
    };
  }

  private async storeBinaryArtifact(
    prefix: string,
    contentType: string,
    data: Buffer,
  ): Promise<WebExtractArtifactRef> {
    await fs.promises.mkdir(this.artifactDir, { recursive: true });
    const artifactId = `${prefix}.${randomUUID()}.png`;
    const storageRef = path.join(this.artifactDir, artifactId);
    await fs.promises.writeFile(storageRef, data);
    return {
      artifactId,
      contentType,
      storageRef,
    };
  }

  private errorResult(
    mode: WebExtractMode,
    target: string,
    policyDecision: WebExtractPolicyDecision,
    processedAt: string,
    error: string,
  ): WebExtractLiveResult {
    return {
      ok: false,
      mode,
      target,
      artifact: null,
      screenshotArtifact: null,
      title: null,
      textLength: 0,
      links: [],
      policyDecision,
      providerEvidence: null,
      receiptId: `web.extract.${mode}.blocked.receipt`,
      processedAt,
      error,
    };
  }
}
