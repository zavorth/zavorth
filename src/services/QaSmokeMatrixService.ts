import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import type {
  QaSmokeMatrixEntry,
  QaSmokeMatrixScope,
  QaSmokeMatrixSnapshot,
  QaSmokeMatrixStatus,
} from '../contracts/QaSmokeMatrixContract.js';
import { QA_SMOKE_MATRIX_CONTRACT_VERSION } from '../contracts/QaSmokeMatrixContract.js';
import { logger } from '../logger.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

type QaSmokeMatrixServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  now?: () => Date;
};

const DEFAULT_SMOKES: Array<{
  scope: QaSmokeMatrixScope;
  target: string;
  packageScript: string;
  command: string;
}> = [
  { scope: 'channel', target: 'channel-live-activation', packageScript: 'qa:channel-live-activation', command: 'npm run qa:channel-live-activation --silent' },
  { scope: 'channel', target: 'channel-long-tail-activation', packageScript: 'qa:channel-long-tail-activation', command: 'npm run qa:channel-long-tail-activation --silent' },
  { scope: 'provider', target: 'provider-runtime-activation', packageScript: 'qa:provider-runtime-activation', command: 'npm run qa:provider-runtime-activation --silent' },
  { scope: 'provider', target: 'provider-long-tail-activation', packageScript: 'qa:provider-long-tail-activation', command: 'npm run qa:provider-long-tail-activation --silent' },
  { scope: 'runtime', target: 'media-generation-live-plane', packageScript: 'qa:media-generation-live-plane', command: 'npm run qa:media-generation-live-plane --silent' },
  { scope: 'runtime', target: 'speech-voice-live-plane', packageScript: 'qa:speech-voice-live-plane', command: 'npm run qa:speech-voice-live-plane --silent' },
  { scope: 'runtime', target: 'web-research-live-plane', packageScript: 'qa:web-research-live-plane', command: 'npm run qa:web-research-live-plane --silent' },
  { scope: 'runtime', target: 'file-document-diff-live-plane', packageScript: 'qa:file-document-diff-live-plane', command: 'npm run qa:file-document-diff-live-plane --silent' },
  { scope: 'synthetic', target: 'deterministic-qa', packageScript: 'qa:deterministic', command: 'npm run qa:deterministic --silent' },
  { scope: 'test-support', target: 'runtime-check', packageScript: 'runtime:check', command: 'npm run runtime:check --silent' },
];

export class QaSmokeMatrixService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly now: () => Date;

  constructor(options: QaSmokeMatrixServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: {
    scope?: QaSmokeMatrixScope | 'all' | null;
  } = {}): QaSmokeMatrixSnapshot {
    const scope = input.scope || 'all';
    const entries = DEFAULT_SMOKES
      .filter((entry) => scope === 'all' || entry.scope === scope)
      .map((entry) => this.buildEntry(entry));
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: QA_SMOKE_MATRIX_CONTRACT_VERSION,
      status: blocked > 0 ? 'blocked' : attention > 0 ? 'attention' : 'ready',
      summary: {
        entries: entries.length,
        channel: entries.filter((entry) => entry.scope === 'channel').length,
        provider: entries.filter((entry) => entry.scope === 'provider').length,
        runtime: entries.filter((entry) => entry.scope === 'runtime').length,
        synthetic: entries.filter((entry) => entry.scope === 'synthetic').length,
        testSupport: entries.filter((entry) => entry.scope === 'test-support').length,
        ready: entries.filter((entry) => entry.status === 'ready').length,
        attention,
        blocked,
        externalIoRequired: false,
        secretValuesSerialized: false,
      },
      entries,
      receiptId: `qa.smoke-matrix.${scope}.receipt`,
    };
  }

  public runSmoke(input: {
    scope: QaSmokeMatrixScope;
    target?: string | null;
  }): {
    ok: boolean;
    scope: QaSmokeMatrixScope;
    target: string | null;
    command: string | null;
    status: QaSmokeMatrixStatus;
    liveIoPerformed: false;
    secretValuesSerialized: false;
  } {
    const snapshot = this.buildSnapshot({ scope: input.scope });
    const entry = snapshot.entries.find((item) => !input.target || item.target === input.target) || null;
    return {
      ok: Boolean(entry && entry.status !== 'blocked'),
      scope: input.scope,
      target: entry?.target || input.target || null,
      command: entry?.command || null,
      status: entry?.status || 'blocked',
      liveIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private buildEntry(input: typeof DEFAULT_SMOKES[number]): QaSmokeMatrixEntry {
    const scripts = this.readPackageJson()?.scripts || {};
    const scriptValue = String(scripts[input.packageScript] || '').trim();
    return {
      id: `qa.${input.scope}.${input.target}`,
      scope: input.scope,
      target: input.target,
      command: input.command,
      packageScript: input.packageScript,
      status: scriptValue ? 'ready' : 'blocked',
      evidence: [
        scriptValue ? `package script ${input.packageScript} is present` : `missing package script ${input.packageScript}`,
        'default smoke matrix does not require external IO',
      ],
    };
  }

  private readPackageJson(): PackageLike | null {
    if (this.packageJson) return this.packageJson;
    const packagePath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packagePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageLike;
    } catch (error: any) { logger.warn('[Qa Smoke Matrix] JSON parse failed', error); return null; }
  }
}
