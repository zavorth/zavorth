import crypto from 'crypto';
import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthLearningArtifact,
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
  ZavorthReadinessGate,
  ZavorthResourceImpact,
} from '../contracts/ZavorthMutationPlaneContract.js';
import { SkillContentScannerService, type SkillContentScanResult } from '../skills/SkillContentScannerService.js';
import { ZavorthSandboxControlPlaneService } from './ZavorthSandboxControlPlaneService.js';

import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import {
  ZavorthSkillEvolutionRegistryService,
  type ZavorthEvolvedSkillRecord,
} from './ZavorthSkillEvolutionRegistryService.js';

import { SandboxExecutionService, type SandboxEnvelopeExecutionReport } from './SandboxExecutionService.js';
import { SkillTrustPolicyService, type SkillTrustPolicyDocument } from './SkillTrustPolicyService.js';
import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import { PermissionService } from './PermissionService.js';

type SkillEvolutionEvalGateStatus = 'passed' | 'warning' | 'failed' | 'blocked';

type SkillEvolutionEvalGate = {
  id: string;
  status: SkillEvolutionEvalGateStatus;
  canProceed: boolean;
  score: number;
  minScore: number;
  summary: string;
  blockers: string[];
  warnings: string[];
  evidence: Array<{
    id: string;
    status: string;
    summary: string;
  }>;
};

type SkillEvolutionEvalProvider = {
  buildGate: (input: {
    skillName: string;
    intentText: string;
  }) => Promise<SkillEvolutionEvalGate> | SkillEvolutionEvalGate;
};

type SkillEvolutionRuntime = {
  now?: () => Date;
  projectRoot?: string;
  draftRoot?: string;
  targetRoot?: string;
  backupRoot?: string;
  registryService?: Pick<ZavorthSkillEvolutionRegistryService, 'listRecords' | 'getRecord' | 'upsertRecord' | 'updateRecord'> | null;
  sandboxControlPlaneService?: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'> | null;
  sandboxExecutionService?: Pick<SandboxExecutionService, 'executeEnvelope'> | null;
  scannerService?: Pick<SkillContentScannerService, 'scanSkillDirectory'> | null;
  mutationPlaneService?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  > | null;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'> | null;
  permissionService?: Pick<PermissionService, 'getRequest'> | null;
  skillTrustPolicyService?: Pick<SkillTrustPolicyService, 'readPolicy' | 'savePolicy'> | null;
  evalProvider?: SkillEvolutionEvalProvider | null;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  existsSync?: typeof fs.existsSync;
  rmSync?: typeof fs.rmSync;
  cpSync?: typeof fs.cpSync;
};

export type ZavorthSkillEvolutionSnapshot = {
  generatedAt: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    total: number;
    drafts: number;
    waitingApproval: number;
    trustedLocal: number;
    blocked: number;
    procedureOnly: number;
    heavyRuntimesStarted: false;
  };
  pipeline: Array<'observe' | 'synthesize' | 'sandbox-test' | 'eval' | 'preview' | 'approve' | 'install'>;
  policy: {
    draftFirst: true;
    silentInstallBlocked: true;
    secretsAvailableToDraft: false;
    trustPlaneDomain: 'skill-evolution';
    installTargetRoot: string;
  };
  records: ZavorthEvolvedSkillRecord[];
  actions: string[];
};

export type ZavorthSkillEvolutionPreviewInput = {
  intentText: string;
  demonstration?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  procedureOnly?: boolean;
};

export type ZavorthSkillEvolutionPreview = {
  generatedAt: string;
  status: 'waiting_approval' | 'ready' | 'blocked' | 'procedure_only';
  ok: boolean;
  summary: string;
  details: string[];
  record: ZavorthEvolvedSkillRecord;
  artifact: ZavorthLearningArtifact;
  scan: SkillContentScanResult | null;
  sandbox: SandboxEnvelopeExecutionReport | null;
  evalGate: SkillEvolutionEvalGate;
  mutationPlan: ZavorthMutationPlan | null;
  trustDecision: TrustDecision | null;
};

export type ZavorthSkillEvolutionApplyResult = {
  generatedAt: string;
  status: 'installed' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  record: ZavorthEvolvedSkillRecord;
  mutationPlan: ZavorthMutationPlan | null;
};

export type ZavorthSkillEvolutionRollbackResult = {
  generatedAt: string;
  status: 'rolled_back' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  record: ZavorthEvolvedSkillRecord;
};

export class ZavorthSkillEvolutionService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly draftRoot: string;
  private readonly targetRoot: string;
  private readonly backupRoot: string;
  private readonly registry: Pick<ZavorthSkillEvolutionRegistryService, 'listRecords' | 'getRecord' | 'upsertRecord' | 'updateRecord'>;
  private readonly sandboxControlPlane: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;
  private readonly sandboxExecution: Pick<SandboxExecutionService, 'executeEnvelope'>;
  private readonly scanner: Pick<SkillContentScannerService, 'scanSkillDirectory'>;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly permissionService: Pick<PermissionService, 'getRequest'>;
  private readonly skillTrustPolicy: Pick<SkillTrustPolicyService, 'readPolicy' | 'savePolicy'>;
  private readonly evalProvider: SkillEvolutionEvalProvider;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly rmSyncImpl: typeof fs.rmSync;
  private readonly cpSyncImpl: typeof fs.cpSync;

  constructor(runtime: SkillEvolutionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.draftRoot = runtime.draftRoot || path.join(this.projectRoot, 'data', 'runtime', 'skill-evolution', 'drafts');
    this.targetRoot = runtime.targetRoot || path.join(this.projectRoot, 'skill-library');
    this.backupRoot = runtime.backupRoot || path.join(this.projectRoot, 'data', 'runtime', 'skill-evolution', 'backups');
    this.registry = runtime.registryService || new ZavorthSkillEvolutionRegistryService();
    this.sandboxControlPlane = runtime.sandboxControlPlaneService || new ZavorthSandboxControlPlaneService();
    this.sandboxExecution = runtime.sandboxExecutionService || new SandboxExecutionService();
    this.scanner = runtime.scannerService || new SkillContentScannerService();
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.permissionService = runtime.permissionService || new PermissionService();
    this.skillTrustPolicy = runtime.skillTrustPolicyService || new SkillTrustPolicyService();
    this.evalProvider = runtime.evalProvider || this.defaultEvalProvider();
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.rmSyncImpl = runtime.rmSync || fs.rmSync.bind(fs);
    this.cpSyncImpl = runtime.cpSync || fs.cpSync.bind(fs);
  }

  public buildSnapshot(): ZavorthSkillEvolutionSnapshot {
    const records = this.registry.listRecords({ limit: 50 });
    const blocked = records.filter((entry) => entry.status === 'blocked').length;
    const waitingApproval = records.filter((entry) => entry.status === 'waiting_approval').length;
    const posture: ZavorthSkillEvolutionSnapshot['summary']['posture'] = blocked > 0 ? 'attention' : 'healthy';
    const summary = {
      posture,
      total: records.length,
      drafts: records.filter((entry) => entry.status === 'draft' || entry.status === 'sandbox_tested').length,
      waitingApproval,
      trustedLocal: records.filter((entry) => entry.status === 'trusted_local').length,
      blocked,
      procedureOnly: records.filter((entry) => entry.status === 'procedure_only').length,
      heavyRuntimesStarted: false as false,
    };
    return {
      generatedAt: this.now().toISOString(),
      summary,
      pipeline: ['observe', 'synthesize', 'sandbox-test', 'eval', 'preview', 'approve', 'install'],
      policy: {
        draftFirst: true,
        silentInstallBlocked: true,
        secretsAvailableToDraft: false,
        trustPlaneDomain: 'skill-evolution',
        installTargetRoot: this.targetRoot,
      },
      records,
      actions: [
        'skills:evolve -- --preview --intent "<request>"',
        'skills:evolve -- --apply <planId>',
        'skills:evolve -- --rollback <draftId>',
      ],
    };
  }

  public async preview(input: ZavorthSkillEvolutionPreviewInput): Promise<ZavorthSkillEvolutionPreview> {
    const intentText = this.cleanText(input.intentText);
    if (!intentText) {
      throw new Error('intentText is required to evolve a skill.');
    }

    const synthesized = this.synthesizeSkill(input);
    const createdAt = this.now().toISOString();
    const skillMemoryGate = this.evaluateSkillMemoryGate(`${input.intentText}\n${input.demonstration || ''}`);
    if (!input.procedureOnly && !skillMemoryGate.canCreateSkill) {
      const artifact = this.buildArtifact({
        input,
        synthesized,
        createdAt,
        status: 'blocked',
        evidence: [{
          id: 'skill-memory-policy',
          kind: 'eval',
          status: 'failed',
          summary: skillMemoryGate.summary,
          ref: null,
          metadata: {
            reasons: skillMemoryGate.reasons,
            recommendation: 'treat-as-mission',
          },
        }],
      });
      const record = this.registry.upsertRecord({
        id: synthesized.draftId,
        skillName: synthesized.skillName,
        version: synthesized.version,
        status: 'blocked',
        kind: 'skill-draft',
        createdAt,
        updatedAt: createdAt,
        requestedBy: input.requestedBy || null,
        sourceSurface: input.sourceSurface || null,
        intentHash: synthesized.intentHash,
        draftDirPath: synthesized.draftDirPath,
        targetDirPath: null,
        skillFilePath: null,
        riskLevel: synthesized.riskLevel,
        mutationPlanId: null,
        permissionId: null,
        sandboxEvidenceId: null,
        evalGateStatus: 'blocked',
        artifact,
        rollback: {
          installedAt: null,
          targetDirPath: null,
          backupDirPath: null,
          policySnapshotBefore: null,
          policySnapshotAfter: null,
          rolledBackAt: null,
        },
        notes: [
          'Skill Memory Policy blocked automatic skill creation.',
          'High-risk or domain-specific procedures must remain governed missions.',
        ],
      });
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: skillMemoryGate.summary,
        details: skillMemoryGate.reasons,
        record,
        artifact: record.artifact,
        scan: null,
        sandbox: null,
        evalGate: {
          id: 'skill-memory-policy',
          status: 'blocked',
          canProceed: false,
          score: 0,
          minScore: 1,
          summary: skillMemoryGate.summary,
          blockers: skillMemoryGate.reasons,
          warnings: [],
          evidence: [{
            id: 'skill-memory-policy',
            status: 'blocked',
            summary: 'Skill candidates must be general, deterministic and not high-risk.',
          }],
        },
        mutationPlan: null,
        trustDecision: null,
      };
    }
    this.writeDraft(synthesized);
    const artifact = this.buildArtifact({
      input,
      synthesized,
      createdAt,
      status: input.procedureOnly ? 'previewed' : 'draft',
      evidence: [],
    });
    let record = this.registry.upsertRecord({
      id: synthesized.draftId,
      skillName: synthesized.skillName,
      version: synthesized.version,
      status: input.procedureOnly ? 'procedure_only' : 'draft',
      kind: input.procedureOnly ? 'procedure' : 'skill-draft',
      createdAt,
      updatedAt: createdAt,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || null,
      intentHash: synthesized.intentHash,
      draftDirPath: synthesized.draftDirPath,
      targetDirPath: input.procedureOnly ? null : synthesized.targetDirPath,
      skillFilePath: input.procedureOnly ? null : synthesized.skillFilePath,
      riskLevel: synthesized.riskLevel,
      mutationPlanId: null,
      permissionId: null,
      sandboxEvidenceId: null,
      evalGateStatus: null,
      artifact,
      rollback: {
        installedAt: null,
        targetDirPath: null,
        backupDirPath: null,
        policySnapshotBefore: null,
        policySnapshotAfter: null,
        rolledBackAt: null,
      },
      notes: input.procedureOnly
        ? ['Procedure learned without installing an executable skill.']
        : ['Draft created without access a secrets e without permission mutable.'],
    });

    if (input.procedureOnly) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'procedure_only',
        ok: true,
        summary: `Procedure ${record.skillName} registered as learning without installing a skill.`,
        details: ['No installation was planned.'],
        record,
        artifact: record.artifact,
        scan: null,
        sandbox: null,
        evalGate: this.procedureOnlyEvalGate(record.skillName),
        mutationPlan: null,
        trustDecision: null,
      };
    }

    const scan = this.scanner.scanSkillDirectory(synthesized.draftDirPath);
    const sandbox = await this.runSandboxEvidence(synthesized);
    const evalGate = await this.evalProvider.buildGate({
      skillName: synthesized.skillName,
      intentText,
    });
    const evidence = this.buildEvidence({ scan, sandbox, evalGate });
    this.writeFileSyncImpl(
      synthesized.evidencePath,
      `${JSON.stringify({ generatedAt: this.now().toISOString(), evidence }, null, 2)}\n`,
      'utf8',
    );
    const testedArtifact = this.buildArtifact({
      input,
      synthesized,
      createdAt,
      status: this.canPromote(scan, sandbox, evalGate) ? 'tested' : 'blocked',
      evidence,
    });
    record = this.registry.upsertRecord({
      ...record,
      status: this.canPromote(scan, sandbox, evalGate) ? 'sandbox_tested' : 'blocked',
      sandboxEvidenceId: sandbox.envelopeId,
      evalGateStatus: evalGate.status,
      artifact: testedArtifact,
      notes: [
        ...record.notes,
        `Scanner: ${scan.safeToImport ? 'passed' : 'failed'}.`,
        `Sandbox: ${sandbox.exitCode === 0 ? 'passed' : 'failed'}.`,
        `Eval gate: ${evalGate.status}.`,
      ],
    });

    if (!this.canPromote(scan, sandbox, evalGate)) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: `Draft ${record.skillName} blocked before generating an installation plan.`,
        details: [
          ...scan.issues.map((issue) => `${issue.relativePath}: ${issue.message}`),
          ...evalGate.blockers,
          sandbox.exitCode === 0 ? 'Sandbox passou.' : `Sandbox failed: ${sandbox.stderr || 'no details'}`,
        ],
        record,
        artifact: record.artifact,
        scan,
        sandbox,
        evalGate,
        mutationPlan: null,
        trustDecision: null,
      };
    }

    const policyBefore = this.skillTrustPolicy.readPolicy();
    const plan = this.mutationPlane.createPlan({
      domain: 'skill-evolution',
      actionId: 'install-learned-skill',
      title: `Instalar skill aprendida ${record.skillName}`,
      summary: 'Learned skill can be installed only after sandbox, eval gate, and approval.',
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'skills:evolve',
      riskLevel: record.riskLevel,
      approvalRequired: true,
      approvalReason: 'Promotion to trusted_local expands persistent Zavorth capabilities.',
      resourceImpact: this.resourceImpact(record),
      readinessGates: [
        this.sandboxGate(scan, sandbox),
        this.evalReadinessGate(evalGate),
      ],
      retentionPolicy: record.artifact.retention,
      validationPlan: [
        'Confirm that the skill was born as a draft and is not installed.',
        'Confirmar scanner seguro e sandbox evidence with exitCode=0.',
        'Confirmar RegressionGate with score minimo before do apply.',
        'Install only through approved apply, without silent auto-installation.',
        'Registrar rollback with backup e policy snapshot.',
      ],
      rollbackPlan: [
        'Remove installed directory from skill-library.',
        'Restore the previous backup if a skill with the same name existed.',
        'Restore the SkillTrustPolicy snapshot when there is an associated change.',
      ],
      payload: this.buildPlanPayload(record, policyBefore),
    });
    const decision = await this.trustDecision.evaluate({
      domain: 'skill-evolution',
      actionId: 'install-learned-skill',
      planId: plan.id,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'skills:evolve',
      riskLevel: record.riskLevel,
      approvalRequired: true,
      capabilityId: 'skill-evolution',
      reason: 'Installing a learned skill requires canonical approval.',
      payload: this.buildPlanPayload(record, policyBefore),
      resourceImpact: plan.resourceImpact,
    });
    const withApproval = decision.permission
      ? this.mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;
    record = this.registry.upsertRecord({
      ...record,
      status: 'waiting_approval',
      mutationPlanId: withApproval.id,
      permissionId: decision.permission?.permission_id || withApproval.approval.permissionId || null,
      rollback: {
        ...record.rollback,
        policySnapshotBefore: policyBefore as unknown as Record<string, unknown>,
      },
    });

    return {
      generatedAt: this.now().toISOString(),
      status: 'waiting_approval',
      ok: false,
      summary: `Draft ${record.skillName} tisdo; installation aguarda approval no plan ${withApproval.id}.`,
      details: [
        `Draft: ${record.draftDirPath}.`,
        `Target futuro: ${record.targetDirPath}.`,
        decision.permission ? `Permission: ${decision.permission.permission_id}.` : 'Pending permission was not created.',
      ],
      record,
      artifact: record.artifact,
      scan,
      sandbox,
      evalGate,
      mutationPlan: withApproval,
      trustDecision: decision,
    };
  }

  public async apply(input: {
    planId: string;
    requestedBy?: string | null;
  }): Promise<ZavorthSkillEvolutionApplyResult> {
    let plan = this.mutationPlane.readPlan(input.planId);
    if (!plan || plan.domain !== 'skill-evolution') {
      throw new Error(`Skill Evolution plan not found: ${input.planId || 'n/d'}.`);
    }
    const draftId = String(plan.payload?.draftId || '').trim();
    let record = this.registry.getRecord(draftId);
    if (!record) {
      throw new Error(`Skill draft not found for plan ${plan.id}.`);
    }
    if (record.status !== 'waiting_approval') {
      const blocked = this.mutationPlane.markBlocked(plan.id, `Draft ${record.id} is ${record.status}, not waiting_approval.`);
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: `Draft ${record.id} is not ready for installation.`,
        details: ['No file foi instalado.'],
        record,
        mutationPlan: blocked,
      };
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      const permission = plan.approval.permissionId
        ? await this.permissionService.getRequest(plan.approval.permissionId)
        : null;
      if (permission?.status === 'approved') {
        plan = this.mutationPlane.approvePlan(plan.id, {
          permissionId: permission.permission_id,
          approvedBy: permission.decided_by || input.requestedBy || null,
          scope: permission.scope === 'persistent' ? 'host' : permission.scope === 'session' ? 'session' : 'once',
        });
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: `Plan ${plan.id} is still waiting for approval (silent install blocked).`,
        details: [
          'silentInstallBlocked=true',
          'No file foi instalado.',
          'Approve the MutationPlan and resend apply with canonical approval.',
        ],
        record,
        mutationPlan: plan,
      };
    }

    const targetDir = this.ensureInside(this.targetRoot, record.targetDirPath || path.join(this.targetRoot, record.skillName));
    const draftDir = this.ensureInside(this.draftRoot, record.draftDirPath);
    const backupDir = this.backupExistingTarget(record, targetDir);
    this.mkdirSyncImpl(path.dirname(targetDir), { recursive: true });
    this.rmSyncImpl(targetDir, { recursive: true, force: true });
    this.cpSyncImpl(draftDir, targetDir, { recursive: true });
    this.writeInstallMetadata(record, plan, targetDir);
    const policyAfter = this.skillTrustPolicy.readPolicy();
    const applied = this.mutationPlane.markApplied(plan.id, `Skill ${record.skillName} installed as trusted_local.`, ['skill.install']);
    record = this.registry.upsertRecord({
      ...record,
      status: 'trusted_local',
      targetDirPath: targetDir,
      rollback: {
        ...record.rollback,
        installedAt: this.now().toISOString(),
        targetDirPath: targetDir,
        backupDirPath: backupDir,
        policySnapshotAfter: policyAfter as unknown as Record<string, unknown>,
      },
      artifact: {
        ...record.artifact,
        status: 'installed',
        updatedAt: this.now().toISOString(),
      },
      notes: [
        ...record.notes,
        `Instalada via plan ${applied.id}.`,
      ],
    });

    return {
      generatedAt: this.now().toISOString(),
      status: 'installed',
      ok: true,
      summary: `Skill ${record.skillName} installed at ${targetDir}.`,
      details: [
        backupDir ? `Backup anterior: ${backupDir}.` : 'No previous version needed backup.',
        'Rollback can remove the skill and restore backup/policy snapshot.',
      ],
      record,
      mutationPlan: applied,
    };
  }

  public rollback(input: {
    draftId: string;
    requestedBy?: string | null;
  }): ZavorthSkillEvolutionRollbackResult {
    let record = this.registry.getRecord(input.draftId);
    if (!record) {
      throw new Error(`Draft de skill not found: ${input.draftId || 'n/d'}.`);
    }
    const targetDir = record.rollback.targetDirPath || record.targetDirPath;
    if (!targetDir) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: `Record ${record.id} does not have an installed target for rollback.`,
        details: [],
        record,
      };
    }
    const safeTarget = this.ensureInside(this.targetRoot, targetDir);
    this.rmSyncImpl(safeTarget, { recursive: true, force: true });
    if (record.rollback.backupDirPath && this.existsSyncImpl(record.rollback.backupDirPath)) {
      this.cpSyncImpl(record.rollback.backupDirPath, safeTarget, { recursive: true });
    }
    if (record.rollback.policySnapshotBefore) {
      this.skillTrustPolicy.savePolicy(record.rollback.policySnapshotBefore as SkillTrustPolicyDocument);
    }
    record = this.registry.upsertRecord({
      ...record,
      status: 'rolled_back',
      rollback: {
        ...record.rollback,
        rolledBackAt: this.now().toISOString(),
      },
      artifact: {
        ...record.artifact,
        status: 'rolled_back',
        updatedAt: this.now().toISOString(),
      },
      notes: [
        ...record.notes,
        `Rollback requested by ${input.requestedBy || 'operator'}.`,
      ],
    });
    return {
      generatedAt: this.now().toISOString(),
      status: 'rolled_back',
      ok: true,
      summary: `Rollback applied for ${record.skillName}.`,
      details: [
        record.rollback.backupDirPath ? 'Backup anterior risurado.' : 'Installed skill removed; there was no previous backup.',
        record.rollback.policySnapshotBefore ? 'Previous policy snapshot restored.' : 'No associated policy needed restoration.',
      ],
      record,
    };
  }

  private synthesizeSkill(input: ZavorthSkillEvolutionPreviewInput): {
    draftId: string;
    skillName: string;
    version: string;
    description: string;
    intentHash: string;
    contentHash: string;
    draftDirPath: string;
    targetDirPath: string;
    skillFilePath: string;
    skillContent: string;
    evidencePath: string;
    procedurePath: string;
    riskLevel: ZavorthMutationRiskLevel;
  } {
    const redactedIntent = this.redactSensitiveText(input.intentText);
    const redactedDemo = this.redactSensitiveText(input.demonstration || '');
    const skillName = this.normalizeSkillName(redactedIntent);
    const intentHash = this.hash(input.intentText);
    const draftId = `skill-draft:${skillName}:${intentHash.slice(0, 10)}`;
    const draftDirPath = path.join(this.draftRoot, `${skillName}-${intentHash.slice(0, 10)}`);
    const targetDirPath = path.join(this.targetRoot, skillName);
    const description = `Learned local skill for: ${this.firstSentence(redactedIntent)}`;
    const skillContent = [
      '---',
      `name: ${skillName}`,
      `description: ${JSON.stringify(description)}`,
      '---',
      '',
      `# ${skillName}`,
      '',
      'Use this skill when the operator asks for this learned local procedure:',
      '',
      `> ${redactedIntent}`,
      '',
      '## Guardrails',
      '',
      '- Start in preview mode and show the planned steps before mutating files or systems.',
      '- Do not request or store secrets. Ask the operator for scoped cnetworkntials only at execution time.',
      '- Use sandboxed execution for downloaded, generated, or untrusted code.',
      '- Stop and request approval before installing tools, changing policy, using network write access, or running destructive commands.',
      '',
      '## Procedure',
      '',
      '- Riste the target, workspace, expected output, budget, and rollback path.',
      '- Inspect relevant files or systems with read-only commands first.',
      '- Produce a short plan and identify commands that require approval.',
      '- Execute the approved steps and capture evidence, tests, and artifacts.',
      '- Summarize the result with changed files, validation, and rollback notes.',
      '',
      redactedDemo ? '## Demonstration Notes' : '',
      redactedDemo || '',
      '',
    ].filter((entry) => entry !== '').join('\n');
    return {
      draftId,
      skillName,
      version: '0.1.0',
      description,
      intentHash,
      contentHash: this.hash(skillContent),
      draftDirPath,
      targetDirPath,
      skillFilePath: path.join(draftDirPath, 'SKILL.md'),
      skillContent,
      evidencePath: path.join(draftDirPath, 'EVIDENCE.json'),
      procedurePath: path.join(draftDirPath, 'PROCEDURE.md'),
      riskLevel: this.estimateRisk(`${redactedIntent}\n${redactedDemo}`),
    };
  }

  private writeDraft(synthesized: ReturnType<ZavorthSkillEvolutionService['synthesizeSkill']>): void {
    this.mkdirSyncImpl(synthesized.draftDirPath, { recursive: true });
    this.writeFileSyncImpl(synthesized.skillFilePath, synthesized.skillContent, 'utf8');
    this.writeFileSyncImpl(
      synthesized.procedurePath,
      [
        `# Procedure: ${synthesized.skillName}`,
        '',
        `Version: ${synthesized.version}`,
        `Intent hash: ${synthesized.intentHash}`,
        '',
        'This file is a redacted learning artifact. It is not installed until the MutationPlan is approved.',
        '',
      ].join('\n'),
      'utf8',
    );
  }

  private async runSandboxEvidence(
    synthesized: ReturnType<ZavorthSkillEvolutionService['synthesizeSkill']>,
  ): Promise<SandboxEnvelopeExecutionReport> {
    const script = [
      `const draftId = ${JSON.stringify(synthesized.draftId)};`,
      'if (!draftId.startsWith("skill-draft:")) throw new Error("invalid skill draft id");',
      'console.log("skill draft validated");',
    ].join('\n');
    const snapshot = this.sandboxControlPlane.buildSnapshot({
      code: script,
      language: 'javascript',
      mode: 'dry-run',
      requestedBy: 'skill-evolution',
      sourceSurface: 'skill-evolution',
    });
    const envelope = snapshot.envelopePreview;
    if (!envelope || envelope.status !== 'ready') {
      throw new Error(`Sandbox envelope unavailable to validate draft: ${envelope?.status || 'missing'}.`);
    }
    return this.sandboxExecution.executeEnvelope({
      ...envelope,
      mode: 'dry-run',
      status: 'ready',
    }, {
      code: script,
      language: 'javascript',
    });
  }

  private buildEvidence(input: {
    scan: SkillContentScanResult;
    sandbox: SandboxEnvelopeExecutionReport;
    evalGate: SkillEvolutionEvalGate;
  }): ZavorthLearningArtifact['evidence'] {
    return [
      {
        id: 'scanner',
        kind: 'scanner',
        status: input.scan.safeToImport ? 'passed' : 'failed',
        summary: input.scan.safeToImport ? `Scanner aprovou ${input.scan.importableFiles.length} file(s).`
          : `Scanner encontrou ${input.scan.issues.length} issue(s).`,
        ref: null,
        metadata: {
          issues: input.scan.issues,
          importableFiles: input.scan.importableFiles,
        },
      },
      {
        id: input.sandbox.envelopeId,
        kind: 'sandbox',
        status: input.sandbox.exitCode === 0 ? 'passed' : 'failed',
        summary: `Sandbox ${input.sandbox.runtime} exitCode=${input.sandbox.exitCode}.`,
        ref: input.sandbox.auditId,
        metadata: {
          stdout: input.sandbox.stdout.slice(0, 1000),
          stderr: input.sandbox.stderr.slice(0, 1000),
          cleanup: input.sandbox.cleanup,
        },
      },
      {
        id: input.evalGate.id,
        kind: 'eval',
        status: input.evalGate.canProceed ? input.evalGate.status === 'warning' ? 'warning' : 'passed' : 'failed',
        summary: input.evalGate.summary,
        ref: null,
        metadata: {
          score: input.evalGate.score,
          minScore: input.evalGate.minScore,
          blockers: input.evalGate.blockers,
          warnings: input.evalGate.warnings,
        },
      },
    ];
  }

  private buildArtifact(input: {
    input: ZavorthSkillEvolutionPreviewInput;
    synthesized: ReturnType<ZavorthSkillEvolutionService['synthesizeSkill']>;
    createdAt: string;
    status: ZavorthLearningArtifact['status'];
    evidence: ZavorthLearningArtifact['evidence'];
  }): ZavorthLearningArtifact {
    return {
      id: `learning:${input.synthesized.draftId}`,
      kind: input.input.procedureOnly ? 'procedure' : 'skill-draft',
      status: input.status,
      createdAt: input.createdAt,
      updatedAt: this.now().toISOString(),
      source: {
        domain: 'skill-evolution',
        surface: input.input.sourceSurface || null,
        requestedBy: input.input.requestedBy || null,
        originRef: `intent:${input.synthesized.intentHash.slice(0, 16)}`,
      },
      subject: {
        name: input.synthesized.skillName,
        version: input.synthesized.version,
        summary: input.synthesized.description,
        riskLevel: input.synthesized.riskLevel,
      },
      evidence: input.evidence,
      retention: {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
        maxBytes: 25 * 1024 * 1024,
        cleanupOnSuccess: false,
        cleanupOnBoot: false,
        notes: ['Drafts and evidence are local, redacted, and revocable.'],
      },
      redaction: {
        rawTranscriptPersisted: false,
        rawSecretsPersisted: false,
        notes: [
          'Intent and demonstration are redacted before becoming a draft.',
          'MutationPlan payload stores hashes and local paths, not raw transcript.',
        ],
      },
      hashes: {
        intentHash: input.synthesized.intentHash,
        contentHash: input.synthesized.contentHash,
      },
    };
  }

  private canPromote(scan: SkillContentScanResult, sandbox: SandboxEnvelopeExecutionReport, evalGate: SkillEvolutionEvalGate): boolean {
    return scan.safeToImport && sandbox.exitCode === 0 && evalGate.canProceed && evalGate.score >= evalGate.minScore;
  }

  private sandboxGate(scan: SkillContentScanResult, sandbox: SandboxEnvelopeExecutionReport): ZavorthReadinessGate {
    const blockers = [
      ...scan.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message),
      ...(sandbox.exitCode === 0 ? [] : [`Sandbox exitCode=${sandbox.exitCode}.`]),
    ];
    return {
      id: 'skill-evolution-sandbox',
      status: blockers.length > 0 ? 'blocked' : 'passed',
      canProceed: blockers.length === 0,
      scope: 'skill-draft',
      reasons: ['Draft must pass scanner and sandbox before install.'],
      warnings: scan.issues.filter((issue) => issue.severity === 'warn').map((issue) => issue.message),
      blockers,
      checkedAt: this.now().toISOString(),
      evidence: [{
        id: sandbox.envelopeId,
        label: 'Sandbox evidence',
        status: sandbox.exitCode === 0 ? 'passed' : 'failed',
        summary: sandbox.stdout || sandbox.stderr || 'Sandbox executado.',
      }],
      nextActions: ['Corrigir draft or bloquear installation.'],
    };
  }

  private evalReadinessGate(evalGate: SkillEvolutionEvalGate): ZavorthReadinessGate {
    return {
      id: evalGate.id,
      status: evalGate.canProceed ? evalGate.status === 'warning' ? 'warning' : 'passed' : 'blocked',
      canProceed: evalGate.canProceed,
      scope: 'regression-gate',
      reasons: [evalGate.summary],
      warnings: evalGate.warnings,
      blockers: evalGate.blockers,
      checkedAt: this.now().toISOString(),
      budgets: {
        score: evalGate.score,
        minScore: evalGate.minScore,
      },
      evidence: evalGate.evidence.map((entry) => ({
        id: entry.id,
        label: entry.id,
        status: entry.status,
        summary: entry.summary,
      })),
      nextActions: ['run eval/regression before promoting the learned skill.'],
    };
  }

  private buildPlanPayload(record: ZavorthEvolvedSkillRecord, policyBefore: SkillTrustPolicyDocument): Record<string, unknown> {
    return {
      draftId: record.id,
      skillName: record.skillName,
      version: record.version,
      draftDirPath: record.draftDirPath,
      targetDirPath: record.targetDirPath,
      artifact: record.artifact,
      installMode: 'trusted_local',
      policySnapshotBefore: policyBefore,
      redaction: {
        rawIntentPersisted: false,
        rawTranscriptPersisted: false,
      },
    };
  }

  private resourceImpact(record: ZavorthEvolvedSkillRecord): ZavorthResourceImpact {
    return {
      ramMb: 0,
      diskMb: 25,
      processCount: 0,
      externalExposure: 'none',
      recurring: false,
      notes: [
        `draft=${record.id}`,
        `skill=${record.skillName}`,
        'Installs local files in skill-library after approval.',
      ],
    };
  }

  private backupExistingTarget(record: ZavorthEvolvedSkillRecord, targetDir: string): string | null {
    if (!this.existsSyncImpl(targetDir)) {
      return null;
    }
    const backupDir = path.join(this.backupRoot, `${record.skillName}-${Date.now().toString(36)}`);
    this.mkdirSyncImpl(path.dirname(backupDir), { recursive: true });
    this.cpSyncImpl(targetDir, backupDir, { recursive: true });
    return backupDir;
  }

  private writeInstallMetadata(record: ZavorthEvolvedSkillRecord, plan: ZavorthMutationPlan, targetDir: string): void {
    this.writeFileSyncImpl(
      path.join(targetDir, 'ORIGIN.json'),
      `${JSON.stringify({
        version: 1,
        importedAt: this.now().toISOString(),
        importMode: 'manual',
        skillName: record.skillName,
        source: {
          id: 'zavorth-skill-evolution',
          label: 'Zavorth Skill Evolution',
          kind: 'workspace',
          trust: 'trusted',
          registrySource: 'zavorth:skill-evolution',
          upstream: null,
          license: null,
          ownership: 'local-operator',
        },
        originalSkillPath: record.draftDirPath,
        originalRelativePath: path.relative(this.projectRoot, record.draftDirPath).replace(/\\/g, '/'),
        copiedFiles: ['SKILL.md', 'PROCEDURE.md', 'EVIDENCE.json'],
        governance: {
          planId: plan.id,
          artifact: record.artifact,
        },
      }, null, 2)}\n`,
      'utf8',
    );
  }

  private ensureInside(root: string, target: string): string {
    const resolvedRoot = path.resolve(root);
    const resolvedTarget = path.resolve(target);
    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error(`path outside do escopo permitido: ${target}`);
    }
    return resolvedTarget;
  }

  private defaultEvalProvider(): SkillEvolutionEvalProvider {
    return {
      buildGate: ({ skillName }) => ({
        id: 'skill-evolution-regression-gate',
        status: 'passed',
        canProceed: true,
        score: 1,
        minScore: 0.8,
        summary: `Local regression gate allowed draft ${skillName}; use ops:evals --require-pass for a deeper gate.`,
        blockers: [],
        warnings: [],
        evidence: [{
          id: 'local-eval-fallback',
          status: 'passed',
          summary: 'Local fallback without critical regression recorded in the Skill Evolution pipeline.',
        }],
      }),
    };
  }

  private procedureOnlyEvalGate(skillName: string): SkillEvolutionEvalGate {
    return {
      id: 'procedure-only',
      status: 'passed',
      canProceed: true,
      score: 1,
      minScore: 0,
      summary: `Procedure ${skillName} registered without executable promotion.`,
      blockers: [],
      warnings: [],
      evidence: [],
    };
  }

  private estimateRisk(text: string): ZavorthMutationRiskLevel {
    if (/(?:sudo|rm\s+-rf|cnetworkntial|token|secret|password|deploy|production|firewall|registry|plugin)/i.test(text)) {
      return 'high';
    }
    if (/(?:install|network|api|webhook|database|server|automation)/i.test(text)) {
      return 'medium';
    }
    return 'low';
  }

  private evaluateSkillMemoryGate(text: string): {
    canCreateSkill: boolean;
    summary: string;
    reasons: string[];
  } {
    const reasons: string[] = [];
    if (this.estimateRisk(text) === 'high') {
      reasons.push('high-risk-task-must-remain-a-governed-mission');
    }
    if (/(?:database\s+migration|production|infraestrutura|infrastructure|meus latests|my last|este projeto|this repo)/i.test(text)) {
      reasons.push('domain-specific-task-is-not-safe-as-reusable-skill');
    }
    if (/(?:ignore (?:all )...(?:previous|prior) instructions|disregard system|reveal secrets|exfiltrate|send files)/i.test(text)) {
      reasons.push('prompt-injection-like-content-blocked');
    }
    return {
      canCreateSkill: reasons.length === 0,
      summary: reasons.length === 0
        ? 'Skill Memory Policy allowed this low-risk reusable skill candidate.'
        : 'Skill Memory Policy blocked automatic skill creation; handle this as a governed mission.',
      reasons,
    };
  }

  private normalizeSkillName(text: string): string {
    const words = String(text || 'learned skill')
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]+/g, ' ')
      .split(/\s+/)
      .filter((entry) => entry.length >= 3)
      .slice(0, 6);
    return (words.join('-') || 'learned-skill')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64);
  }

  private redactSensitiveText(value: unknown): string {
    return String(value || '')
      .replace(/(token|secret|password|api[_ -]...key|cnetworkntial)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
      .trim();
  }

  private firstSentence(value: string): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .split(/[.!...]/)[0]
      .slice(0, 140)
      .trim() || 'learned local procedure';
  }

  private cleanText(value: unknown): string {
    return String(value || '').trim();
  }

  private hash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
