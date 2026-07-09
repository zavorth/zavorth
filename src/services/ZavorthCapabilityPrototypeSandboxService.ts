import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION,
  type ZavorthCapabilityPrototypeArtifact,
  type ZavorthCapabilityPrototypeReceipt,
  type ZavorthCapabilityPrototypeRecord,
  type ZavorthCapabilityPrototypeSandboxRunInput,
  type ZavorthCapabilityPrototypeSandboxSnapshot,
  type ZavorthCapabilityPrototypeStatus,
} from '../contracts/ZavorthCapabilityPrototypeSandboxContract.js';
import type { SandboxExecutionReceipt } from '../contracts/SandboxExecutionReceiptContract.js';
import type { ZavorthCapabilityCandidate } from '../contracts/ZavorthCapabilityCandidateRegistryContract.js';
import { SandboxExecutionReceiptService } from './SandboxExecutionReceiptService.js';
import { ZavorthCapabilityCandidateRegistryService } from './ZavorthCapabilityCandidateRegistryService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  storeFile?: string;
  prototypeRoot?: string;
  registry?: Pick<ZavorthCapabilityCandidateRegistryService, 'snapshot'>;
};

type Store = {
  contractVersion: typeof ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION;
  updatedAt: string;
  prototypes: ZavorthCapabilityPrototypeRecord[];
  receipts: ZavorthCapabilityPrototypeReceipt[];
};

const MAX_STORE_BYTES = 3 * 1024 * 1024;
const MAX_RECEIPTS = 500;

export class ZavorthCapabilityPrototypeSandboxService {
  private readonly projectRoot: string;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly storeFile: string;
  private readonly prototypeRoot: string;
  private readonly registry: Pick<ZavorthCapabilityCandidateRegistryService, 'snapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => new Date());
    const paths = new ZavorthHomePathService({ projectRoot: this.projectRoot, env: this.env }).resolvePaths();
    this.storeFile = path.resolve(runtime.storeFile || path.join(paths.runtimeDir, 'capability-prototypes.json'));
    this.prototypeRoot = path.resolve(runtime.prototypeRoot || path.join(paths.runtimeDir, 'capability-prototypes'));
    this.registry = runtime.registry || new ZavorthCapabilityCandidateRegistryService({
      projectRoot: this.projectRoot,
      env: this.env,
      now: this.now,
    });
  }

  public snapshot(): ZavorthCapabilityPrototypeSandboxSnapshot {
    return this.buildSnapshot(this.readStore());
  }

  public prototype(input: ZavorthCapabilityPrototypeSandboxRunInput = {}): ZavorthCapabilityPrototypeSandboxSnapshot {
    const actor = clean(input.actor || 'operator');
    const selected = this.selectCandidates(input);
    const store = this.readStore();
    if (selected.length === 0) {
      store.receipts.push(this.receipt(actor, 'skipped', null, null, 'No prototype_ready capability candidate was selected.'));
      this.writeStore(store);
      return this.buildSnapshot(store);
    }

    for (const candidate of selected) {
      const existing = store.prototypes.find((entry) => entry.candidateId === candidate.id);
      if (existing) {
        store.receipts.push(this.receipt(actor, 'skipped', candidate.id, existing.id, 'Sandbox prototype already exists for this candidate.'));
        continue;
      }
      if (candidate.status !== 'prototype_ready') {
        store.receipts.push(this.receipt(actor, 'blocked', candidate.id, null, 'Candidate must be prototype_ready before sandbox prototyping.'));
        continue;
      }
      const record = this.createPrototype(candidate);
      store.prototypes.push(record);
      store.receipts.push(this.receipt(actor, 'applied', candidate.id, record.id, 'Preview-only sandbox prototype generated.'));
    }
    this.writeStore(store);
    return this.buildSnapshot(store);
  }

  public renderText(snapshot = this.snapshot()): string {
    const lines = [
      'Zavorth Capability Prototype Sandbox',
      '',
      `status=${snapshot.status}`,
      `store=${snapshot.storeFile}`,
      `root=${snapshot.prototypeRoot}`,
      `prototypes=${snapshot.summary.prototypes} simulated=${snapshot.summary.simulated} skipped=${snapshot.summary.skipped} blocked=${snapshot.summary.blocked}`,
      '',
      'Prototypes:',
    ];
    if (snapshot.prototypes.length === 0) lines.push('- none generated');
    for (const prototype of snapshot.prototypes) {
      lines.push(`- ${prototype.id} [${prototype.status}] ${prototype.title}`);
      lines.push(`  workspace=${prototype.workspaceDir}`);
      lines.push(`  next=${prototype.nextSafeAction}`);
    }
    lines.push('', 'Safety: sandbox workspace only; no install, tool exposure or live activation occurred.');
    return lines.join('\n');
  }

  private selectCandidates(input: ZavorthCapabilityPrototypeSandboxRunInput): ZavorthCapabilityCandidate[] {
    const registry = input.registry || this.registry.snapshot();
    const candidates = Array.isArray(registry.candidates) ? registry.candidates : [];
    const ids = new Set((input.candidateIds || []).map(clean).filter(Boolean));
    return candidates.filter((candidate) => {
      if (candidate.status !== 'prototype_ready') return false;
      return input.allReady || ids.has(candidate.id);
    });
  }

  private createPrototype(candidate: ZavorthCapabilityCandidate): ZavorthCapabilityPrototypeRecord {
    const timestamp = this.timestamp();
    const prototypeId = `capability-prototype:${safeId(candidate.id)}`;
    const workspaceDir = this.resolveWorkspace(candidate.id);
    fs.mkdirSync(workspaceDir, { recursive: true });

    const sandboxReceipt = new SandboxExecutionReceiptService({ now: this.now }).createReceipt({
      backend: 'preview-only',
      command: `zavorth capability prototype ${candidate.id}`,
      timeoutMs: 60_000,
      memoryMb: 256,
      cpuCount: 1,
      pidsLimit: 16,
      networkPolicy: 'none',
      mountPolicy: 'tmp-only',
      cleanupStatus: 'preview_only',
      previewOnlyFallback: true,
    });
    const manifest = {
      contractVersion: 'capability-prototype-manifest/1',
      generatedAt: timestamp,
      prototypeId,
      candidate: {
        id: candidate.id,
        title: candidate.title,
        summary: candidate.summary,
        category: candidate.category,
        tags: candidate.tags,
        sourceIds: candidate.sourceIds,
      },
      sandbox: {
        backend: sandboxReceipt.backend,
        networkPolicy: sandboxReceipt.networkPolicy,
        mountPolicy: sandboxReceipt.mountPolicy,
        hostWorkspaceWrites: false,
        liveActivation: false,
      },
      nextStage: 'Run eval, canary and security checks before any Action Harness exposure.',
    };
    const notes = [
      `# ${candidate.title}`,
      '',
      redact(candidate.summary) || 'No summary supplied.',
      '',
      'Prototype boundary:',
      '- workspace is isolated under ZAVORTH_HOME runtime;',
      '- network is disabled by default;',
      '- no tool is exposed;',
      '- no provider/channel/live route is activated;',
      '- promotion requires eval, canary and security checks.',
      '',
    ].join('\n');

    const manifestFile = path.join(workspaceDir, 'prototype-manifest.json');
    const notesFile = path.join(workspaceDir, 'README.md');
    const receiptFile = path.join(workspaceDir, 'sandbox-receipt.json');
    this.writeText(manifestFile, JSON.stringify(manifest, null, 2));
    this.writeText(notesFile, notes);
    this.writeText(receiptFile, JSON.stringify(sandboxReceipt, null, 2));

    return {
      id: prototypeId,
      candidateId: candidate.id,
      title: redact(candidate.title),
      status: 'simulated',
      workspaceDir,
      createdAt: timestamp,
      updatedAt: timestamp,
      artifacts: [
        artifact('manifest', manifestFile),
        artifact('notes', notesFile),
        artifact('sandbox-receipt', receiptFile),
      ],
      sandboxReceipt,
      evidence: {
        candidateStatusAtPrototype: candidate.status,
        candidateEvidenceCount: candidate.evidence.length,
        sourceIds: candidate.sourceIds,
      },
      nextSafeAction: 'Run eval/canary/security checks against this isolated prototype before promotion.',
    };
  }

  private resolveWorkspace(candidateId: string): string {
    const resolved = path.resolve(this.prototypeRoot, safePathId(candidateId));
    assertInside(this.prototypeRoot, resolved);
    return resolved;
  }

  private writeText(filePath: string, content: string): void {
    assertInside(this.prototypeRoot, filePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }

  private readStore(): Store {
    try {
      const stats = fs.statSync(this.storeFile);
      if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return this.emptyStore();
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) as Partial<Store>;
      return {
        contractVersion: ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION,
        updatedAt: normalizeDate(parsed.updatedAt || this.timestamp()),
        prototypes: Array.isArray(parsed.prototypes) ? parsed.prototypes.map(normalizePrototype).filter(isPrototype) : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.map(normalizeReceipt).filter(isReceipt).slice(-MAX_RECEIPTS) : [],
      };
    } catch (error: unknown) {logger.warn('[Zavorth Capability Prototype Sandbox] parsing failed', error);
    return this.emptyStore();
  }
  }

  private writeStore(store: Store): void {
    const normalized: Store = {
      contractVersion: ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      prototypes: store.prototypes.sort((left, right) => left.id.localeCompare(right.id)),
      receipts: store.receipts.slice(-MAX_RECEIPTS),
    };
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const tempFile = `${this.storeFile}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    fs.renameSync(tempFile, this.storeFile);
  }

  private emptyStore(): Store {
    return {
      contractVersion: ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      prototypes: [],
      receipts: [],
    };
  }

  private buildSnapshot(store: Store): ZavorthCapabilityPrototypeSandboxSnapshot {
    const prototypes = clone(store.prototypes);
    const receipts = clone(store.receipts);
    return {
      contractVersion: ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION,
      generatedAt: this.timestamp(),
      surface: 'capability-prototype-sandbox',
      status: receipts.some((entry) => entry.status === 'blocked') ? 'attention' : 'ready',
      storeFile: this.storeFile,
      prototypeRoot: this.prototypeRoot,
      summary: {
        prototypes: prototypes.length,
        simulated: prototypes.filter((entry) => entry.status === 'simulated').length,
        skipped: receipts.filter((entry) => entry.status === 'skipped').length,
        blocked: receipts.filter((entry) => entry.status === 'blocked').length,
        receipts: receipts.length,
      },
      prototypes,
      receipts,
      safety: {
        prototypeReadyCandidatesOnly: true,
        sandboxWorkspaceOnly: true,
        previewOnlyFallbackByDefault: true,
        hostWorkspaceUntouched: true,
        noCapabilityInstalled: true,
        noToolExposed: true,
        noLiveActivation: true,
        secretsRedacted: true,
      },
      commands: {
        list: 'npm run zavorth:capability-prototypes --silent -- --list',
        prototypeAllReady: 'npm run zavorth:capability-prototypes --silent -- --prototype --all-ready',
        prototypeSelected: 'npm run zavorth:capability-prototypes --silent -- --prototype --candidate <candidate-id>',
        nextStage: 'Run eval, canary and security checks for sandbox prototypes.',
      },
    };
  }

  private receipt(
    actor: string,
    status: ZavorthCapabilityPrototypeReceipt['status'],
    candidateId: string | null,
    prototypeId: string | null,
    summary: string,
  ): ZavorthCapabilityPrototypeReceipt {
    return {
      id: `prototype-receipt:${randomUUID()}`,
      at: this.timestamp(),
      actor,
      operation: 'prototype',
      status,
      candidateId,
      prototypeId,
      summary: redact(summary),
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function artifact(kind: ZavorthCapabilityPrototypeArtifact['kind'], filePath: string): ZavorthCapabilityPrototypeArtifact {
  return {
    kind,
    path: filePath,
    sha256: hash(fs.readFileSync(filePath, 'utf8')),
  };
}

function normalizePrototype(input: unknown): ZavorthCapabilityPrototypeRecord | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityPrototypeRecord;
  if (!clean(value.id) || !clean(value.candidateId)) return null;
  return {
    id: clean(value.id),
    candidateId: clean(value.candidateId),
    title: redact(value.title),
    status: isPrototypeStatus(value.status) ? value.status : 'blocked',
    workspaceDir: redact(value.workspaceDir),
    createdAt: normalizeDate(value.createdAt),
    updatedAt: normalizeDate(value.updatedAt),
    artifacts: Array.isArray(value.artifacts) ? value.artifacts.map(normalizeArtifact).filter(isArtifact) : [],
    sandboxReceipt: normalizeSandboxReceipt(value.sandboxReceipt),
    evidence: {
      candidateStatusAtPrototype: value.evidence?.candidateStatusAtPrototype || 'prototype_ready',
      candidateEvidenceCount: Number(value.evidence?.candidateEvidenceCount || 0),
      sourceIds: Array.isArray(value.evidence?.sourceIds) ? value.evidence.sourceIds.map(clean).filter(Boolean) : [],
    },
    nextSafeAction: redact(value.nextSafeAction) || 'Run eval/canary/security checks.',
  };
}

function normalizeArtifact(input: unknown): ZavorthCapabilityPrototypeArtifact | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityPrototypeArtifact;
  if (!['manifest', 'notes', 'sandbox-receipt'].includes(value.kind) || !clean(value.path)) return null;
  return {
    kind: value.kind,
    path: redact(value.path),
    sha256: clean(value.sha256),
  };
}

function normalizeReceipt(input: unknown): ZavorthCapabilityPrototypeReceipt | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityPrototypeReceipt;
  if (!clean(value.id)) return null;
  return {
    id: clean(value.id),
    at: normalizeDate(value.at),
    actor: clean(value.actor || 'system'),
    operation: 'prototype',
    status: ['applied', 'skipped', 'blocked'].includes(value.status) ? value.status : 'blocked',
    candidateId: value.candidateId ? clean(value.candidateId) : null,
    prototypeId: value.prototypeId ? clean(value.prototypeId) : null,
    summary: redact(value.summary),
  };
}

function normalizeSandboxReceipt(value: SandboxExecutionReceipt | null | undefined): SandboxExecutionReceipt {
  if (value && value.contractVersion === 'sandbox-execution-receipt/1') return value;
  return new SandboxExecutionReceiptService().createReceipt({
    backend: 'preview-only',
    command: 'zavorth capability prototype',
    previewOnlyFallback: true,
  });
}

function isPrototype(value: ZavorthCapabilityPrototypeRecord | null): value is ZavorthCapabilityPrototypeRecord {
  return Boolean(value);
}

function isArtifact(value: ZavorthCapabilityPrototypeArtifact | null): value is ZavorthCapabilityPrototypeArtifact {
  return Boolean(value);
}

function isReceipt(value: ZavorthCapabilityPrototypeReceipt | null): value is ZavorthCapabilityPrototypeReceipt {
  return Boolean(value);
}

function isPrototypeStatus(value: unknown): value is ZavorthCapabilityPrototypeStatus {
  return ['simulated', 'skipped', 'blocked'].includes(String(value || ''));
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Capability prototype path must stay inside the sandbox prototype root.');
  }
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeDate(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function redact(value: unknown): string {
  return String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[REDACTED]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{6,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{6,}\b/g, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, '[REDACTED]')
    .replace(/\b(token|secret|password|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .trim()
    .slice(0, 2_000);
}

function safeId(value: unknown): string {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);
}

function safePathId(value: unknown): string {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || 'candidate';
}

function clean(value: unknown): string {
  return redact(value).replace(/\s+/gu, ' ').trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
