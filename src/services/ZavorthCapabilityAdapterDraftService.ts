import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION,
  type ZavorthCapabilityAdapterDraftArtifact,
  type ZavorthCapabilityAdapterDraftInput,
  type ZavorthCapabilityAdapterDraftKind,
  type ZavorthCapabilityAdapterDraftReceipt,
  type ZavorthCapabilityAdapterDraftRecord,
  type ZavorthCapabilityAdapterDraftSnapshot,
  type ZavorthCapabilityAdapterDraftStatus,
} from '../contracts/ZavorthCapabilityAdapterDraftContract.js';
import type { IntelligenceCapabilityManifest } from '../contracts/native/IntelligenceFabricContract.js';
import type { CapabilityLabSnapshot } from '../contracts/PracticalAgencyContract.js';
import type { ZavorthInnovationRadarCategory } from '../contracts/native/ZavorthInnovationRadarContract.js';
import type {
  ZavorthCapabilityPrototypeRecord,
  ZavorthCapabilityPrototypeSandboxSnapshot,
} from '../contracts/ZavorthCapabilityPrototypeSandboxContract.js';
import { CapabilityLabService } from './CapabilityLabService.js';
import { ZavorthCapabilityPrototypeSandboxService } from './ZavorthCapabilityPrototypeSandboxService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  storeFile?: string;
  adapterRoot?: string;
  prototypes?: Pick<ZavorthCapabilityPrototypeSandboxService, 'snapshot'>;
  capabilityLab?: Pick<CapabilityLabService, 'simulate'>;
};

type Store = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION;
  updatedAt: string;
  adapters: ZavorthCapabilityAdapterDraftRecord[];
  receipts: ZavorthCapabilityAdapterDraftReceipt[];
};

type PrototypeManifest = {
  candidate?: {
    summary?: string;
    category?: ZavorthInnovationRadarCategory;
    tags?: string[];
  };
};

const MAX_STORE_BYTES = 4 * 1024 * 1024;
const MAX_RECEIPTS = 500;

export class ZavorthCapabilityAdapterDraftService {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly storeFile: string;
  private readonly adapterRoot: string;
  private readonly prototypes: Pick<ZavorthCapabilityPrototypeSandboxService, 'snapshot'>;
  private readonly capabilityLab: Pick<CapabilityLabService, 'simulate'>;

  public constructor(runtime: Runtime = {}) {
    const projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => new Date());
    const paths = new ZavorthHomePathService({ projectRoot, env: this.env }).resolvePaths();
    this.storeFile = path.resolve(runtime.storeFile || path.join(paths.runtimeDir, 'capability-adapter-drafts.json'));
    this.adapterRoot = path.resolve(runtime.adapterRoot || path.join(paths.runtimeDir, 'capability-adapters'));
    this.prototypes = runtime.prototypes || new ZavorthCapabilityPrototypeSandboxService({
      projectRoot,
      env: this.env,
      now: this.now,
    });
    this.capabilityLab = runtime.capabilityLab || new CapabilityLabService();
  }

  public snapshot(): ZavorthCapabilityAdapterDraftSnapshot {
    return this.buildSnapshot(this.readStore());
  }

  public draft(input: ZavorthCapabilityAdapterDraftInput = {}): ZavorthCapabilityAdapterDraftSnapshot {
    const actor = clean(input.actor || 'operator');
    const selected = this.selectPrototypes(input);
    const store = this.readStore();
    if (selected.prototypes.length === 0) {
      store.receipts.push(this.receipt(actor, 'skipped', null, null, 'No simulated capability prototype was selected.'));
      this.writeStore(store);
      return this.buildSnapshot(store);
    }

    for (const prototype of selected.prototypes) {
      const existing = store.adapters.find((entry) => entry.prototypeId === prototype.id);
      if (existing) {
        store.receipts.push(this.receipt(actor, 'skipped', prototype.id, existing.id, 'Adapter draft already exists for this prototype.'));
        continue;
      }
      if (prototype.status !== 'simulated') {
        store.receipts.push(this.receipt(actor, 'blocked', prototype.id, null, 'Only simulated sandbox prototypes can become adapter drafts.'));
        continue;
      }
      const record = this.createAdapterDraft(prototype, selected.prototypeRoot);
      store.adapters.push(record);
      store.receipts.push(this.receipt(
        actor,
        record.status === 'draft_ready' ? 'applied' : 'blocked',
        prototype.id,
        record.id,
        record.status === 'draft_ready'
          ? 'Zavorth-native adapter draft generated and validated by Capability Lab.'
          : 'Adapter draft generated but blocked by Capability Lab.',
      ));
    }
    this.writeStore(store);
    return this.buildSnapshot(store);
  }

  public renderText(snapshot = this.snapshot()): string {
    const lines = [
      'Zavorth Capability Adapter Drafts',
      '',
      `status=${snapshot.status}`,
      `store=${snapshot.storeFile}`,
      `root=${snapshot.adapterRoot}`,
      `adapters=${snapshot.summary.adapters} draft_ready=${snapshot.summary.draftReady} blocked=${snapshot.summary.blocked} skipped=${snapshot.summary.skipped}`,
      '',
      'Adapters:',
    ];
    if (snapshot.adapters.length === 0) lines.push('- none drafted');
    for (const adapter of snapshot.adapters) {
      lines.push(`- ${adapter.id} [${adapter.status}] ${adapter.title} / ${adapter.adapterKind}`);
      lines.push(`  lab=${adapter.lab.status} next=${adapter.nextSafeAction}`);
    }
    lines.push('', 'Safety: adapter draft only; no installation, tool exposure or live activation occurred.');
    return lines.join('\n');
  }

  private selectPrototypes(input: ZavorthCapabilityAdapterDraftInput): Pick<ZavorthCapabilityPrototypeSandboxSnapshot, 'prototypeRoot' | 'prototypes'> {
    const snapshot = input.prototypes || this.prototypes.snapshot();
    const ids = new Set((input.prototypeIds || []).map(clean).filter(Boolean));
    return {
      prototypeRoot: snapshot.prototypeRoot,
      prototypes: snapshot.prototypes.filter((prototype) => {
        if (prototype.status !== 'simulated') return false;
        return input.allPrototypes || ids.has(prototype.id);
      }),
    };
  }

  private createAdapterDraft(
    prototype: ZavorthCapabilityPrototypeRecord,
    prototypeRoot: string,
  ): ZavorthCapabilityAdapterDraftRecord {
    const timestamp = this.timestamp();
    const prototypeManifest = this.readPrototypeManifest(prototype, prototypeRoot);
    const category = prototypeManifest.candidate?.category || 'unknown';
    const adapterKind = adapterKindForCategory(category);
    const adapterId = `capability-adapter:${safeId(prototype.candidateId)}`;
    const workspaceDir = this.resolveWorkspace(adapterId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    const manifest = this.buildManifest(adapterId, prototype, prototypeManifest, adapterKind);
    const lab = this.capabilityLab.simulate({ manifest });
    const status: ZavorthCapabilityAdapterDraftStatus = lab.status === 'blocked' ? 'blocked' : 'draft_ready';
    const policy = {
      contractVersion: 'capability-adapter-policy/1',
      generatedAt: timestamp,
      adapterId,
      sourcePrototypeId: prototype.id,
      defaults: {
        enabled: false,
        liveAllowed: false,
        toolExposed: false,
      },
      gates: {
        evalRequired: true,
        canaryRequired: true,
        securityReviewRequired: true,
        ownerApprovalRequiredForActivation: true,
      },
      network: {
        access: manifest.networkAccess,
        allowlistRequired: manifest.networkAccess !== 'none',
      },
      secrets: {
        rawSecretsSerialized: false,
        refs: manifest.requiredSecrets,
      },
    };
    const tests = {
      contractVersion: 'capability-adapter-tests/1',
      adapterId,
      commands: manifest.tests,
      requiredBeforePromotion: true,
      futureStage: 'eval-canary-security',
    };

    const manifestFile = path.join(workspaceDir, 'adapter-manifest.json');
    const policyFile = path.join(workspaceDir, 'adapter-policy.json');
    const testsFile = path.join(workspaceDir, 'adapter-tests.json');
    const labFile = path.join(workspaceDir, 'capability-lab-report.json');
    this.writeText(manifestFile, JSON.stringify(manifest, null, 2));
    this.writeText(policyFile, JSON.stringify(policy, null, 2));
    this.writeText(testsFile, JSON.stringify(tests, null, 2));
    this.writeText(labFile, JSON.stringify(lab, null, 2));

    return {
      id: adapterId,
      prototypeId: prototype.id,
      candidateId: prototype.candidateId,
      title: redact(prototype.title),
      status,
      adapterKind,
      workspaceDir,
      createdAt: timestamp,
      updatedAt: timestamp,
      manifest,
      lab,
      artifacts: [
        artifact('adapter-manifest', manifestFile),
        artifact('adapter-policy', policyFile),
        artifact('adapter-tests', testsFile),
        artifact('capability-lab-report', labFile),
      ],
      sourcePrototype: {
        id: prototype.id,
        candidateId: prototype.candidateId,
        status: prototype.status,
        workspaceDir: prototype.workspaceDir,
      },
      nextSafeAction: status === 'draft_ready'
        ? 'Run eval, canary and security checks before exposing this adapter through the Action Harness.'
        : 'Fix Capability Lab blockers before any eval or canary work.',
    };
  }

  private buildManifest(
    adapterId: string,
    prototype: ZavorthCapabilityPrototypeRecord,
    prototypeManifest: PrototypeManifest,
    adapterKind: ZavorthCapabilityAdapterDraftKind,
  ): IntelligenceCapabilityManifest {
    const category = prototypeManifest.candidate?.category || 'unknown';
    const safeAdapter = safeEnvId(adapterId);
    const needsNetwork = ['channel-adapter', 'provider-adapter'].includes(adapterKind);
    return {
      id: adapterId,
      name: redact(prototype.title) || adapterId,
      description: redact(prototypeManifest.candidate?.summary || prototype.title) || 'Zavorth-native adapter draft.',
      kind: intelligenceKind(adapterKind),
      riskLevel: riskForAdapter(adapterKind),
      requiredTools: requiredTools(adapterKind),
      requiredSecrets: needsNetwork ? [`env:ZAVORTH_${safeAdapter}_CREDENTIAL_REF`] : [],
      allowedFileScopes: [prototype.workspaceDir],
      networkAccess: needsNetwork ? 'allowlist' : 'none',
      approvalRequiredFor: needsNetwork ? ['activate-live', 'network-access'] : ['activate-live'],
      tests: [
        'npm run zavorth:capability-adapters:check --silent',
        `adapter:${safeId(category)}:${safeId(prototype.candidateId)}:unit-placeholder`,
      ],
      defaultEnabled: false,
      liveAllowedByDefault: false,
    };
  }

  private readPrototypeManifest(prototype: ZavorthCapabilityPrototypeRecord, prototypeRoot: string): PrototypeManifest {
    const manifest = prototype.artifacts.find((entry) => entry.kind === 'manifest');
    if (!manifest) return {};
    const filePath = path.resolve(manifest.path);
    assertInside(prototypeRoot, filePath);
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PrototypeManifest;
    } catch (error) { logger.warn('[Zavorth Capability Adapter Draft] JSON parse failed', error); return {}; }
  }

  private resolveWorkspace(adapterId: string): string {
    const resolved = path.resolve(this.adapterRoot, safePathId(adapterId));
    assertInside(this.adapterRoot, resolved);
    return resolved;
  }

  private writeText(filePath: string, content: string): void {
    assertInside(this.adapterRoot, filePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }

  private readStore(): Store {
    try {
      const stats = fs.statSync(this.storeFile);
      if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return this.emptyStore();
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) as Partial<Store>;
      return {
        contractVersion: ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION,
        updatedAt: normalizeDate(parsed.updatedAt || this.timestamp()),
        adapters: Array.isArray(parsed.adapters) ? parsed.adapters.map(normalizeAdapter).filter(isAdapter) : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.map(normalizeReceipt).filter(isReceipt).slice(-MAX_RECEIPTS) : [],
      };
    } catch (error) {
    logger.warn('[Zavorth Capability Adapter Draft] parsing failed', error);
    return this.emptyStore();
  }
  }

  private writeStore(store: Store): void {
    const normalized: Store = {
      contractVersion: ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      adapters: store.adapters.sort((left, right) => left.id.localeCompare(right.id)),
      receipts: store.receipts.slice(-MAX_RECEIPTS),
    };
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const tempFile = `${this.storeFile}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    fs.renameSync(tempFile, this.storeFile);
  }

  private emptyStore(): Store {
    return {
      contractVersion: ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      adapters: [],
      receipts: [],
    };
  }

  private buildSnapshot(store: Store): ZavorthCapabilityAdapterDraftSnapshot {
    const adapters = clone(store.adapters);
    const receipts = clone(store.receipts);
    return {
      contractVersion: ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION,
      generatedAt: this.timestamp(),
      surface: 'capability-adapter-draft',
      status: adapters.some((entry) => entry.status === 'blocked') || receipts.some((entry) => entry.status === 'blocked') ? 'attention' : 'ready',
      storeFile: this.storeFile,
      adapterRoot: this.adapterRoot,
      summary: {
        adapters: adapters.length,
        draftReady: adapters.filter((entry) => entry.status === 'draft_ready').length,
        skipped: receipts.filter((entry) => entry.status === 'skipped').length,
        blocked: receipts.filter((entry) => entry.status === 'blocked').length + adapters.filter((entry) => entry.status === 'blocked').length,
        receipts: receipts.length,
      },
      adapters,
      receipts,
      safety: {
        simulatedPrototypesOnly: true,
        adapterDraftOnly: true,
        capabilityLabRequired: true,
        defaultEnabledFalse: true,
        liveAllowedByDefaultFalse: true,
        noCapabilityInstalled: true,
        noToolExposed: true,
        noLiveActivation: true,
        secretsRedacted: true,
      },
      commands: {
        list: 'npm run zavorth:capability-adapters --silent -- --list',
        draftAll: 'npm run zavorth:capability-adapters --silent -- --draft --all-prototypes',
        draftSelected: 'npm run zavorth:capability-adapters --silent -- --draft --prototype <prototype-id>',
        nextStage: 'Run eval, canary and security checks for adapter drafts.',
      },
    };
  }

  private receipt(
    actor: string,
    status: ZavorthCapabilityAdapterDraftReceipt['status'],
    prototypeId: string | null,
    adapterDraftId: string | null,
    summary: string,
  ): ZavorthCapabilityAdapterDraftReceipt {
    return {
      id: `adapter-draft-receipt:${randomUUID()}`,
      at: this.timestamp(),
      actor,
      operation: 'draft-adapter',
      status,
      prototypeId,
      adapterDraftId,
      summary: redact(summary),
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function adapterKindForCategory(category: ZavorthInnovationRadarCategory): ZavorthCapabilityAdapterDraftKind {
  if (category === 'agent-runtime') return 'runtime-adapter';
  if (category === 'channels') return 'channel-adapter';
  if (category === 'providers') return 'provider-adapter';
  if (category === 'memory') return 'memory-adapter';
  if (category === 'tooling') return 'tool-adapter';
  if (category === 'sandbox') return 'sandbox-adapter';
  if (category === 'multimodal') return 'multimodal-adapter';
  if (category === 'workflow') return 'workflow-adapter';
  if (category === 'ux') return 'surface-adapter';
  if (category === 'security') return 'policy-adapter';
  return 'generic-adapter';
}

function intelligenceKind(adapterKind: ZavorthCapabilityAdapterDraftKind): IntelligenceCapabilityManifest['kind'] {
  if (adapterKind === 'workflow-adapter') return 'workflow';
  if (adapterKind === 'runtime-adapter') return 'subagent';
  return 'tool';
}

function riskForAdapter(adapterKind: ZavorthCapabilityAdapterDraftKind): IntelligenceCapabilityManifest['riskLevel'] {
  if (['channel-adapter', 'provider-adapter', 'sandbox-adapter', 'multimodal-adapter', 'policy-adapter', 'runtime-adapter'].includes(adapterKind)) return 3;
  return 2;
}

function requiredTools(adapterKind: ZavorthCapabilityAdapterDraftKind): string[] {
  const tools = ['zavorth_action', 'capability-prototype-sandbox'];
  if (adapterKind === 'channel-adapter') tools.push('channel-mesh');
  if (adapterKind === 'provider-adapter') tools.push('provider-mesh');
  if (adapterKind === 'memory-adapter') tools.push('mnemos');
  if (adapterKind === 'workflow-adapter') tools.push('task-plane');
  return tools;
}

function artifact(kind: ZavorthCapabilityAdapterDraftArtifact['kind'], filePath: string): ZavorthCapabilityAdapterDraftArtifact {
  return {
    kind,
    path: filePath,
    sha256: hash(fs.readFileSync(filePath, 'utf8')),
  };
}

function normalizeAdapter(input: unknown): ZavorthCapabilityAdapterDraftRecord | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityAdapterDraftRecord;
  if (!clean(value.id) || !clean(value.prototypeId) || !clean(value.candidateId)) return null;
  return {
    id: clean(value.id),
    prototypeId: clean(value.prototypeId),
    candidateId: clean(value.candidateId),
    title: redact(value.title),
    status: isDraftStatus(value.status) ? value.status : 'blocked',
    adapterKind: isAdapterKind(value.adapterKind) ? value.adapterKind : 'generic-adapter',
    workspaceDir: redact(value.workspaceDir),
    createdAt: normalizeDate(value.createdAt),
    updatedAt: normalizeDate(value.updatedAt),
    manifest: normalizeManifest(value.manifest),
    lab: normalizeLab(value.lab),
    artifacts: Array.isArray(value.artifacts) ? value.artifacts.map(normalizeArtifact).filter(isArtifact) : [],
    sourcePrototype: {
      id: clean(value.sourcePrototype?.id || value.prototypeId),
      candidateId: clean(value.sourcePrototype?.candidateId || value.candidateId),
      status: value.sourcePrototype?.status || 'simulated',
      workspaceDir: redact(value.sourcePrototype?.workspaceDir || ''),
    },
    nextSafeAction: redact(value.nextSafeAction) || 'Run eval/canary/security checks.',
  };
}

function normalizeManifest(value: IntelligenceCapabilityManifest): IntelligenceCapabilityManifest {
  return {
    id: clean(value?.id),
    name: redact(value?.name),
    description: redact(value?.description),
    kind: value?.kind || 'tool',
    riskLevel: riskForAdapter('generic-adapter'),
    requiredTools: Array.isArray(value?.requiredTools) ? value.requiredTools.map(clean).filter(Boolean) : [],
    requiredSecrets: Array.isArray(value?.requiredSecrets) ? value.requiredSecrets.map(clean).filter(Boolean) : [],
    allowedFileScopes: Array.isArray(value?.allowedFileScopes) ? value.allowedFileScopes.map(redact).filter(Boolean) : [],
    networkAccess: value?.networkAccess || 'none',
    approvalRequiredFor: Array.isArray(value?.approvalRequiredFor) ? value.approvalRequiredFor.map(clean).filter(Boolean) : ['activate-live'],
    tests: Array.isArray(value?.tests) ? value.tests.map(clean).filter(Boolean) : [],
    defaultEnabled: false,
    liveAllowedByDefault: false,
  };
}

function normalizeLab(value: CapabilityLabSnapshot): CapabilityLabSnapshot {
  if (value?.source === 'CapabilityLabService' && Array.isArray(value.checks)) return value;
  return {
    source: 'CapabilityLabService',
    status: 'blocked',
    simulated: true,
    activationAllowed: false,
    checks: [{ id: 'capability-lab.missing-report', status: 'blocked', message: 'Capability Lab report missing.' }],
  };
}

function normalizeArtifact(input: unknown): ZavorthCapabilityAdapterDraftArtifact | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityAdapterDraftArtifact;
  if (!['adapter-manifest', 'adapter-policy', 'adapter-tests', 'capability-lab-report'].includes(value.kind) || !clean(value.path)) return null;
  return {
    kind: value.kind,
    path: redact(value.path),
    sha256: clean(value.sha256),
  };
}

function normalizeReceipt(input: unknown): ZavorthCapabilityAdapterDraftReceipt | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityAdapterDraftReceipt;
  if (!clean(value.id)) return null;
  return {
    id: clean(value.id),
    at: normalizeDate(value.at),
    actor: clean(value.actor || 'system'),
    operation: 'draft-adapter',
    status: ['applied', 'skipped', 'blocked'].includes(value.status) ? value.status : 'blocked',
    prototypeId: value.prototypeId ? clean(value.prototypeId) : null,
    adapterDraftId: value.adapterDraftId ? clean(value.adapterDraftId) : null,
    summary: redact(value.summary),
  };
}

function isAdapter(value: ZavorthCapabilityAdapterDraftRecord | null): value is ZavorthCapabilityAdapterDraftRecord {
  return Boolean(value);
}

function isArtifact(value: ZavorthCapabilityAdapterDraftArtifact | null): value is ZavorthCapabilityAdapterDraftArtifact {
  return Boolean(value);
}

function isReceipt(value: ZavorthCapabilityAdapterDraftReceipt | null): value is ZavorthCapabilityAdapterDraftReceipt {
  return Boolean(value);
}

function isDraftStatus(value: unknown): value is ZavorthCapabilityAdapterDraftStatus {
  return ['draft_ready', 'skipped', 'blocked'].includes(String(value || ''));
}

function isAdapterKind(value: unknown): value is ZavorthCapabilityAdapterDraftKind {
  return [
    'runtime-adapter', 'channel-adapter', 'provider-adapter', 'memory-adapter',
    'tool-adapter', 'sandbox-adapter', 'multimodal-adapter', 'workflow-adapter',
    'surface-adapter', 'policy-adapter', 'generic-adapter',
  ].includes(String(value || ''));
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Capability adapter draft path must stay inside the adapter workspace root.');
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
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || 'adapter';
}

function safeEnvId(value: unknown): string {
  return safePathId(value).replace(/[^a-z0-9]+/g, '_').toUpperCase();
}

function clean(value: unknown): string {
  return redact(value).replace(/\s+/gu, ' ').trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
