import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { ZavorthCapabilityAdapterDraftRecord } from '../contracts/ZavorthCapabilityAdapterDraftContract.js';
import {
  ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION,
  type ZavorthCapabilityAdapterVerificationArtifact,
  type ZavorthCapabilityAdapterVerificationCheck,
  type ZavorthCapabilityAdapterVerificationInput,
  type ZavorthCapabilityAdapterVerificationReceipt,
  type ZavorthCapabilityAdapterVerificationRecord,
  type ZavorthCapabilityAdapterVerificationSnapshot,
  type ZavorthCapabilityAdapterVerificationStatus,
} from '../contracts/ZavorthCapabilityAdapterVerificationContract.js';
import { ZavorthCapabilityAdapterDraftService } from './ZavorthCapabilityAdapterDraftService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  storeFile?: string;
  verificationRoot?: string;
  adapterDrafts?: Pick<ZavorthCapabilityAdapterDraftService, 'snapshot'>;
};

type Store = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION;
  updatedAt: string;
  verifications: ZavorthCapabilityAdapterVerificationRecord[];
  receipts: ZavorthCapabilityAdapterVerificationReceipt[];
};

type AdapterSelection = {
  adapterRoot: string;
  adapters: ZavorthCapabilityAdapterDraftRecord[];
};

const MAX_STORE_BYTES = 6 * 1024 * 1024;
const MAX_RECEIPTS = 500;

export class ZavorthCapabilityAdapterVerificationService {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly storeFile: string;
  private readonly verificationRoot: string;
  private readonly adapterDrafts: Pick<ZavorthCapabilityAdapterDraftService, 'snapshot'>;

  public constructor(runtime: Runtime = {}) {
    const projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => new Date());
    const paths = new ZavorthHomePathService({ projectRoot, env: this.env }).resolvePaths();
    this.storeFile = path.resolve(runtime.storeFile || path.join(paths.runtimeDir, 'capability-adapter-verifications.json'));
    this.verificationRoot = path.resolve(runtime.verificationRoot || path.join(paths.runtimeDir, 'capability-adapter-verifications'));
    this.adapterDrafts = runtime.adapterDrafts || new ZavorthCapabilityAdapterDraftService({
      projectRoot,
      env: this.env,
      now: this.now,
    });
  }

  public snapshot(): ZavorthCapabilityAdapterVerificationSnapshot {
    return this.buildSnapshot(this.readStore());
  }

  public verify(input: ZavorthCapabilityAdapterVerificationInput = {}): ZavorthCapabilityAdapterVerificationSnapshot {
    const actor = clean(input.actor || 'operator');
    const selected = this.selectAdapters(input);
    const store = this.readStore();
    if (selected.adapters.length === 0) {
      store.receipts.push(this.receipt(actor, 'skipped', null, null, 'No draft-ready adapter was selected for verification.'));
      this.writeStore(store);
      return this.buildSnapshot(store);
    }

    for (const adapter of selected.adapters) {
      const existing = store.verifications.find((entry) => entry.adapterDraftId === adapter.id);
      if (existing) {
        store.receipts.push(this.receipt(actor, 'skipped', adapter.id, existing.id, 'Adapter verification already exists for this draft.'));
        continue;
      }
      if (adapter.status !== 'draft_ready') {
        store.receipts.push(this.receipt(actor, 'blocked', adapter.id, null, 'Only draft-ready adapters can run eval, canary and security verification.'));
        continue;
      }
      const record = this.createVerification(adapter, selected.adapterRoot);
      store.verifications.push(record);
      store.receipts.push(this.receipt(
        actor,
        record.status === 'blocked' ? 'blocked' : 'applied',
        adapter.id,
        record.id,
        record.status === 'verified'
          ? 'Adapter draft passed deterministic eval, local canary and security checks.'
          : record.status === 'attention'
            ? 'Adapter draft passed with warnings that must be reviewed before promotion.'
            : 'Adapter draft failed verification and cannot be promoted.',
      ));
    }
    this.writeStore(store);
    return this.buildSnapshot(store);
  }

  public renderText(snapshot = this.snapshot()): string {
    const lines = [
      'Zavorth Capability Adapter Verification',
      '',
      `status=${snapshot.status}`,
      `store=${snapshot.storeFile}`,
      `root=${snapshot.verificationRoot}`,
      `verifications=${snapshot.summary.verifications} verified=${snapshot.summary.verified} attention=${snapshot.summary.attention} blocked=${snapshot.summary.blocked}`,
      '',
      'Verifications:',
    ];
    if (snapshot.verifications.length === 0) lines.push('- none verified');
    for (const verification of snapshot.verifications) {
      lines.push(`- ${verification.id} [${verification.status}] ${verification.title}`);
      lines.push(`  score=passed:${verification.score.passed} warnings:${verification.score.warnings} blocked:${verification.score.blocked}`);
      lines.push(`  next=${verification.nextSafeAction}`);
    }
    lines.push('', 'Safety: deterministic eval, local canary and security checks only; no network, install, tool exposure or live activation occurred.');
    return lines.join('\n');
  }

  private selectAdapters(input: ZavorthCapabilityAdapterVerificationInput): AdapterSelection {
    const snapshot = input.adapters || this.adapterDrafts.snapshot();
    const ids = new Set((input.adapterIds || []).map(clean).filter(Boolean));
    return {
      adapterRoot: path.resolve(snapshot.adapterRoot),
      adapters: snapshot.adapters.filter((adapter) => {
        if (adapter.status !== 'draft_ready') return false;
        return input.allAdapters || ids.has(adapter.id);
      }),
    };
  }

  private createVerification(adapter: ZavorthCapabilityAdapterDraftRecord, adapterRoot: string): ZavorthCapabilityAdapterVerificationRecord {
    const timestamp = this.timestamp();
    const verificationId = `capability-verification:${safeId(adapter.id)}`;
    const workspaceDir = this.resolveWorkspace(verificationId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    const evalChecks = this.evalChecks(adapter, adapterRoot);
    const canaryChecks = this.canaryChecks(adapter);
    const securityChecks = this.securityChecks(adapter, adapterRoot);
    const checks = [...evalChecks, ...canaryChecks, ...securityChecks];
    const score = {
      passed: checks.filter((check) => check.status === 'passed').length,
      warnings: checks.filter((check) => check.status === 'warning').length,
      blocked: checks.filter((check) => check.status === 'blocked').length,
    };
    const status: ZavorthCapabilityAdapterVerificationStatus = score.blocked > 0
      ? 'blocked'
      : score.warnings > 0
        ? 'attention'
        : 'verified';

    const evalReport = path.join(workspaceDir, 'eval-report.json');
    const canaryReport = path.join(workspaceDir, 'canary-report.json');
    const securityReport = path.join(workspaceDir, 'security-report.json');
    this.writeJson(evalReport, { generatedAt: timestamp, adapterDraftId: adapter.id, checks: evalChecks });
    this.writeJson(canaryReport, { generatedAt: timestamp, adapterDraftId: adapter.id, checks: canaryChecks, networkUsed: false });
    this.writeJson(securityReport, { generatedAt: timestamp, adapterDraftId: adapter.id, checks: securityChecks, rawAudioOrSecretsPersisted: false });

    const record: ZavorthCapabilityAdapterVerificationRecord = {
      id: verificationId,
      adapterDraftId: adapter.id,
      prototypeId: adapter.prototypeId,
      candidateId: adapter.candidateId,
      title: redact(adapter.title),
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      workspaceDir,
      checks,
      artifacts: [],
      sourceAdapter: {
        id: adapter.id,
        status: adapter.status,
        adapterKind: adapter.adapterKind,
        workspaceDir: adapter.workspaceDir,
      },
      score,
      nextSafeAction: status === 'verified'
        ? 'Expose the verified adapter as a gated Action Harness candidate in the next phase.'
        : status === 'attention'
          ? 'Review warnings before any Action Harness exposure.'
          : 'Fix blocked verification checks before any promotion.',
    };

    const verificationReport = path.join(workspaceDir, 'verification-report.json');
    this.writeJson(verificationReport, { ...record, artifacts: undefined });
    record.artifacts = [
      artifact('verification-report', verificationReport),
      artifact('eval-report', evalReport),
      artifact('canary-report', canaryReport),
      artifact('security-report', securityReport),
    ];
    this.writeJson(verificationReport, record);
    record.artifacts = [
      artifact('verification-report', verificationReport),
      artifact('eval-report', evalReport),
      artifact('canary-report', canaryReport),
      artifact('security-report', securityReport),
    ];
    return record;
  }

  private evalChecks(adapter: ZavorthCapabilityAdapterDraftRecord, adapterRoot: string): ZavorthCapabilityAdapterVerificationCheck[] {
    const checks: ZavorthCapabilityAdapterVerificationCheck[] = [
      check('eval.adapter-status', 'eval', adapter.status === 'draft_ready' ? 'passed' : 'blocked', 'Adapter draft status checked.', `status=${adapter.status}`),
      check('eval.default-disabled', 'eval', adapter.manifest.defaultEnabled === false ? 'passed' : 'blocked', 'Adapter is disabled by default.', `defaultEnabled=${String(adapter.manifest.defaultEnabled)}`),
      check('eval.live-disabled', 'eval', adapter.manifest.liveAllowedByDefault === false ? 'passed' : 'blocked', 'Live activation is disabled by default.', `liveAllowedByDefault=${String(adapter.manifest.liveAllowedByDefault)}`),
      check('eval.tests-present', 'eval', adapter.manifest.tests.length > 0 ? 'passed' : 'blocked', 'Adapter declares deterministic tests.', `tests=${adapter.manifest.tests.length}`),
      check('eval.lab-report', 'eval', adapter.lab.status === 'passed' ? 'passed' : adapter.lab.status === 'warning' ? 'warning' : 'blocked', 'Capability Lab result is reusable for verification.', `lab=${adapter.lab.status}`),
    ];
    checks.push(...this.artifactIntegrityChecks(adapter, adapterRoot));
    return checks;
  }

  private canaryChecks(adapter: ZavorthCapabilityAdapterDraftRecord): ZavorthCapabilityAdapterVerificationCheck[] {
    const checks: ZavorthCapabilityAdapterVerificationCheck[] = [
      check('canary.local-dry-run', 'canary', 'passed', 'Local dry-run canary prepared.', 'The canary only verifies local metadata and generated artifacts.'),
      check('canary.no-live-endpoint', 'canary', 'passed', 'No live endpoint was invoked.', 'The verification stage does not call provider, channel or remote service APIs.'),
      check('canary.no-network', 'canary', 'passed', 'No network was used during canary verification.', 'Network checks are deferred to explicit live canaries after configuration.'),
    ];
    if (adapter.manifest.networkAccess === 'open') {
      checks.push(check('canary.network-open-blocked', 'canary', 'blocked', 'Open network access is not allowed at adapter verification stage.', 'Use allowlist access with explicit approval gates.'));
    } else if (adapter.manifest.networkAccess === 'allowlist' && !adapter.manifest.approvalRequiredFor.includes('network-access')) {
      checks.push(check('canary.network-approval-missing', 'canary', 'blocked', 'Network access requires an approval gate.', 'approvalRequiredFor must include network-access.'));
    } else {
      checks.push(check('canary.network-boundary', 'canary', 'passed', 'Network boundary is compatible with staged canary.', `networkAccess=${adapter.manifest.networkAccess}`));
    }
    return checks;
  }

  private securityChecks(adapter: ZavorthCapabilityAdapterDraftRecord, adapterRoot: string): ZavorthCapabilityAdapterVerificationCheck[] {
    const checks: ZavorthCapabilityAdapterVerificationCheck[] = [
      check('security.default-disabled', 'security', adapter.manifest.defaultEnabled === false ? 'passed' : 'blocked', 'Security boundary keeps adapter disabled.', 'No generated adapter can self-enable.'),
      check('security.no-live-default', 'security', adapter.manifest.liveAllowedByDefault === false ? 'passed' : 'blocked', 'Security boundary keeps live mode disabled.', 'Live mode needs a later explicit route.'),
      check('security.required-secret-refs', 'security', this.requiredSecretsUseEnvRefs(adapter) ? 'passed' : 'blocked', 'Required secrets are references only.', JSON.stringify(adapter.manifest.requiredSecrets)),
      check('security.policy-artifact', 'security', this.policyArtifactIsSafe(adapter, adapterRoot) ? 'passed' : 'blocked', 'Adapter policy artifact preserves activation gates.', 'Policy must keep enabled/live/tool exposure false and require eval/canary/security gates.'),
    ];
    checks.push(this.rawSecretCheck(adapter, adapterRoot));
    return checks;
  }

  private artifactIntegrityChecks(adapter: ZavorthCapabilityAdapterDraftRecord, adapterRoot: string): ZavorthCapabilityAdapterVerificationCheck[] {
    const required: ZavorthCapabilityAdapterDraftRecord['artifacts'][number]['kind'][] = [
      'adapter-manifest',
      'adapter-policy',
      'adapter-tests',
      'capability-lab-report',
    ];
    return required.map((kind) => {
      const item = adapter.artifacts.find((entry) => entry.kind === kind);
      if (!item) return check(`eval.artifact.${kind}`, 'eval', 'blocked', `${kind} artifact is missing.`, 'Generated adapter drafts must include all verification inputs.');
      try {
        const filePath = path.resolve(item.path);
        assertInside(adapterRoot, filePath);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return check(`eval.artifact.${kind}`, 'eval', 'blocked', `${kind} artifact file is missing.`, filePath);
        }
        const digest = hash(fs.readFileSync(filePath, 'utf8'));
        return check(
          `eval.artifact.${kind}`,
          'eval',
          digest === item.sha256 ? 'passed' : 'blocked',
          `${kind} artifact integrity checked.`,
          digest === item.sha256 ? 'sha256 matched' : 'sha256 mismatch; adapter draft may have been modified after generation.',
        );
      } catch (error) {
    logger.warn('[Zavorth Capability Adapter Verification] filesystem operation failed', error);
    return check(`eval.artifact.${kind}`, 'eval', 'blocked', `${kind} artifact path is unsafe.`, error instanceof Error ? error.message : String(error));
  }
    });
  }

  private requiredSecretsUseEnvRefs(adapter: ZavorthCapabilityAdapterDraftRecord): boolean {
    return adapter.manifest.requiredSecrets.every((entry) => /^env:[A-Z0-9_]+$/u.test(entry));
  }

  private policyArtifactIsSafe(adapter: ZavorthCapabilityAdapterDraftRecord, adapterRoot: string): boolean {
    const item = adapter.artifacts.find((entry) => entry.kind === 'adapter-policy');
    if (!item) return false;
    try {
      const filePath = path.resolve(item.path);
      assertInside(adapterRoot, filePath);
      const policy = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
        defaults?: { enabled?: unknown; liveAllowed?: unknown; toolExposed?: unknown };
        gates?: { evalRequired?: unknown; canaryRequired?: unknown; securityReviewRequired?: unknown; ownerApprovalRequiredForActivation?: unknown };
      };
      return policy.defaults?.enabled === false
        && policy.defaults.liveAllowed === false
        && policy.defaults.toolExposed === false
        && policy.gates?.evalRequired === true
        && policy.gates.canaryRequired === true
        && policy.gates.securityReviewRequired === true
        && policy.gates.ownerApprovalRequiredForActivation === true;
    } catch (error) { logger.warn('[Zavorth Capability Adapter Verification] module import failed', error); return false; }
  }

  private rawSecretCheck(adapter: ZavorthCapabilityAdapterDraftRecord, adapterRoot: string): ZavorthCapabilityAdapterVerificationCheck {
    const contents = [JSON.stringify(adapter.manifest, null, 2), JSON.stringify(adapter.lab, null, 2)];
    for (const artifactEntry of adapter.artifacts) {
      try {
        const filePath = path.resolve(artifactEntry.path);
        assertInside(adapterRoot, filePath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          contents.push(fs.readFileSync(filePath, 'utf8'));
        }
      } catch {
        contents.push('unsafe-artifact-path');
      }
    }
    const serialized = contents.join('\n');
    return check(
      'security.raw-secret-scan',
      'security',
      containsRawSecret(serialized) ? 'blocked' : 'passed',
      'Generated adapter artifacts do not contain raw secrets.',
      containsRawSecret(serialized) ? 'Potential raw secret pattern found in generated adapter artifacts.' : 'Only redacted values and env references were found.',
    );
  }

  private resolveWorkspace(verificationId: string): string {
    const resolved = path.resolve(this.verificationRoot, safePathId(verificationId));
    assertInside(this.verificationRoot, resolved);
    return resolved;
  }

  private writeJson(filePath: string, value: unknown): void {
    assertInside(this.verificationRoot, filePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  private readStore(): Store {
    try {
      const stats = fs.statSync(this.storeFile);
      if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return this.emptyStore();
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) as Partial<Store>;
      return {
        contractVersion: ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION,
        updatedAt: normalizeDate(parsed.updatedAt || this.timestamp()),
        verifications: Array.isArray(parsed.verifications) ? parsed.verifications.map(normalizeVerification).filter(isVerification) : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.map(normalizeReceipt).filter(isReceipt).slice(-MAX_RECEIPTS) : [],
      };
    } catch (error) {
    logger.warn('[Zavorth Capability Adapter Verification] parsing failed', error);
    return this.emptyStore();
  }
  }

  private writeStore(store: Store): void {
    const normalized: Store = {
      contractVersion: ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      verifications: store.verifications.sort((left, right) => left.id.localeCompare(right.id)),
      receipts: store.receipts.slice(-MAX_RECEIPTS),
    };
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const tempFile = `${this.storeFile}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    fs.renameSync(tempFile, this.storeFile);
  }

  private emptyStore(): Store {
    return {
      contractVersion: ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      verifications: [],
      receipts: [],
    };
  }

  private buildSnapshot(store: Store): ZavorthCapabilityAdapterVerificationSnapshot {
    const verifications = clone(store.verifications);
    const receipts = clone(store.receipts);
    return {
      contractVersion: ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION,
      generatedAt: this.timestamp(),
      surface: 'capability-adapter-verification',
      status: verifications.some((entry) => entry.status === 'blocked') || receipts.some((entry) => entry.status === 'blocked') ? 'attention' : 'ready',
      storeFile: this.storeFile,
      verificationRoot: this.verificationRoot,
      summary: {
        verifications: verifications.length,
        verified: verifications.filter((entry) => entry.status === 'verified').length,
        attention: verifications.filter((entry) => entry.status === 'attention').length,
        blocked: verifications.filter((entry) => entry.status === 'blocked').length,
        receipts: receipts.length,
      },
      verifications,
      receipts,
      safety: {
        draftReadyAdaptersOnly: true,
        deterministicEvalOnly: true,
        localCanaryOnly: true,
        securityChecksRequired: true,
        noNetworkUsed: true,
        noActionHarnessExposure: true,
        noToolExposed: true,
        noLiveActivation: true,
        secretsRedacted: true,
      },
      commands: {
        list: 'npm run zavorth:capability-verification --silent -- --list',
        verifyAll: 'npm run zavorth:capability-verification --silent -- --verify --all-adapters',
        verifySelected: 'npm run zavorth:capability-verification --silent -- --verify --adapter <adapter-draft-id>',
        nextStage: 'Expose verified adapter candidates through the Action Harness with preview, policy and receipts.',
      },
    };
  }

  private receipt(
    actor: string,
    status: ZavorthCapabilityAdapterVerificationReceipt['status'],
    adapterDraftId: string | null,
    verificationId: string | null,
    summary: string,
  ): ZavorthCapabilityAdapterVerificationReceipt {
    return {
      id: `adapter-verification-receipt:${randomUUID()}`,
      at: this.timestamp(),
      actor,
      operation: 'verify-adapter',
      status,
      adapterDraftId,
      verificationId,
      summary: redact(summary),
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function check(
  id: string,
  kind: ZavorthCapabilityAdapterVerificationCheck['kind'],
  status: ZavorthCapabilityAdapterVerificationCheck['status'],
  summary: string,
  detail: string,
): ZavorthCapabilityAdapterVerificationCheck {
  return {
    id,
    kind,
    status,
    summary: redact(summary),
    detail: redact(detail),
  };
}

function artifact(kind: ZavorthCapabilityAdapterVerificationArtifact['kind'], filePath: string): ZavorthCapabilityAdapterVerificationArtifact {
  return {
    kind,
    path: filePath,
    sha256: hash(fs.readFileSync(filePath, 'utf8')),
  };
}

function normalizeVerification(input: unknown): ZavorthCapabilityAdapterVerificationRecord | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityAdapterVerificationRecord;
  if (!clean(value.id) || !clean(value.adapterDraftId)) return null;
  const checks = Array.isArray(value.checks) ? value.checks.map(normalizeCheck).filter(isCheck) : [];
  const score = {
    passed: checks.filter((entry) => entry.status === 'passed').length,
    warnings: checks.filter((entry) => entry.status === 'warning').length,
    blocked: checks.filter((entry) => entry.status === 'blocked').length,
  };
  return {
    id: clean(value.id),
    adapterDraftId: clean(value.adapterDraftId),
    prototypeId: clean(value.prototypeId),
    candidateId: clean(value.candidateId),
    title: redact(value.title),
    status: normalizeStatus(value.status, score),
    createdAt: normalizeDate(value.createdAt),
    updatedAt: normalizeDate(value.updatedAt),
    workspaceDir: redact(value.workspaceDir),
    checks,
    artifacts: Array.isArray(value.artifacts) ? value.artifacts.map(normalizeArtifact).filter(isArtifact) : [],
    sourceAdapter: {
      id: clean(value.sourceAdapter?.id || value.adapterDraftId),
      status: value.sourceAdapter?.status || 'blocked',
      adapterKind: value.sourceAdapter?.adapterKind || 'generic-adapter',
      workspaceDir: redact(value.sourceAdapter?.workspaceDir || ''),
    },
    score,
    nextSafeAction: redact(value.nextSafeAction) || 'Review verification result.',
  };
}

function normalizeCheck(input: unknown): ZavorthCapabilityAdapterVerificationCheck | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityAdapterVerificationCheck;
  if (!clean(value.id)) return null;
  return {
    id: clean(value.id),
    kind: ['eval', 'canary', 'security'].includes(value.kind) ? value.kind : 'security',
    status: ['passed', 'warning', 'blocked'].includes(value.status) ? value.status : 'blocked',
    summary: redact(value.summary),
    detail: redact(value.detail),
  };
}

function normalizeArtifact(input: unknown): ZavorthCapabilityAdapterVerificationArtifact | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityAdapterVerificationArtifact;
  if (!['verification-report', 'eval-report', 'canary-report', 'security-report'].includes(value.kind) || !clean(value.path)) return null;
  return {
    kind: value.kind,
    path: redact(value.path),
    sha256: clean(value.sha256),
  };
}

function normalizeReceipt(input: unknown): ZavorthCapabilityAdapterVerificationReceipt | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityAdapterVerificationReceipt;
  if (!clean(value.id)) return null;
  return {
    id: clean(value.id),
    at: normalizeDate(value.at),
    actor: clean(value.actor || 'system'),
    operation: 'verify-adapter',
    status: ['applied', 'skipped', 'blocked'].includes(value.status) ? value.status : 'blocked',
    adapterDraftId: value.adapterDraftId ? clean(value.adapterDraftId) : null,
    verificationId: value.verificationId ? clean(value.verificationId) : null,
    summary: redact(value.summary),
  };
}

function normalizeStatus(
  status: unknown,
  score: { warnings: number; blocked: number },
): ZavorthCapabilityAdapterVerificationStatus {
  if (score.blocked > 0) return 'blocked';
  if (score.warnings > 0) return 'attention';
  if (status === 'verified' || status === 'attention' || status === 'blocked') return status;
  return 'verified';
}

function isVerification(value: ZavorthCapabilityAdapterVerificationRecord | null): value is ZavorthCapabilityAdapterVerificationRecord {
  return Boolean(value);
}

function isCheck(value: ZavorthCapabilityAdapterVerificationCheck | null): value is ZavorthCapabilityAdapterVerificationCheck {
  return Boolean(value);
}

function isArtifact(value: ZavorthCapabilityAdapterVerificationArtifact | null): value is ZavorthCapabilityAdapterVerificationArtifact {
  return Boolean(value);
}

function isReceipt(value: ZavorthCapabilityAdapterVerificationReceipt | null): value is ZavorthCapabilityAdapterVerificationReceipt {
  return Boolean(value);
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Capability adapter verification path must stay inside the expected workspace root.');
  }
}

function containsRawSecret(value: string): boolean {
  if (/\bsk-[A-Za-z0-9_-]{6,}\b/u.test(value)
    || /\bxox[baprs]-[A-Za-z0-9-]{6,}\b/u.test(value)
    || /\bgh[pousr]_[A-Za-z0-9_]{6,}\b/u.test(value)
    || /\bAIza[0-9A-Za-z_-]{8,}\b/u.test(value)) {
    return true;
  }
  const assignmentPattern = /\b(token|secret|password|api[_ -]?key)\s*[:=]\s*([^\s,;]+)/giu;
  let match = assignmentPattern.exec(value);
  while (match) {
    const assignedValue = String(match[2] || '').trim().replace(/^["'`]+|["'`.,;]+$/gu, '');
    if (assignedValue && assignedValue !== '[REDACTED]' && !assignedValue.startsWith('env:')) return true;
    match = assignmentPattern.exec(value);
  }
  return false;
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
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || 'verification';
}

function clean(value: unknown): string {
  return redact(value).replace(/\s+/gu, ' ').trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
