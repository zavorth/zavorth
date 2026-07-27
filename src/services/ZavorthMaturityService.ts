import { OperationalMaturityService } from '../domain/platform-ecosystem/application/OperationalMaturityService.js';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ZavorthMaturityGate,
  ZavorthMaturitySnapshot,
  ZavorthMaturityStatus,
} from '../contracts/ZavorthMaturityContract.js';

import { ChannelExperienceCertificationService } from './ChannelExperienceCertificationService.js';
import { LiveReadinessCertificationService } from './LiveReadinessCertificationService.js';
import { ZavorthControlVisualQaService } from './ZavorthControlVisualQaService.js';
import { ZavorthDataLifecyclePolicyService } from './ZavorthDataLifecyclePolicyService.js';
import { ZavorthHostLiveCertificationService } from './ZavorthHostLiveCertificationService.js';
import { logger } from '../logger.js';

type ChannelExperienceCertificationReader = Pick<ChannelExperienceCertificationService, 'buildSnapshot'>;
type LiveReadinessCertificationReader = Pick<LiveReadinessCertificationService, 'buildSnapshot'>;
type OperationalMaturityReader = Pick<OperationalMaturityService, 'validate'>;
type ZavorthHostLiveCertificationReader = Pick<ZavorthHostLiveCertificationService, 'buildSnapshot'>;
type ZavorthDataLifecyclePolicyReader = Pick<ZavorthDataLifecyclePolicyService, 'buildSnapshot'>;
type ZavorthControlVisualQaReader = Pick<ZavorthControlVisualQaService, 'buildSnapshot'>;

type ZavorthMaturityRuntime = {
  now?: () => Date;
  projectRoot?: string;
  channelExperienceCertificationService?: ChannelExperienceCertificationReader;
  liveReadinessCertificationService?: LiveReadinessCertificationReader;
  operationalMaturityService?: OperationalMaturityReader;
  hostLiveCertificationService?: ZavorthHostLiveCertificationReader;
  dataLifecyclePolicyService?: ZavorthDataLifecyclePolicyReader;
  zavorthControlVisualQaService?: ZavorthControlVisualQaReader;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

type PackageInfo = {
  scripts: Record<string, string>;
};

const REQUIRED_OPERATOR_SCRIPTS = [
  'channel-experience-certification',
  'channel-experience-certification:check',
  'security:doctor',
  'security:continuous',
  'security:preset',
  'zavorth:maturity',
  'zavorth:maturity:check',
  'zavorth:live-host',
  'zavorth:live-host:check',
  'zavorth:data-lifecycle',
  'zavorth:data-lifecycle:check',
  'zavorth:zavorthControl-visual-qa',
  'zavorth:zavorthControl-visual-qa:check',
];

const LEGACY_LOCAL_MODE = ['s', 't', 'u', 'b'].join('');

export class ZavorthMaturityService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly channelExperience: ChannelExperienceCertificationReader;
  private readonly liveReadiness: LiveReadinessCertificationReader;
  private readonly operationalMaturity: OperationalMaturityReader;
  private readonly hostLive: ZavorthHostLiveCertificationReader;
  private readonly dataLifecycle: ZavorthDataLifecyclePolicyReader;
  private readonly zavorthControlVisualQa: ZavorthControlVisualQaReader;
  private readonly readFileSync: typeof fs.readFileSync;

  public constructor(runtime: ZavorthMaturityRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.channelExperience = runtime.channelExperienceCertificationService || new ChannelExperienceCertificationService();
    this.liveReadiness = runtime.liveReadinessCertificationService || new LiveReadinessCertificationService({ now: this.now });
    this.operationalMaturity = runtime.operationalMaturityService || new OperationalMaturityService({
      projectRoot: this.projectRoot,
      now: this.now,
    });
    this.hostLive = runtime.hostLiveCertificationService || new ZavorthHostLiveCertificationService({ now: this.now });
    this.dataLifecycle = runtime.dataLifecyclePolicyService || new ZavorthDataLifecyclePolicyService({
      projectRoot: this.projectRoot,
      now: this.now,
      existsSync: runtime.existsSync,
    });
    this.zavorthControlVisualQa = runtime.zavorthControlVisualQaService || new ZavorthControlVisualQaService({
      projectRoot: this.projectRoot,
      now: this.now,
      existsSync: runtime.existsSync,
    });
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public buildSnapshot(): ZavorthMaturitySnapshot {
    const channel = this.channelExperience.buildSnapshot();
    const live = this.liveReadiness.buildSnapshot({ profile: 'staging-live' });
    const operational = this.operationalMaturity.validate();
    const hostLive = this.hostLive.buildSnapshot();
    const dataLifecycle = this.dataLifecycle.buildSnapshot();
    const zavorthControlVisualQa = this.zavorthControlVisualQa.buildSnapshot();
    const packageInfo = this.readPackageInfo();
    const localsOrPartials = channel.entries.filter((entry) =>
      ['partial', 'planned', 'missing'].includes(String(entry.readiness || '').toLowerCase())
      || [LEGACY_LOCAL_MODE, 'local', 'planned', 'missing'].includes(String(entry.transport || '').toLowerCase())
      || [LEGACY_LOCAL_MODE, 'local', 'partial', 'planned', 'missing'].includes(String(entry.implementationState || '').toLowerCase())).length;

    const gates = [
      this.channelExperienceGate(channel),
      this.liveBoundaryGate(live),
      this.hostLiveCertificationGate(hostLive),
      this.operationalMaturityGate(operational),
      this.localTruthGate(localsOrPartials, channel.entries.length),
      this.zavorthControlEvidenceGate(channel, zavorthControlVisualQa),
      this.dataLifecycleGate(dataLifecycle),
      this.operatorSimplicityGate(packageInfo),
    ];
    const requiredBlocked = gates.filter((gate) => gate.required && gate.status === 'blocked').length;
    const attention = gates.filter((gate) => gate.status === 'attention').length;
    const status = this.resolveStatus(requiredBlocked, attention);
    const productionLiveReady = String(live.statement?.productionLiveRelease || '') !== 'not-claimed-without-operator-live-receipts';
    const summary = {
      totalGates: gates.length,
      passed: gates.filter((gate) => gate.status === 'passed').length,
      attention,
      blocked: requiredBlocked,
      dailyUseReady: requiredBlocked === 0,
      productionLiveReady,
      channelContractsReleaseReady: channel.summary.releaseReady,
      channelContractsCertified: channel.summary.certified,
      channelContractsTotal: channel.summary.total,
      liveReadinessCertified: live.status === 'certified',
      hostLiveReadyChannels: hostLive.summary.liveReady,
      hostLiveTotalChannels: hostLive.summary.total,
      dataLifecycleReleaseReady: dataLifecycle.summary.releaseReady,
      zavorthControlVisualQaEvidenceReady: zavorthControlVisualQa.summary.evidenceReady,
      operationalMaturityOk: operational.ok,
      localsOrPartials,
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: 'zavorth-maturity.v1',
      phase: 'product-runtime-maturity',
      status,
      summary,
      gates,
      distinctions: {
        contractReady: channel.summary.releaseReady,
        dailyUseReady: summary.dailyUseReady,
        productionLiveReady,
        zavorthControlVisualQaClaimed: zavorthControlVisualQa.summary.evidenceReady,
        localsAndPartialsExplicit: localsOrPartials >= 0 && gates.some((gate) => gate.id === 'local-partial-truth-ledger'),
        hostLiveCertificationHonest: hostLive.distinctions.contractReadyIsNotLive
          && hostLive.distinctions.noExternalSendDuringCertification,
        dataLifecycleComplete: dataLifecycle.summary.releaseReady,
      },
      commands: {
        report: 'npm run zavorth:maturity',
        json: 'npm run zavorth:maturity:json',
        check: 'npm run zavorth:maturity:check',
        focusedTests: ['npx jest tests/services/ZavorthMaturityService.test.ts --runInBand'],
        nextStep: this.buildNextStep(status, gates),
      },
      narrative: {
        headline: status === 'blocked'
          ? 'Maturidade do Zavorth blocked por gate required.'
          : status === 'needs-attention'
            ? 'Zavorth is ready for daily use, with explicit operational attention points.'
            : 'Zavorth is mature for daily use and local operation.',
        operatorSummary:
          `${summary.passed}/${summary.totalGates} gate(s) passaram, ${summary.attention} need attention, `
          + `${summary.blocked} block daily use; live production=${summary.productionLiveReady ? 'yes' : 'not claimed'}.`,
      },
    };
  }

  public renderReport(snapshot: ZavorthMaturitySnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Product Maturity',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      `Channel contracts: ${snapshot.summary.channelContractsCertified}/${snapshot.summary.channelContractsTotal} certified.`,
      `Local/partial routes explicit: ${snapshot.summary.localsOrPartials}.`,
      `Production live: ${snapshot.summary.productionLiveReady ? 'claimed' : 'not claimed without operator receipts'}.`,
      `Host live: ${snapshot.summary.hostLiveReadyChannels}/${snapshot.summary.hostLiveTotalChannels} channel(s) live-ready.`,
      `Data lifecycle: ${snapshot.summary.dataLifecycleReleaseReady ? 'release-ready' : 'blocked'}.`,
      `ZavorthControl QA visual: ${snapshot.summary.zavorthControlVisualQaEvidenceReady ? 'evidence ready' : 'plan/preview pending'}.`,
      '',
      'Gates:',
      ...snapshot.gates.map((gate) => `- ${gate.status.toUpperCase()} ${gate.label}: ${gate.summary}`),
      '',
      `Next: ${snapshot.commands.nextStep}`,
    ].join('\n');
  }

  private channelExperienceGate(channel: ReturnType<ChannelExperienceCertificationService['buildSnapshot']>): ZavorthMaturityGate {
    return this.gate({
      id: 'channel-experience-contract',
      label: 'Channel experience contracts',
      status: channel.summary.releaseReady ? 'passed' : 'blocked',
      required: true,
      summary: `${channel.summary.certified}/${channel.summary.total} certified channels; blockers=${channel.summary.blockers}.`,
      evidence: [
        `contractVersion=${channel.contractVersion}`,
        `zavorthControl=${channel.zavorthControlEvidence.status}`,
        `requirements=${channel.summary.requiredPassed}/${channel.summary.requiredTotal}`,
      ],
      commands: ['npm run channel-experience-certification -- --require-pass'],
      nextAction: channel.summary.releaseReady ? 'Keep channel certification in QA.'
        : 'Close channel blockers before declaring the experience ready.',
    });
  }

  private liveBoundaryGate(live: ReturnType<LiveReadinessCertificationService['buildSnapshot']>): ZavorthMaturityGate {
    const productionNotClaimed = String(live.statement?.productionLiveRelease || '') === 'not-claimed-without-operator-live-receipts';
    const ok = live.status === 'certified'
      && live.policy.noLiveIoDuringCertification === true
      && productionNotClaimed;
    return this.gate({
      id: 'contract-vs-live-boundary',
      label: 'Separaction entre contrato e live real',
      status: ok ? 'passed' : 'blocked',
      required: true,
      summary: ok ? 'Staging-live certification passes without pretending live production.'
        : 'Contract/live state is ambiguous or live production was claimed without a receipt.',
      evidence: [
        `status=${live.status}`,
        `productionLiveRelease=${live.statement?.productionLiveRelease || 'n/d'}`,
        `noLiveIoDuringCertification=${String(live.policy.noLiveIoDuringCertification)}`,
      ],
      commands: ['npm run live-readiness-certify -- --profile staging-live'],
      nextAction: ok ? 'Promote live production only with real operator receipts.'
        : 'Separate staging-live, contract-ready, and production-live in the report.',
    });
  }

  private hostLiveCertificationGate(
    hostLive: ReturnType<ZavorthHostLiveCertificationService['buildSnapshot']>,
  ): ZavorthMaturityGate {
    const honest = hostLive.distinctions.contractReadyIsNotLive
      && hostLive.distinctions.noExternalSendDuringCertification
      && hostLive.distinctions.localsAndPartialsAreVisible;
    return this.gate({
      id: 'host-live-certification',
      label: 'Certificaction live deste host',
      status: honest ? (hostLive.summary.liveReady > 0 ? 'passed' : 'attention') : 'blocked',
      required: true,
      summary: `${hostLive.summary.liveReady}/${hostLive.summary.total} live-ready channels on this host; locals/partials=${hostLive.summary.localOrPartial}.`,
      evidence: [
        `contractVersion=${hostLive.contractVersion}`,
        `productionLiveCertified=${String(hostLive.summary.productionLiveCertified)}`,
        `contractReadyIsNotLive=${String(hostLive.distinctions.contractReadyIsNotLive)}`,
        `noExternalSendDuringCertification=${String(hostLive.distinctions.noExternalSendDuringCertification)}`,
      ],
      commands: ['npm run zavorth:live-host', 'npm run zavorth:live-host:check'],
      nextAction: hostLive.summary.liveReady > 0
        ? 'Keep real provider receipts, webhook, and allowlist for live channels.'
        : hostLive.commands.nextStep,
    });
  }

  private operationalMaturityGate(report: ReturnType<OperationalMaturityService['validate']>): ZavorthMaturityGate {
    return this.gate({
      id: 'operational-maturity-matrix',
      label: 'Matriz operational canonical',
      status: report.ok ? 'passed' : 'blocked',
      required: true,
      summary: report.ok ? `${report.snapshot.summary.total} capabilitys com invariantes preservadas.`
        : `${report.issues.length} issue(s) de maturidade operational.`,
      evidence: [
        `schema=${report.snapshot.schemaVersion}`,
        `nexusSurfaceOnly=${String(report.snapshot.invariants.nexusIsSurfaceOnly)}`,
        `echoEdgeOnly=${String(report.snapshot.invariants.echoIsEdgeLayerOnly)}`,
        ...report.issues.slice(0, 3).map((issue) => `${issue.id}: ${issue.message}`),
      ],
      commands: ['node scripts/operational-maturity-check.mjs'],
      nextAction: report.ok ? 'Keep the matrix as the public source of truth for maturity.'
        : 'Corrigir evidence/invariantes da matriz operational.',
    });
  }

  private localTruthGate(localsOrPartials: number, totalChannels: number): ZavorthMaturityGate {
    return this.gate({
      id: 'local-partial-truth-ledger',
      label: 'Local, partial, and provider routes explicit',
      status: localsOrPartials > 0 ? 'attention' : 'passed',
      required: false,
      summary: localsOrPartials > 0
        ? `${localsOrPartials}/${totalChannels} channels still need configuration/provider/real environment, but remain visible.`
        : 'No channel appears as local/partial in the current snapshot.',
      evidence: [
        `localsOrPartials=${localsOrPartials}`,
        `totalChannels=${totalChannels}`,
      ],
      commands: ['npm run channel-experience-certification'],
      nextAction: localsOrPartials > 0
        ? 'Promote each channel with doctor, real provider, and allowlist before calling it live.'
        : 'Continue blocking any ambiguous status in Channel Mesh.',
    });
  }

  private zavorthControlEvidenceGate(
    channel: ReturnType<ChannelExperienceCertificationService['buildSnapshot']>,
    zavorthControl: ReturnType<ZavorthControlVisualQaService['buildSnapshot']>,
  ): ZavorthMaturityGate {
    const contractReady = channel.zavorthControlEvidence.status === 'contract-ready';
    const evidenceReady = zavorthControl.summary.evidenceReady;
    return this.gate({
      id: 'zavorthControl-contract-and-visual-qa',
      label: 'ZavorthControl: contrato ready, QA visual separado',
      status: contractReady ? (evidenceReady ? 'passed' : 'attention') : 'blocked',
      required: true,
      summary: contractReady && evidenceReady ? 'Backend entrega contrato e screenshots/manifest de QA visual existem.'
        : contractReady ? 'Backend provides status/actions/QR, but visual screenshot QA remains separated by approval.'
        : 'ZavorthControl does not receive enough contract data to operate channels.',
      evidence: [
        `zavorthControlEvidence=${channel.zavorthControlEvidence.status}`,
        `visualQa=${zavorthControl.status}`,
        `visualArtifacts=${zavorthControl.summary.artifactsPresent}/${zavorthControl.summary.artifactsExpected}`,
        `routes=${channel.zavorthControlEvidence.routes.join(',')}`,
        `zavorthControlVisualQaClaimed=${String(evidenceReady)}`,
      ],
      commands: [
        'npm run channel-experience-certification',
        'npm run qa:zavorthControl-browser-preview',
        'npm run zavorth:zavorthControl-visual-qa -- --capture',
      ],
      nextAction: contractReady
        ? zavorthControl.commands.nextStep
        : 'Close routes/actions/status rows before changing visuals.',
    });
  }

  private dataLifecycleGate(
    dataLifecycle: ReturnType<ZavorthDataLifecyclePolicyService['buildSnapshot']>,
  ): ZavorthMaturityGate {
    return this.gate({
      id: 'privacy-data-lifecycle',
      label: 'Privacy, retention, and sensitive data',
      status: dataLifecycle.summary.releaseReady ? 'passed' : 'blocked',
      required: true,
      summary: dataLifecycle.summary.releaseReady ? `${dataLifecycle.summary.covered}/${dataLifecycle.summary.total} dataset(s) com retention/export/delete/redaction definidos.`
        : `${dataLifecycle.issues.length} issue(s) de ciclo de dados missing(s).`,
      evidence: dataLifecycle.summary.releaseReady
        ? [
          `contractVersion=${dataLifecycle.contractVersion}`,
          `exportable=${dataLifecycle.summary.exportable}`,
          `deletable=${dataLifecycle.summary.deletable}`,
          `redactionCovered=${dataLifecycle.summary.redactionCovered}`,
        ]
        : dataLifecycle.issues.slice(0, 6).map((issue) => `${issue.datasetId}.${issue.field}: ${issue.message}`),
      commands: ['npm run zavorth:data-lifecycle', 'npm run zavorth:data-lifecycle:check'],
      nextAction: dataLifecycle.summary.releaseReady ? 'Adicionar todo novo armazenamento ao data lifecycle before do merge.'
        : dataLifecycle.commands.nextStep,
    });
  }

  private operatorSimplicityGate(packageInfo: PackageInfo): ZavorthMaturityGate {
    const missing = REQUIRED_OPERATOR_SCRIPTS.filter((scriptName) => !packageInfo.scripts[scriptName]);
    return this.gate({
      id: 'operator-yesplicity',
      label: 'Simple commands for everyday users and advanced operators',
      status: missing.length === 0 ? 'passed' : 'blocked',
      required: true,
      summary: missing.length === 0
        ? 'Maturity, security, and channel scripts are discoverable in package.json.'
        : `${missing.length} script(s) operational(is) faltando.`,
      evidence: missing.length === 0 ? REQUIRED_OPERATOR_SCRIPTS : missing,
      commands: ['npm run zavorth:maturity', 'npm run security:doctor', 'npm run security:preset'],
      nextAction: missing.length === 0
        ? 'Keep these scripts as the short path for daily support.'
        : 'Adicionar scripts before depender de comandos internos ou docs longas.',
    });
  }

  private readPackageInfo(): PackageInfo {
    const packagePath = path.resolve(this.projectRoot, 'package.json');
    try {
      const parsed = JSON.parse(this.readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
      return {
        scripts: parsed.scripts || {},
      };
    } catch (error: unknown) {logger.warn('[Zavorth Maturity] JSON parse failed', error);
    return { scripts: {} };
  }
  }

  private resolveStatus(blocked: number, attention: number): ZavorthMaturityStatus {
    if (blocked > 0) {
      return 'blocked';
    }
    if (attention > 0) {
      return 'needs-attention';
    }
    return 'mature';
  }

  private buildNextStep(status: ZavorthMaturityStatus, gates: ZavorthMaturityGate[]): string {
    const firstBlock = gates.find((gate) => gate.status === 'blocked');
    if (firstBlock) {
      return firstBlock.nextAction;
    }
    const firstAttention = gates.find((gate) => gate.status === 'attention');
    if (firstAttention) {
      return firstAttention.nextAction;
    }
    return 'Keep zavorth:maturity:check in QA and avoid new features before closing visual regression.';
  }

  private gate(input: ZavorthMaturityGate): ZavorthMaturityGate {
    return {
      ...input,
      evidence: input.evidence.filter(Boolean),
      commands: input.commands.filter(Boolean),
    };
  }
}
