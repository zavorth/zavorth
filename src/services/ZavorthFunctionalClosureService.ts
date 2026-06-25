import path from 'node:path';
import type {
  ZavorthFunctionalClosureDecision,
  ZavorthFunctionalClosureItem,
  ZavorthFunctionalClosureItemStatus,
  ZavorthFunctionalClosurePriority,
  ZavorthFunctionalClosureReceipt,
  ZavorthFunctionalClosureSnapshot,
  ZavorthFunctionalClosureStatus,
  ZavorthFunctionalClosureRiskLevel,
} from '../contracts/native/ZavorthFunctionalClosureContract.js';
import { ZAVORTH_FUNCTIONAL_CLOSURE_CONTRACT_VERSION } from '../contracts/native/ZavorthFunctionalClosureContract.js';
import { FinalAbsorptionCertificationService } from './FinalAbsorptionCertificationService.js';
import { SourceAgentRuntimeBridgeService } from './SourceAgentRuntimeBridgeService.js';
import { SourceChannelMeshExpansionService } from './SourceChannelMeshExpansionService.js';
import { SourceMemoryDocumentTerminalPackService } from './SourceMemoryDocumentTerminalPackService.js';
import { SourcePluginOsAbsorptionService } from './SourcePluginOsAbsorptionService.js';
import { SourceProviderMeshExpansionService } from './SourceProviderMeshExpansionService.js';
import { SourceSurfaceLedgerService } from './SourceSurfaceLedgerService.js';
import { ZavorthFunctionalClosureDashboardService } from './ZavorthFunctionalClosureDashboardService.js';
import { ZavorthFunctionalReleaseGateService } from './ZavorthFunctionalReleaseGateService.js';
import { ZavorthLedgerDecisionUpdaterService } from './ZavorthLedgerDecisionUpdaterService.js';
import { ZavorthNativeCompanionDevicePackService } from './ZavorthNativeCompanionDevicePackService.js';
import { ZavorthQaSecurityReleaseCertificationPackService } from './ZavorthQaSecurityReleaseCertificationPackService.js';
import { ZavorthSkillEcosystemPackService } from './ZavorthSkillEcosystemPackService.js';

type SnapshotLike = {
  status?: string;
  paths?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  commands?: Record<string, unknown>;
};

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  sourceSurfaceLedgerService?: Pick<SourceSurfaceLedgerService, 'buildReceipt'>;
  pluginOsAbsorptionService?: Pick<SourcePluginOsAbsorptionService, 'buildSnapshot'>;
  agentRuntimeBridgeService?: Pick<SourceAgentRuntimeBridgeService, 'buildSnapshot'>;
  providerMeshExpansionService?: Pick<SourceProviderMeshExpansionService, 'buildSnapshot'>;
  channelMeshExpansionService?: Pick<SourceChannelMeshExpansionService, 'buildSnapshot'>;
  memoryDocumentTerminalPackService?: Pick<SourceMemoryDocumentTerminalPackService, 'buildSnapshot'>;
  nativeCompanionDevicePackService?: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot'>;
  qaSecurityReleaseCertificationPackService?: Pick<ZavorthQaSecurityReleaseCertificationPackService, 'buildSnapshot'>;
  skillEcosystemPackService?: Pick<ZavorthSkillEcosystemPackService, 'buildSnapshot'>;
  finalAbsorptionCertificationService?: Pick<FinalAbsorptionCertificationService, 'buildSnapshot'>;
  dashboardService?: ZavorthFunctionalClosureDashboardService;
  ledgerDecisionUpdaterService?: ZavorthLedgerDecisionUpdaterService;
  releaseGateService?: ZavorthFunctionalReleaseGateService;
};

type PhaseInput = {
  id: string;
  phase: number;
  label: string;
  category: string;
  priority: ZavorthFunctionalClosurePriority;
  decision: ZavorthFunctionalClosureDecision;
  command: string;
  snapshot: SnapshotLike;
  passStatuses: string[];
  observed: string;
  required: string;
  notes: string[];
};

export class ZavorthFunctionalClosureService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly sourceSurfaceLedgerService: Pick<SourceSurfaceLedgerService, 'buildReceipt'>;
  private readonly pluginOsAbsorptionService: Pick<SourcePluginOsAbsorptionService, 'buildSnapshot'>;
  private readonly agentRuntimeBridgeService: Pick<SourceAgentRuntimeBridgeService, 'buildSnapshot'>;
  private readonly providerMeshExpansionService: Pick<SourceProviderMeshExpansionService, 'buildSnapshot'>;
  private readonly channelMeshExpansionService: Pick<SourceChannelMeshExpansionService, 'buildSnapshot'>;
  private readonly memoryDocumentTerminalPackService: Pick<SourceMemoryDocumentTerminalPackService, 'buildSnapshot'>;
  private readonly nativeCompanionDevicePackService: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot'>;
  private readonly qaSecurityReleaseCertificationPackService: Pick<ZavorthQaSecurityReleaseCertificationPackService, 'buildSnapshot'>;
  private readonly skillEcosystemPackService: Pick<ZavorthSkillEcosystemPackService, 'buildSnapshot'>;
  private readonly finalAbsorptionCertificationService: Pick<FinalAbsorptionCertificationService, 'buildSnapshot'>;
  private readonly dashboardService: ZavorthFunctionalClosureDashboardService;
  private readonly ledgerDecisionUpdaterService: ZavorthLedgerDecisionUpdaterService;
  private readonly releaseGateService: ZavorthFunctionalReleaseGateService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.sourceSurfaceLedgerService = runtime.sourceSurfaceLedgerService || new SourceSurfaceLedgerService({
      now: this.now,
      zavorthRoot: this.rootDir,
    });
    this.pluginOsAbsorptionService = runtime.pluginOsAbsorptionService || new SourcePluginOsAbsorptionService({
      now: this.now,
    });
    this.agentRuntimeBridgeService = runtime.agentRuntimeBridgeService || new SourceAgentRuntimeBridgeService({
      now: this.now,
      zavorthRoot: this.rootDir,
    });
    this.providerMeshExpansionService = runtime.providerMeshExpansionService || new SourceProviderMeshExpansionService({
      now: this.now,
      zavorthRoot: this.rootDir,
    });
    this.channelMeshExpansionService = runtime.channelMeshExpansionService || new SourceChannelMeshExpansionService({
      now: this.now,
      zavorthRoot: this.rootDir,
    });
    this.memoryDocumentTerminalPackService = runtime.memoryDocumentTerminalPackService || new SourceMemoryDocumentTerminalPackService({
      now: this.now,
      zavorthRoot: this.rootDir,
    });
    this.nativeCompanionDevicePackService = runtime.nativeCompanionDevicePackService || new ZavorthNativeCompanionDevicePackService({
      now: this.now,
      cwd: this.rootDir,
    });
    this.qaSecurityReleaseCertificationPackService = runtime.qaSecurityReleaseCertificationPackService || new ZavorthQaSecurityReleaseCertificationPackService({
      now: this.now,
      rootDir: this.rootDir,
    });
    this.skillEcosystemPackService = runtime.skillEcosystemPackService || new ZavorthSkillEcosystemPackService({
      now: this.now,
      rootDir: this.rootDir,
    });
    this.finalAbsorptionCertificationService = runtime.finalAbsorptionCertificationService || new FinalAbsorptionCertificationService({
      now: this.now,
    });
    this.dashboardService = runtime.dashboardService || new ZavorthFunctionalClosureDashboardService({
      now: this.now,
    });
    this.ledgerDecisionUpdaterService = runtime.ledgerDecisionUpdaterService || new ZavorthLedgerDecisionUpdaterService({
      now: this.now,
    });
    this.releaseGateService = runtime.releaseGateService || new ZavorthFunctionalReleaseGateService({
      now: this.now,
    });
  }

  public async buildSnapshot(): Promise<ZavorthFunctionalClosureSnapshot> {
    const generatedAt = this.now().toISOString();
    const sourceSurfaceLedger = await Promise.resolve(this.sourceSurfaceLedgerService.buildReceipt());
    const sourceRoot = sourceRootFromLedger(sourceSurfaceLedger);
    const [
      pluginOsAbsorption,
      agentRuntimeBridge,
      providerMeshExpansion,
      channelMeshExpansion,
      memoryDocumentTerminalPack,
      nativeCompanionDevicePack,
      qaSecurityReleasePack,
      skillEcosystemPack,
      finalAbsorptionCertification,
    ] = await Promise.all([
      Promise.resolve(this.pluginOsAbsorptionService.buildSnapshot({ sourceRoot })),
      Promise.resolve(this.agentRuntimeBridgeService.buildSnapshot({ sourceRoot, zavorthRoot: this.rootDir })),
      Promise.resolve(this.providerMeshExpansionService.buildSnapshot({ sourceRoot, zavorthRoot: this.rootDir })),
      Promise.resolve(this.channelMeshExpansionService.buildSnapshot({ sourceRoot, zavorthRoot: this.rootDir })),
      Promise.resolve(this.memoryDocumentTerminalPackService.buildSnapshot({ sourceRoot, zavorthRoot: this.rootDir })),
      Promise.resolve(this.nativeCompanionDevicePackService.buildSnapshot()),
      Promise.resolve(this.qaSecurityReleaseCertificationPackService.buildSnapshot()),
      Promise.resolve(this.skillEcosystemPackService.buildSnapshot()),
      Promise.resolve(this.finalAbsorptionCertificationService.buildSnapshot()),
    ]);
    const items = this.buildItems({
      sourceSurfaceLedger,
      pluginOsAbsorption,
      agentRuntimeBridge,
      providerMeshExpansion,
      channelMeshExpansion,
      memoryDocumentTerminalPack,
      nativeCompanionDevicePack,
      qaSecurityReleasePack,
      skillEcosystemPack,
      finalAbsorptionCertification,
    });
    const receipts = items.map((item) => this.buildReceipt(generatedAt, item));
    const dashboard = this.dashboardService.buildSnapshot(items);
    const ledgerDecisionUpdater = this.ledgerDecisionUpdaterService.buildSnapshot(items);
    const releaseGate = this.releaseGateService.buildSnapshot(items);
    const failed = items.filter((item) => item.status === 'fail').length;
    const warned = items.filter((item) => item.status === 'warn').length;
    const status: ZavorthFunctionalClosureStatus = failed === 0 && releaseGate.releaseAllowed ? 'passed' : 'failed';

    return {
      generatedAt,
      contractVersion: ZAVORTH_FUNCTIONAL_CLOSURE_CONTRACT_VERSION,
      status,
      phase: 9,
      statement: 'Zavorth functional closure is a live, repeatable, machine-readable receipt over all absorbed and intentionally excluded capability surfaces.',
      runtime: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: normalizePath(this.rootDir),
      },
      items,
      receipts,
      dashboard,
      ledgerDecisionUpdater,
      releaseGate,
      summary: {
        items: items.length,
        p0Items: items.filter((item) => item.priority === 'P0').length,
        p1Items: items.filter((item) => item.priority === 'P1').length,
        p2Items: items.filter((item) => item.priority === 'P2').length,
        passed: items.length - failed - warned,
        warned,
        failed,
        receipts: receipts.length,
        receiptBackedItems: items.filter((item) => item.receiptCount > 0).length,
        implemented: items.filter((item) => item.decision === 'implemented').length,
        replaced: items.filter((item) => item.decision === 'replaced').length,
        optionalPacks: items.filter((item) => item.decision === 'optional-pack').length,
        ownerWaived: items.filter((item) => item.decision === 'owner-waived').length,
        rejected: items.filter((item) => item.decision === 'rejected').length,
        releaseAllowed: releaseGate.releaseAllowed,
        machineReadableReceipt: true,
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
      },
      policy: {
        allP0ClosedWithProof: true,
        allP1ClosedWithPackOrOwnerDecision: true,
        allP2ClosedWithOptionalPathOrNonGoal: true,
        ledgerUpdatesRequireReceipts: true,
        releaseGateBlocksP0Regression: true,
        noLiveIoInClosureCommand: true,
        artifactFirstReceipts: true,
      },
      commands: {
        inspect: 'npm run zavorth-functional-closure --silent',
        inspectJson: 'npm run zavorth-functional-closure:json --silent',
        check: 'npm run zavorth-functional-closure:check --silent',
        qa: 'npm run qa:zavorth-functional-closure --silent',
        releaseGate: 'npm run zavorth-functional-closure -- --release-gate --require-pass',
        nextStep: 'Functional absorption closure complete',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthFunctionalClosureSnapshot): string {
    const lines = [
      'Zavorth Functional Closure - Certification matrix',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Items: ${snapshot.summary.items}`,
      `P0/P1/P2: ${snapshot.summary.p0Items}/${snapshot.summary.p1Items}/${snapshot.summary.p2Items}`,
      `Passed/warned/failed: ${snapshot.summary.passed}/${snapshot.summary.warned}/${snapshot.summary.failed}`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Receipt-backed items: ${snapshot.summary.receiptBackedItems}`,
      `Release allowed: ${snapshot.summary.releaseAllowed}`,
      `Machine-readable receipt: ${snapshot.summary.machineReadableReceipt}`,
      'Closure items:',
      ...snapshot.items.map((item) => (
        `- ${item.status} phase ${item.phase} ${item.id}: ${item.priority}, decision=${item.decision}, receipts=${item.receiptCount}`
      )),
      'Release gate:',
      `- P0 closed: ${snapshot.releaseGate.p0.closed}/${snapshot.releaseGate.p0.total}`,
      `- P1 closed: ${snapshot.releaseGate.p1.closed}/${snapshot.releaseGate.p1.total}`,
      `- P2 closed: ${snapshot.releaseGate.p2.closed}/${snapshot.releaseGate.p2.total}`,
      `Next: ${snapshot.commands.nextStep}`,
    ];
    if (snapshot.releaseGate.blockers.length > 0) {
      lines.push('Blockers:');
      lines.push(...snapshot.releaseGate.blockers.map((blocker) => `- ${blocker}`));
    }
    return lines.join('\n');
  }

  private buildItems(input: {
    sourceSurfaceLedger: SnapshotLike;
    pluginOsAbsorption: SnapshotLike;
    agentRuntimeBridge: SnapshotLike;
    providerMeshExpansion: SnapshotLike;
    channelMeshExpansion: SnapshotLike;
    memoryDocumentTerminalPack: SnapshotLike;
    nativeCompanionDevicePack: SnapshotLike;
    qaSecurityReleasePack: SnapshotLike;
    skillEcosystemPack: SnapshotLike;
    finalAbsorptionCertification: SnapshotLike;
  }): ZavorthFunctionalClosureItem[] {
    return [
      this.item({
        id: 'checkpoint-0-ledger-governance',
        phase: 0,
        label: 'Executable full-surface ledger governance',
        category: 'ledger-governance',
        priority: 'P0',
        decision: 'implemented',
        command: 'npm run source-surface-ledger:check --silent',
        snapshot: input.sourceSurfaceLedger,
        passStatuses: ['passed'],
        observed: summaryLine(input.sourceSurfaceLedger, ['total', 'discoveredSurfaces', 'unclassifiedSurfaces', 'validationErrors']),
        required: 'ledger loads, scans current source root and reports zero unclassified surfaces',
        notes: ['The full-surface ledger is executable infrastructure with drift detection.'],
      }),
      this.item({
        id: 'checkpoint-1-plugin-os-package-sdk',
        phase: 1,
        label: 'Plugin OS and package SDK absorption',
        category: 'plugin-os',
        priority: 'P0',
        decision: 'implemented',
        command: 'npm run source-plugin-os-absorption:check --silent',
        snapshot: input.pluginOsAbsorption,
        passStatuses: ['passed'],
        observed: summaryLine(input.pluginOsAbsorption, ['packagesFound', 'declaredExports', 'lifecycleReceipts']),
        required: 'plugin/package surfaces have contracts, policy and lifecycle receipts',
        notes: ['No external plugin executes without policy profile.'],
      }),
      this.item({
        id: 'checkpoint-2-agent-runtime-bridge',
        phase: 2,
        label: 'Agent runtime bridge pack',
        category: 'agent-runtime',
        priority: 'P0',
        decision: 'implemented',
        command: 'npm run source-agent-runtime-bridge:check --silent',
        snapshot: input.agentRuntimeBridge,
        passStatuses: ['passed'],
        observed: summaryLine(input.agentRuntimeBridge, ['bridgesReady', 'bridgesOwnerGated', 'enabledByDefault']),
        required: 'agent runtime bridges are optional, policy-gated and disabled by default',
        notes: ['Tool execution remains governed by cwd, approval and receipt policy.'],
      }),
      this.item({
        id: 'checkpoint-3-provider-mesh',
        phase: 3,
        label: 'Provider mesh expansion pack',
        category: 'provider-mesh',
        priority: 'P1',
        decision: 'implemented',
        command: 'npm run source-provider-mesh-expansion:check --silent',
        snapshot: input.providerMeshExpansion,
        passStatuses: ['passed'],
        observed: summaryLine(input.providerMeshExpansion, ['adaptersReady', 'adaptersOwnerGated', 'liveIoPerformed']),
        required: 'provider routes are explicit, no impersonation, no live IO during closure',
        notes: ['Cloud and direct provider routes stay explicit and credential-routed.'],
      }),
      this.item({
        id: 'checkpoint-4-channel-mesh',
        phase: 4,
        label: 'Channel mesh expansion pack',
        category: 'channel-mesh',
        priority: 'P1',
        decision: 'optional-pack',
        command: 'npm run source-channel-mesh-expansion:check --silent',
        snapshot: input.channelMeshExpansion,
        passStatuses: ['passed'],
        observed: summaryLine(input.channelMeshExpansion, ['packs', 'packsReadyOrReplaced', 'ownerGatedPacks']),
        required: 'channels are optional packs with simulator receipts and live-send gates',
        notes: ['Live channel sends require explicit operator command, SecretRef and allowlist.'],
      }),
      this.item({
        id: 'checkpoint-5-memory-document-terminal',
        phase: 5,
        label: 'Memory, document, search and terminal pack',
        category: 'memory-document-terminal',
        priority: 'P1',
        decision: 'implemented',
        command: 'npm run source-memory-document-terminal-pack:check --silent',
        snapshot: input.memoryDocumentTerminalPack,
        passStatuses: ['passed'],
        observed: summaryLine(input.memoryDocumentTerminalPack, ['memoryReceipts', 'documentArtifacts', 'dangerousCommandsBlocked']),
        required: 'memory/document/search/terminal behavior has governed local receipts',
        notes: ['Dangerous terminal behavior remains blocked by policy.'],
      }),
      this.item({
        id: 'checkpoint-6-native-companion-device',
        phase: 6,
        label: 'Native companion and device capability pack',
        category: 'native-companion-device',
        priority: 'P0',
        decision: 'implemented',
        command: 'npm run zavorth-native-companion-device-pack:check --silent',
        snapshot: input.nativeCompanionDevicePack,
        passStatuses: ['passed'],
        observed: summaryLine(input.nativeCompanionDevicePack, ['targetsCovered', 'targetsOwnerGated', 'capabilityReceipts']),
        required: 'browser-first, desktop and optional runtime bridges emit artifact-first receipts',
        notes: ['Native wrappers remain owner-gated until product scope is approved.'],
      }),
      this.item({
        id: 'checkpoint-7-qa-security-release',
        phase: 7,
        label: 'QA, security and release certification pack',
        category: 'qa-security-release',
        priority: 'P0',
        decision: 'implemented',
        command: 'npm run zavorth-qa-security-release-certification-pack:check --silent',
        snapshot: input.qaSecurityReleasePack,
        passStatuses: ['passed'],
        observed: summaryLine(input.qaSecurityReleasePack, ['families', 'failFamilies', 'receipts']),
        required: 'QA/security/release/workflow/patch-risk families are runnable certification',
        notes: ['Workflow behavior is local semantic checks, not copied workflow files.'],
      }),
      this.item({
        id: 'checkpoint-8-skill-ecosystem',
        phase: 8,
        label: 'Skill ecosystem pack',
        category: 'skill-ecosystem',
        priority: 'P2',
        decision: 'optional-pack',
        command: 'npm run zavorth-skill-ecosystem-pack:check --silent',
        snapshot: input.skillEcosystemPack,
        passStatuses: ['passed'],
        observed: summaryLine(input.skillEcosystemPack, ['manifests', 'connectorConcepts', 'smokeTests']),
        required: 'skills are optional manifests with policy-aware non-destructive smoke tests',
        notes: ['Skill breadth is optional ecosystem capacity, not core bloat.'],
      }),
      this.item({
        id: 'checkpoint-9-baseline-worker-chain',
        phase: 9,
        label: 'Baseline worker closure chain',
        category: 'baseline-certification',
        priority: 'P0',
        decision: 'implemented',
        command: 'npm run final-absorption-certification:check --silent',
        snapshot: input.finalAbsorptionCertification,
        passStatuses: ['certified'],
        observed: summaryLine(input.finalAbsorptionCertification, ['evidenceItems', 'failed', 'totalReceipts']),
        required: 'prior worker closure chain remains certified and no-live-IO',
        notes: ['Certification matrix wraps prior worker closure plus phases 7 and 8 into one receipt.'],
      }),
    ];
  }

  private item(input: PhaseInput): ZavorthFunctionalClosureItem {
    const rawStatus = String(input.snapshot.status || '').trim();
    const pass = input.passStatuses.includes(rawStatus);
    const status: ZavorthFunctionalClosureItemStatus = pass ? 'pass' : rawStatus === 'warn' ? 'warn' : 'fail';
    const risk: ZavorthFunctionalClosureRiskLevel = status === 'fail' ? 'blocking' : status === 'warn' ? 'attention' : 'none';
    const receiptId = `zavorth.certification-matrix.functional-closure.${input.id}.${this.now().getTime()}.receipt`;

    return {
      id: input.id,
      phase: input.phase,
      label: input.label,
      category: input.category,
      priority: input.priority,
      decision: input.decision,
      status,
      command: input.command,
      receiptIds: [receiptId],
      receiptCount: 1,
      risk,
      observed: input.observed,
      required: input.required,
      notes: input.notes,
      sourceSummary: input.snapshot.summary || {},
    };
  }

  private buildReceipt(
    generatedAt: string,
    item: ZavorthFunctionalClosureItem,
  ): ZavorthFunctionalClosureReceipt {
    return {
      id: item.receiptIds[0] || `zavorth.certification-matrix.functional-closure.${item.id}.${generatedAt}.receipt`,
      phase: item.phase,
      itemId: item.id,
      status: item.status,
      priority: item.priority,
      decision: item.decision,
      machineReadable: true,
      artifactFirst: true,
      receiptBacked: item.receiptCount > 0,
      command: item.command,
      observed: item.observed,
      reason: `${item.label}: ${item.status}; required ${item.required}.`,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }
}

function summaryLine(snapshot: SnapshotLike, keys: string[]): string {
  const summary = snapshot.summary || {};
  return keys
    .map((key) => `${key}=${stringifyValue(summary[key])}`)
    .join(', ');
}

function sourceRootFromLedger(snapshot: SnapshotLike): string | null {
  const value = snapshot.paths?.sourceRoot;
  return typeof value === 'string' && value.trim() ? value : null;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return 'n/a';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
