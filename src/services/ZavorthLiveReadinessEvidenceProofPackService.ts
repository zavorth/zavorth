import type {
  ChannelMeshSnapshot,
} from '../contracts/ChannelMeshContract.js';
import type { ProviderChannelSmokeProofSnapshot } from '../contracts/ProviderChannelSmokeProofContract.js';
import {
  ZAVORTH_LIVE_READINESS_EVIDENCE_PROOF_PACK_CONTRACT_VERSION,
  type ZavorthLiveReadinessEvidenceEntry,
  type ZavorthLiveReadinessOperationalClosure,
  type ZavorthLiveReadinessEvidenceProofPackSnapshot,
  type ZavorthLiveReadinessEvidenceStatus,
} from '../contracts/ZavorthLiveReadinessEvidenceProofPackContract.js';
import type { ZavorthTerminalBackendSnapshot } from '../contracts/ZavorthTerminalBackendsContract.js';
import type { ZavorthProviderReadinessMatrixSnapshot } from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import type { CanonicalPublicApiRuntime } from '../api/public/canonical-public-api/types.js';
import { ProviderChannelSmokeProofService } from './ProviderChannelSmokeProofService.js';
import { ZavorthTerminalBackendsService } from './ZavorthTerminalBackendsService.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';

type Runtime = {
  now?: () => Date;
  providerMatrix?: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  channelMesh?: Pick<CanonicalPublicApiService, 'readChannels'>;
  smokeProof?: Pick<ProviderChannelSmokeProofService, 'buildSnapshot'>;
  terminalBackends?: Pick<ZavorthTerminalBackendsService, 'execute'>;
};

export class ZavorthLiveReadinessEvidenceProofPackService {
  private readonly now: () => Date;
  private readonly providerMatrix: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  private readonly channelMesh: Pick<CanonicalPublicApiService, 'readChannels'>;
  private readonly smokeProof: Pick<ProviderChannelSmokeProofService, 'buildSnapshot'>;
  private readonly terminalBackends: Pick<ZavorthTerminalBackendsService, 'execute'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerMatrix = runtime.providerMatrix || new ZavorthProviderReadinessMatrixService({
      now: this.now,
    });
    this.channelMesh = runtime.channelMesh || new CanonicalPublicApiService(createDefaultPublicRuntime());
    this.smokeProof = runtime.smokeProof || new ProviderChannelSmokeProofService({
      now: this.now,
    });
    this.terminalBackends = runtime.terminalBackends || new ZavorthTerminalBackendsService({
      now: this.now,
    });
  }

  public async buildSnapshot(input: {
    providerId?: string | null;
    includeAdvanced?: boolean;
  } = {}): Promise<ZavorthLiveReadinessEvidenceProofPackSnapshot> {
    const generatedAt = this.now().toISOString();
    const [providerMatrix, smokeProof] = await Promise.all([
      this.providerMatrix.buildLiveSnapshot({
        includeAdvanced: input.includeAdvanced !== false,
        providerId: input.providerId || null,
        probe: true,
        live: false,
      }),
      Promise.resolve(this.smokeProof.buildSnapshot()),
    ]);
    const channelMesh = this.channelMesh.readChannels();
    const terminalBackends = this.terminalBackends.execute({
      action: 'terminal.status',
    });
    const entries = buildEntries({
      providerMatrix,
      channelMesh,
      smokeProof,
      terminalBackends,
    });
    const operationalClosure = buildOperationalClosure({
      providerMatrix,
      channelMesh,
      terminalBackends,
      entries,
    });
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const catalogReadyButNotLive = providerMatrix.summary.catalogReadyButNotLive
      + channelMesh.summary.catalogReadyButNotLive;

    return {
      generatedAt,
      contractVersion: ZAVORTH_LIVE_READINESS_EVIDENCE_PROOF_PACK_CONTRACT_VERSION,
      source: 'ZavorthLiveReadinessEvidenceProofPackService',
      status,
      mode: 'safe-proof-pack',
      providerMatrix,
      channelMesh,
      smokeProof,
      terminalBackends,
      entries,
      operationalClosure,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        providerTotal: providerMatrix.summary.total,
        providerLiveReady: providerMatrix.summary.liveReady,
        providerDefaultRouteAllowed: providerMatrix.summary.defaultRouteAllowed,
        channelTotal: channelMesh.summary.total,
        channelLiveReady: channelMesh.summary.liveReady,
        channelDefaultRouteAllowed: channelMesh.summary.defaultRouteAllowed,
        catalogReadyButNotLive,
        smokeProofReceipts: smokeProof.summary.receipts,
        backendTotal: terminalBackends.backends.length,
        backendLiveReady: terminalBackends.backends.filter((backend) => backend.liveReady).length,
        strongBackendLiveReady: terminalBackends.backends.filter(hasStrongBackendProof).length,
        liveProofRequired: operationalClosure.liveProofSatisfied === false,
        rawSecretsSerialized: false,
        providerNetworkUsed: false,
        liveChannelSendPerformed: false,
      },
      policy: {
        catalogSupportIsNotLiveProof: true,
        defaultRoutingRequiresLiveProof: true,
        liveProviderProbeRequiresExplicitOperatorAction: true,
        liveChannelActionRequiresPolicyBroker: true,
        smokeProofDoesNotUseExternalIo: true,
        dashboardCanExecute: false,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:live-readiness-evidence-proof-pack',
        inspectJson: 'npm run zavorth:live-readiness-evidence-proof-pack:json',
        check: 'npm run zavorth:live-readiness-evidence-proof-pack:check --silent',
        providerMatrix: 'npm run zavorth:provider-live-matrix --silent',
        channelMesh: 'npm run channels:mesh --silent',
        smokeProof: 'npm run provider-channel-smoke-proof:check --silent',
        terminalBackends: 'npm run zavorth:terminal-backends:check --silent',
        requireLive: 'npm run zavorth:live-readiness-evidence-proof-pack:json -- --require-live',
        nextStage: 'Intent model0 - Final Daily Runtime Closure and Release Gate',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthLiveReadinessEvidenceProofPackSnapshot): string {
    const lines = [
      'Zavorth Live Readiness Evidence + Channel Provider Proof Pack - Certification matrix',
      '',
      `Status: ${snapshot.status}`,
      `Providers: live=${snapshot.summary.providerLiveReady}/${snapshot.summary.providerTotal}, default=${snapshot.summary.providerDefaultRouteAllowed}`,
      `Channels: live=${snapshot.summary.channelLiveReady}/${snapshot.summary.channelTotal}, default=${snapshot.summary.channelDefaultRouteAllowed}`,
      `Backends: live=${snapshot.summary.backendLiveReady}/${snapshot.summary.backendTotal}, strong=${snapshot.summary.strongBackendLiveReady}`,
      `Catalog ready but not live: ${snapshot.summary.catalogReadyButNotLive}`,
      `Smoke receipts: ${snapshot.summary.smokeProofReceipts}`,
      `Operational closure: ${snapshot.operationalClosure.status}`,
      snapshot.operationalClosure.verdict,
      '',
      'Evidence matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status} | live=${entry.liveReady}/${entry.total} | default=${entry.defaultRouteAllowed}`);
      for (const evidence of entry.evidence.slice(0, 3)) lines.push(`  ${evidence}`);
      if (entry.operatorAction) lines.push(`  next: ${entry.operatorAction}`);
    }
    lines.push('', 'Operational requirements:');
    for (const item of snapshot.operationalClosure.requirements) {
      lines.push(`- ${item.label}: ${item.status} | ${item.observed} | target=${item.target}`);
      lines.push(`  command: ${item.command}`);
    }
    lines.push('', 'Catalog support is never treated as live proof. Provider network probes and channel sends remain explicit operator actions.');
    if (snapshot.operationalClosure.nextCommands.length > 0) {
      lines.push('', 'Next live proof commands:');
      for (const command of snapshot.operationalClosure.nextCommands) lines.push(`- ${command}`);
    }
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }
}

function buildEntries(input: {
  providerMatrix: ZavorthProviderReadinessMatrixSnapshot;
  channelMesh: ChannelMeshSnapshot;
  smokeProof: ProviderChannelSmokeProofSnapshot;
  terminalBackends: ZavorthTerminalBackendSnapshot;
}): ZavorthLiveReadinessEvidenceEntry[] {
  return [
    entry({
      id: 'providers.live-readiness',
      label: 'Provider live readiness evidence',
      kind: 'provider',
      passed: input.providerMatrix.liveCompletion.catalogSupportIsNotLiveProof === true
        && input.providerMatrix.liveCompletion.providerSelectionRequiresLiveProof === true
        && input.providerMatrix.entries.every((item) =>
          item.defaultRouteAllowed === (item.status === 'ready' && item.liveReady)),
      total: input.providerMatrix.summary.total,
      liveReady: input.providerMatrix.summary.liveReady,
      defaultRouteAllowed: input.providerMatrix.summary.defaultRouteAllowed,
      catalogReadyButNotLive: input.providerMatrix.summary.catalogReadyButNotLive,
      blocked: input.providerMatrix.summary.blocked,
      evidence: [
        `liveReady=${input.providerMatrix.summary.liveReady}`,
        `catalogReadyButNotLive=${input.providerMatrix.summary.catalogReadyButNotLive}`,
        `defaultRouteAllowed=${input.providerMatrix.summary.defaultRouteAllowed}`,
      ],
      operatorAction: input.providerMatrix.nextAction,
    }),
    entry({
      id: 'channels.live-readiness',
      label: 'Channel live readiness evidence',
      kind: 'channel',
      passed: input.channelMesh.liveCompletion.catalogSupportIsNotLiveProof === true
        && input.channelMesh.liveCompletion.channelSelectionRequiresLiveProof === true
        && input.channelMesh.entries.every((item) =>
          item.defaultRouteAllowed === (item.readiness === 'ready' && item.liveReady)),
      total: input.channelMesh.summary.total,
      liveReady: input.channelMesh.summary.liveReady,
      defaultRouteAllowed: input.channelMesh.summary.defaultRouteAllowed,
      catalogReadyButNotLive: input.channelMesh.summary.catalogReadyButNotLive,
      blocked: input.channelMesh.summary.disabled,
      evidence: [
        `liveReady=${input.channelMesh.summary.liveReady}`,
        `catalogReadyButNotLive=${input.channelMesh.summary.catalogReadyButNotLive}`,
        `defaultRouteAllowed=${input.channelMesh.summary.defaultRouteAllowed}`,
      ],
      operatorAction: input.channelMesh.narrative.operatorSummary,
    }),
    entry({
      id: 'provider-channel.smoke-proof',
      label: 'Provider/channel smoke proof has receipts without live IO',
      kind: 'smoke-proof',
      passed: input.smokeProof.policy.noProviderNetworkCalls === true
        && input.smokeProof.policy.noLiveChannelSends === true
        && input.smokeProof.policy.noSecretsSerialized === true
        && input.smokeProof.summary.liveExternalCallRequired === false
        && input.smokeProof.summary.liveChannelSendRequired === false
        && input.smokeProof.summary.secretValuesSerialized === false,
      total: input.smokeProof.summary.providers + input.smokeProof.summary.channels,
      liveReady: input.smokeProof.summary.providerSmokeProofs + input.smokeProof.summary.channelSmokeProofs,
      defaultRouteAllowed: 0,
      catalogReadyButNotLive: 0,
      blocked: input.smokeProof.summary.providerBlocked + input.smokeProof.summary.channelBlocked,
      evidence: [
        `receipts=${input.smokeProof.summary.receipts}`,
        `providerBlocked=${input.smokeProof.summary.providerBlocked}`,
        `channelBlocked=${input.smokeProof.summary.channelBlocked}`,
      ],
      operatorAction: null,
    }),
    entry({
      id: 'default-route.policy',
      label: 'Default route policy requires live proof',
      kind: 'policy',
      passed: input.providerMatrix.liveCompletion.defaultRoutingPolicy === 'ready-and-live-proof'
        && input.channelMesh.liveCompletion.defaultRoutingPolicy === 'ready-and-live-proof',
      total: 2,
      liveReady: 2,
      defaultRouteAllowed: input.providerMatrix.summary.defaultRouteAllowed + input.channelMesh.summary.defaultRouteAllowed,
      catalogReadyButNotLive: input.providerMatrix.summary.catalogReadyButNotLive + input.channelMesh.summary.catalogReadyButNotLive,
      blocked: 0,
      evidence: [
        `providerPolicy=${input.providerMatrix.liveCompletion.defaultRoutingPolicy}`,
        `channelPolicy=${input.channelMesh.liveCompletion.defaultRoutingPolicy}`,
        'dashboardCanExecute=false',
      ],
      operatorAction: 'Run explicit provider tests or channel doctors before making any route default.',
    }),
    entry({
      id: 'terminal-backends.strong-live-readiness',
      label: 'Execution backend strong readiness evidence',
      kind: 'policy',
      passed: input.terminalBackends.safety.noBackendLiveByDefault === true
        && input.terminalBackends.safety.cloudBackendsRequireExplicitConfiguration === true
        && input.terminalBackends.backends.some(hasStrongBackendProof),
      total: input.terminalBackends.backends.length,
      liveReady: input.terminalBackends.backends.filter((backend) => backend.liveReady).length,
      defaultRouteAllowed: 0,
      catalogReadyButNotLive: input.terminalBackends.backends.filter((backend) => backend.liveCapable && !backend.liveReady).length,
      blocked: 0,
      evidence: [
        `liveReady=${input.terminalBackends.backends.filter((backend) => backend.liveReady).length}`,
        `strongLiveReady=${input.terminalBackends.backends.filter(hasStrongBackendProof).length}`,
        `noBackendLiveByDefault=${input.terminalBackends.safety.noBackendLiveByDefault}`,
      ],
      operatorAction: 'Run backend doctors/smokes for Docker, WSL or cloud sandboxes before claiming strong execution readiness.',
    }),
  ];
}

function buildOperationalClosure(input: {
  providerMatrix: ZavorthProviderReadinessMatrixSnapshot;
  channelMesh: ChannelMeshSnapshot;
  terminalBackends: ZavorthTerminalBackendSnapshot;
  entries: ZavorthLiveReadinessEvidenceEntry[];
}): ZavorthLiveReadinessOperationalClosure {
  const strongLiveBackends = input.terminalBackends.backends.filter(hasStrongBackendProof).length;
  const requirements = [
    {
      id: 'provider.default-route-live-proof',
      label: 'At least one provider has live proof and can be a default route',
      status: input.providerMatrix.summary.defaultRouteAllowed > 0 ? 'passed' : 'attention',
      observed: `providerDefaultRouteAllowed=${input.providerMatrix.summary.defaultRouteAllowed}; providerLiveReady=${input.providerMatrix.summary.liveReady}`,
      target: 'providerDefaultRouteAllowed>=1',
      command: 'zavorth providers live --provider <provider>',
    },
    {
      id: 'channel.default-route-live-proof',
      label: 'At least one external channel has live proof and can be a default route',
      status: input.channelMesh.summary.defaultRouteAllowed > 0 ? 'passed' : 'attention',
      observed: `channelDefaultRouteAllowed=${input.channelMesh.summary.defaultRouteAllowed}; channelLiveReady=${input.channelMesh.summary.liveReady}`,
      target: 'channelDefaultRouteAllowed>=1',
      command: 'npm run zavorth:channel-live-canary:check --silent',
    },
    {
      id: 'execution.strong-backend-live-proof',
      label: 'At least one non-host execution backend is live-ready',
      status: strongLiveBackends > 0 ? 'passed' : 'attention',
      observed: `strongBackendLiveReady=${strongLiveBackends}; backendLiveReady=${input.terminalBackends.backends.filter((backend) => backend.liveReady).length}`,
      target: 'strongBackendLiveReady>=1',
      command: 'npm run zavorth:terminal-backends:check --silent',
    },
    {
      id: 'safe-proof-pack.no-secret-or-io-leak',
      label: 'Safe proof pack does not serialize secrets or perform hidden live IO',
      status: input.entries.every((entry) => entry.status !== 'blocked') ? 'passed' : 'blocked',
      observed: `blockedEntries=${input.entries.filter((entry) => entry.status === 'blocked').length}`,
      target: 'blockedEntries=0',
      command: 'npm run zavorth:live-readiness-evidence-proof-pack:check --silent',
    },
  ] as const;
  const blocked = requirements.some((requirement) => requirement.status === 'blocked');
  const liveProofSatisfied = requirements.every((requirement) => requirement.status === 'passed');
  const status = blocked ? 'blocked' : liveProofSatisfied ? 'live-proved' : 'live-proof-required';
  const nextCommands = requirements
    .filter((requirement) => requirement.status !== 'passed')
    .map((requirement) => requirement.command);
  return {
    status,
    codeReady: blocked === false,
    liveProofSatisfied,
    canClaimOperationalClosure: liveProofSatisfied,
    verdict: liveProofSatisfied
      ? 'Zavorth has enough live proof to claim operational closure for providers, channels and execution backends.'
      : 'Zavorth is code-ready and safe, but cannot honestly claim full operational readiness until the listed live proofs pass on this machine.',
    requirements: requirements.map((requirement) => ({ ...requirement })),
    nextCommands: Array.from(new Set(nextCommands)),
  };
}

function hasStrongBackendProof(backend: ZavorthTerminalBackendSnapshot['backends'][number]): boolean {
  return backend.id !== 'local'
    && backend.liveReady === true
    && backend.readinessProof?.kind === 'host-probe'
    && backend.readinessProof.rawSecretSerialized === false;
}

function entry(input: {
  id: string;
  label: string;
  kind: ZavorthLiveReadinessEvidenceEntry['kind'];
  passed: boolean;
  total: number;
  liveReady: number;
  defaultRouteAllowed: number;
  catalogReadyButNotLive: number;
  blocked: number;
  evidence: string[];
  operatorAction: string | null;
}): ZavorthLiveReadinessEvidenceEntry {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    status: input.passed ? 'passed' : input.blocked > 0 ? 'blocked' : 'attention',
    total: input.total,
    liveReady: input.liveReady,
    defaultRouteAllowed: input.defaultRouteAllowed,
    catalogReadyButNotLive: input.catalogReadyButNotLive,
    blocked: input.blocked,
    evidence: input.evidence,
    operatorAction: input.operatorAction,
  };
}

function resolveStatus(entries: ZavorthLiveReadinessEvidenceEntry[]): ZavorthLiveReadinessEvidenceStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}

function createDefaultPublicRuntime(): CanonicalPublicApiRuntime {
  const operationsSnapshot = {
    maintenance: {
      startedAt: null,
      finishedAt: null,
    },
    errors: {
      lastError: null,
    },
  };
  return {
    getRuntime: () => ({} as any),
    getGateway: () => null,
    getSessionPlane: () => null,
    getNodeMesh: () => null,
    getPlatformRegistry: () => null,
    getRemoteTransports: () => null,
    getOperationsHealth: () => ({
      readSnapshotFast: () => operationsSnapshot as any,
      readSnapshotLive: () => operationsSnapshot as any,
    }),
    getLearningPlane: () => null,
    getLayeredMemory: () => null,
  };
}
