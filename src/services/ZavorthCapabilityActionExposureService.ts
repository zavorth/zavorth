import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION,
  type ZavorthCapabilityActionExposureArtifact,
  type ZavorthCapabilityActionExposureInput,
  type ZavorthCapabilityActionExposureManifest,
  type ZavorthCapabilityActionExposurePreview,
  type ZavorthCapabilityActionExposureReceipt,
  type ZavorthCapabilityActionExposureRecord,
  type ZavorthCapabilityActionExposureSnapshot,
  type ZavorthCapabilityActionExposureStatus,
} from '../contracts/ZavorthCapabilityActionExposureContract.js';
import type { ZavorthCapabilityAdapterVerificationRecord } from '../contracts/ZavorthCapabilityAdapterVerificationContract.js';
import { ZavorthCapabilityAdapterVerificationService } from './ZavorthCapabilityAdapterVerificationService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  storeFile?: string;
  exposureRoot?: string;
  verifications?: Pick<ZavorthCapabilityAdapterVerificationService, 'snapshot'>;
};

type Store = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION;
  updatedAt: string;
  exposures: ZavorthCapabilityActionExposureRecord[];
  receipts: ZavorthCapabilityActionExposureReceipt[];
};

type Selection = {
  verificationRoot: string;
  verifications: ZavorthCapabilityAdapterVerificationRecord[];
  alreadyExposed: number;
  missing: number;
};

const MAX_STORE_BYTES = 6 * 1024 * 1024;
const MAX_RECEIPTS = 500;

export class ZavorthCapabilityActionExposureService {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly storeFile: string;
  private readonly exposureRoot: string;
  private readonly verifications: Pick<ZavorthCapabilityAdapterVerificationService, 'snapshot'>;

  public constructor(runtime: Runtime = {}) {
    const projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => new Date());
    const paths = new ZavorthHomePathService({ projectRoot, env: this.env }).resolvePaths();
    this.storeFile = path.resolve(runtime.storeFile || path.join(paths.runtimeDir, 'capability-action-exposures.json'));
    this.exposureRoot = path.resolve(runtime.exposureRoot || path.join(paths.runtimeDir, 'capability-action-exposures'));
    this.verifications = runtime.verifications || new ZavorthCapabilityAdapterVerificationService({
      projectRoot,
      env: this.env,
      now: this.now,
    });
  }

  public snapshot(): ZavorthCapabilityActionExposureSnapshot {
    return this.buildSnapshot(this.readStore());
  }

  public preview(input: ZavorthCapabilityActionExposureInput = {}): ZavorthCapabilityActionExposurePreview {
    const store = this.readStore();
    const selected = this.selectVerifications(input, store);
    const plannedActions = selected.verifications.map((verification) => this.buildManifest(verification));
    return {
      generatedAt: this.timestamp(),
      selected: selected.verifications.length,
      alreadyExposed: selected.alreadyExposed,
      missing: selected.missing,
      verifiedOnly: true,
      plannedActions,
      lines: plannedActions.length > 0
        ? plannedActions.map((action) => `${action.actionId}: ${action.title}`)
        : ['No verified adapter verification was selected for Action Harness exposure.'],
    };
  }

  public expose(input: ZavorthCapabilityActionExposureInput = {}): ZavorthCapabilityActionExposureSnapshot {
    const actor = clean(input.actor || 'operator');
    const store = this.readStore();
    const selected = this.selectVerifications(input, store);
    if (selected.verifications.length === 0) {
      store.receipts.push(this.receipt(actor, 'skipped', null, null, 'No verified adapter verification was selected for Action Harness exposure.'));
      this.writeStore(store);
      return this.buildSnapshot(store);
    }

    for (const verification of selected.verifications) {
      const existing = store.exposures.find((entry) => entry.verificationId === verification.id || entry.actionId === this.actionIdFor(verification));
      if (existing) {
        store.receipts.push(this.receipt(actor, 'skipped', verification.id, existing.id, 'Capability action exposure already exists for this verification.'));
        continue;
      }
      if (verification.status !== 'verified') {
        store.receipts.push(this.receipt(actor, 'blocked', verification.id, null, 'Only verified adapter checks can be exposed through the Action Harness.'));
        continue;
      }
      const record = this.createExposure(verification);
      store.exposures.push(record);
      store.receipts.push(this.receipt(actor, 'applied', verification.id, record.id, 'Verified adapter exposed as a governed Action Harness candidate.'));
    }
    this.writeStore(store);
    return this.buildSnapshot(store);
  }

  public renderText(snapshot = this.snapshot()): string {
    const lines = [
      'Zavorth Capability Action Exposure',
      '',
      `status=${snapshot.status}`,
      `store=${snapshot.storeFile}`,
      `root=${snapshot.exposureRoot}`,
      `exposures=${snapshot.summary.exposures} exposed=${snapshot.summary.exposed} blocked=${snapshot.summary.blocked}`,
      '',
      'Exposed candidates:',
    ];
    if (snapshot.exposures.length === 0) lines.push('- none exposed');
    for (const exposure of snapshot.exposures) {
      lines.push(`- ${exposure.actionId} [${exposure.status}] ${exposure.title}`);
      lines.push(`  source=${exposure.verificationId} next=${exposure.nextSafeAction}`);
    }
    lines.push('', 'Safety: Action Harness exposure only; no tool execution, network call or live activation occurred.');
    return lines.join('\n');
  }

  private selectVerifications(input: ZavorthCapabilityActionExposureInput, store: Store): Selection {
    const snapshot = input.verifications || this.verifications.snapshot();
    const ids = new Set((input.verificationIds || []).map(clean).filter(Boolean));
    const requestedIds = ids.size;
    const existingVerificationIds = new Set(store.exposures.map((entry) => entry.verificationId));
    const existingActionIds = new Set(store.exposures.map((entry) => entry.actionId));
    const candidates = snapshot.verifications.filter((verification) => {
      if (verification.status !== 'verified') return false;
      if (!(input.allVerified || ids.has(verification.id))) return false;
      return true;
    });
    const selected = candidates.filter((verification) => {
      const actionId = this.actionIdFor(verification);
      return !existingVerificationIds.has(verification.id) && !existingActionIds.has(actionId);
    });
    return {
      verificationRoot: path.resolve(snapshot.verificationRoot),
      verifications: selected,
      alreadyExposed: candidates.length - selected.length,
      missing: requestedIds > 0 ? Math.max(0, requestedIds - candidates.length) : 0,
    };
  }

  private createExposure(verification: ZavorthCapabilityAdapterVerificationRecord): ZavorthCapabilityActionExposureRecord {
    const timestamp = this.timestamp();
    const manifest = this.buildManifest(verification);
    const exposureId = `capability-action-exposure:${safeId(verification.id)}`;
    const workspaceDir = this.resolveWorkspace(exposureId);
    fs.mkdirSync(workspaceDir, { recursive: true });
    const policy = {
      contractVersion: 'capability-action-policy/1',
      generatedAt: timestamp,
      actionId: manifest.actionId,
      sourceVerificationId: verification.id,
      defaults: {
        visibleInActionHarness: true,
        previewRequired: true,
        approvalRequired: true,
        toolExecutionAllowed: false,
        liveActivationAllowed: false,
      },
      gates: {
        adapterVerificationRequired: true,
        actionPreviewRequired: true,
        ownerApprovalRequiredForAnyApply: true,
        liveCanaryRequiredBeforeActivation: true,
      },
      receipts: {
        exposureReceiptRequired: true,
        activationReceiptRequiredLater: true,
      },
    };
    const manifestFile = path.join(workspaceDir, 'action-manifest.json');
    const policyFile = path.join(workspaceDir, 'action-policy.json');
    const sourceFile = path.join(workspaceDir, 'source-verification.json');
    this.writeJson(manifestFile, manifest);
    this.writeJson(policyFile, policy);
    this.writeJson(sourceFile, {
      id: verification.id,
      status: verification.status,
      adapterDraftId: verification.adapterDraftId,
      score: verification.score,
      artifacts: verification.artifacts,
    });
    const status: ZavorthCapabilityActionExposureStatus = verification.status === 'verified' ? 'exposed' : 'blocked';
    return {
      id: exposureId,
      actionId: manifest.actionId,
      verificationId: verification.id,
      adapterDraftId: verification.adapterDraftId,
      candidateId: verification.candidateId,
      title: manifest.title,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      workspaceDir,
      manifest,
      artifacts: [
        artifact('action-manifest', manifestFile),
        artifact('action-policy', policyFile),
        artifact('source-verification', sourceFile),
      ],
      sourceVerification: {
        id: verification.id,
        status: verification.status,
        adapterDraftId: verification.adapterDraftId,
        workspaceDir: verification.workspaceDir,
      },
      nextSafeAction: 'Use Action Harness preview/approval to inspect this candidate; live activation remains a later gated phase.',
    };
  }

  private buildManifest(verification: ZavorthCapabilityAdapterVerificationRecord): ZavorthCapabilityActionExposureManifest {
    const actionId = this.actionIdFor(verification);
    const title = redact(verification.title || verification.candidateId || verification.adapterDraftId);
    return {
      actionId,
      title,
      description: `Governed candidate action generated from verified capability adapter ${verification.adapterDraftId}.`,
      aliases: [
        actionId,
        title,
        verification.adapterDraftId,
        verification.candidateId,
      ].map(clean).filter(Boolean),
      domains: ['capabilities', 'innovation', 'adapter', 'verification'],
      surface: ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'],
      risk: 'attention',
      requiresPreview: true,
      requiresApproval: true,
      liveActivationAllowed: false,
      toolExecutionAllowed: false,
    };
  }

  private actionIdFor(verification: ZavorthCapabilityAdapterVerificationRecord): string {
    return `capability.candidate.${safeId(verification.candidateId || verification.adapterDraftId)}`;
  }

  private resolveWorkspace(exposureId: string): string {
    const resolved = path.resolve(this.exposureRoot, safePathId(exposureId));
    assertInside(this.exposureRoot, resolved);
    return resolved;
  }

  private writeJson(filePath: string, value: unknown): void {
    assertInside(this.exposureRoot, filePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(redactSecrets(value), null, 2)}\n`, 'utf8');
  }

  private readStore(): Store {
    try {
      const stats = fs.statSync(this.storeFile);
      if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return this.emptyStore();
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) as Partial<Store>;
      return {
        contractVersion: ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION,
        updatedAt: normalizeDate(parsed.updatedAt || this.timestamp()),
        exposures: Array.isArray(parsed.exposures) ? parsed.exposures.map(normalizeExposure).filter(isExposure) : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.map(normalizeReceipt).filter(isReceipt).slice(-MAX_RECEIPTS) : [],
      };
    } catch (error: unknown) {if (asErrorLike(error).code !== 'ENOENT') {
      logger.warn('[Zavorth Capability Action Exposure] parsing failed', error);
    }
    return this.emptyStore();
  }
  }

  private writeStore(store: Store): void {
    const normalized: Store = {
      contractVersion: ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      exposures: store.exposures.sort((left, right) => left.id.localeCompare(right.id)),
      receipts: store.receipts.slice(-MAX_RECEIPTS),
    };
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const tempFile = `${this.storeFile}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(redactSecrets(normalized), null, 2)}\n`, 'utf8');
    fs.renameSync(tempFile, this.storeFile);
  }

  private emptyStore(): Store {
    return {
      contractVersion: ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      exposures: [],
      receipts: [],
    };
  }

  private buildSnapshot(store: Store): ZavorthCapabilityActionExposureSnapshot {
    const exposures = clone(store.exposures);
    const receipts = clone(store.receipts);
    return {
      contractVersion: ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION,
      generatedAt: this.timestamp(),
      surface: 'capability-action-exposure',
      status: exposures.some((entry) => entry.status === 'blocked') || receipts.some((entry) => entry.status === 'blocked') ? 'attention' : 'ready',
      storeFile: this.storeFile,
      exposureRoot: this.exposureRoot,
      summary: {
        exposures: exposures.length,
        exposed: exposures.filter((entry) => entry.status === 'exposed').length,
        blocked: exposures.filter((entry) => entry.status === 'blocked').length,
        receipts: receipts.length,
      },
      exposures,
      receipts,
      safety: {
        verifiedAdaptersOnly: true,
        actionHarnessOnly: true,
        previewRequired: true,
        approvalRequired: true,
        noToolExecution: true,
        noLiveActivation: true,
        noNetworkUsed: true,
        secretsRedacted: true,
      },
      commands: {
        list: 'npm run zavorth:capability-action-exposure --silent -- --list',
        previewAll: 'npm run zavorth:capability-action-exposure --silent -- --preview --all-verified',
        exposeAll: 'npm run zavorth:capability-action-exposure --silent -- --expose --all-verified',
        exposeSelected: 'npm run zavorth:capability-action-exposure --silent -- --expose --verification <verification-id>',
        nextStage: 'Show exposed capability actions in zavorthControl/TUI/setup with clear status, preview and receipts.',
      },
    };
  }

  private receipt(
    actor: string,
    status: ZavorthCapabilityActionExposureReceipt['status'],
    verificationId: string | null,
    exposureId: string | null,
    summary: string,
  ): ZavorthCapabilityActionExposureReceipt {
    return {
      id: `capability-action-exposure-receipt:${randomUUID()}`,
      at: this.timestamp(),
      actor,
      operation: 'expose-capability-action',
      status,
      verificationId,
      exposureId,
      summary: redact(summary),
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function artifact(kind: ZavorthCapabilityActionExposureArtifact['kind'], filePath: string): ZavorthCapabilityActionExposureArtifact {
  return {
    kind,
    path: filePath,
    sha256: hash(fs.readFileSync(filePath, 'utf8')),
  };
}

function normalizeExposure(input: unknown): ZavorthCapabilityActionExposureRecord | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityActionExposureRecord;
  if (!clean(value.id) || !clean(value.actionId) || !clean(value.verificationId)) return null;
  return {
    id: clean(value.id),
    actionId: clean(value.actionId),
    verificationId: clean(value.verificationId),
    adapterDraftId: clean(value.adapterDraftId),
    candidateId: clean(value.candidateId),
    title: redact(value.title),
    status: value.status === 'exposed' ? 'exposed' : 'blocked',
    createdAt: normalizeDate(value.createdAt),
    updatedAt: normalizeDate(value.updatedAt),
    workspaceDir: redact(value.workspaceDir),
    manifest: normalizeManifest(value.manifest, value),
    artifacts: Array.isArray(value.artifacts) ? value.artifacts.map(normalizeArtifact).filter(isArtifact) : [],
    sourceVerification: {
      id: clean(value.sourceVerification?.id || value.verificationId),
      status: value.sourceVerification?.status === 'verified' ? 'verified' : value.sourceVerification?.status === 'attention' ? 'attention' : 'blocked',
      adapterDraftId: clean(value.sourceVerification?.adapterDraftId || value.adapterDraftId),
      workspaceDir: redact(value.sourceVerification?.workspaceDir || ''),
    },
    nextSafeAction: redact(value.nextSafeAction) || 'Use Action Harness preview before any further promotion.',
  };
}

function normalizeManifest(
  input: unknown,
  fallback: { actionId?: unknown; title?: unknown; adapterDraftId?: unknown; candidateId?: unknown },
): ZavorthCapabilityActionExposureManifest {
  const value = input as Partial<ZavorthCapabilityActionExposureManifest>;
  const actionId = clean(value?.actionId || fallback.actionId);
  const title = redact(value?.title || fallback.title || actionId);
  return {
    actionId,
    title,
    description: redact(value?.description || `Governed candidate action generated from verified capability adapter ${fallback.adapterDraftId || actionId}.`),
    aliases: Array.isArray(value?.aliases) ? value.aliases.map(clean).filter(Boolean) : [actionId, title, clean(fallback.candidateId)].filter(Boolean),
    domains: Array.isArray(value?.domains) ? value.domains.map(clean).filter(Boolean) : ['capabilities', 'innovation', 'adapter', 'verification'],
    surface: ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'],
    risk: 'attention',
    requiresPreview: true,
    requiresApproval: true,
    liveActivationAllowed: false,
    toolExecutionAllowed: false,
  };
}

function normalizeArtifact(input: unknown): ZavorthCapabilityActionExposureArtifact | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityActionExposureArtifact;
  if (!['action-manifest', 'action-policy', 'source-verification'].includes(value.kind) || !clean(value.path)) return null;
  return {
    kind: value.kind,
    path: redact(value.path),
    sha256: clean(value.sha256),
  };
}

function normalizeReceipt(input: unknown): ZavorthCapabilityActionExposureReceipt | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityActionExposureReceipt;
  if (!clean(value.id)) return null;
  return {
    id: clean(value.id),
    at: normalizeDate(value.at),
    actor: clean(value.actor || 'system'),
    operation: 'expose-capability-action',
    status: ['applied', 'skipped', 'blocked'].includes(value.status) ? value.status : 'blocked',
    verificationId: value.verificationId ? clean(value.verificationId) : null,
    exposureId: value.exposureId ? clean(value.exposureId) : null,
    summary: redact(value.summary),
  };
}

function isExposure(value: ZavorthCapabilityActionExposureRecord | null): value is ZavorthCapabilityActionExposureRecord {
  return Boolean(value);
}

function isArtifact(value: ZavorthCapabilityActionExposureArtifact | null): value is ZavorthCapabilityActionExposureArtifact {
  return Boolean(value);
}

function isReceipt(value: ZavorthCapabilityActionExposureReceipt | null): value is ZavorthCapabilityActionExposureReceipt {
  return Boolean(value);
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Capability action exposure path must stay inside the expected workspace root.');
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

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /(token|secret|password|pass|api[_-]?key|credential)/iu.test(key) ? '***' : redactSecrets(entry),
      ]),
    );
  }
  return typeof value === 'string' ? redact(value) : value;
}

function safeId(value: unknown): string {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);
}

function safePathId(value: unknown): string {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || 'exposure';
}

function clean(value: unknown): string {
  return redact(value).replace(/\s+/gu, ' ').trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
