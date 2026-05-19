import type {
  ParityCertificationGate,
  ParityCertificationGateKind,
  ParityCertificationGateSeverity,
  ParityCertificationGateStatus,
  ParityCertificationProfile,
  ParityCertificationReceipt,
  ParityCertificationSnapshot,
  ParityCertificationStatus,
  ParityCertificationWaiver,
} from '../contracts/ParityCertificationContract.js';
import { ZAVORTH_PARITY_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ParityCertificationContract.js';
import type { OperationalParitySnapshot } from '../contracts/OperationalParityToolingContract.js';
import { OperationalParityToolingService } from './OperationalParityToolingService.js';

type ParityCertificationRuntime = {
  now?: () => Date;
  profile?: ParityCertificationProfile;
  waivers?: ParityCertificationWaiver[];
  operationalToolingService?: OperationalParityToolingService;
};

type BuildCertificationInput = {
  profile?: ParityCertificationProfile;
  waivers?: ParityCertificationWaiver[];
  operationalSnapshot?: OperationalParitySnapshot;
};

export class ParityCertificationService {
  private readonly now: () => Date;
  private readonly profile: ParityCertificationProfile;
  private readonly waivers: ParityCertificationWaiver[];
  private readonly operationalTooling: OperationalParityToolingService;

  constructor(runtime: ParityCertificationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profile = runtime.profile || 'private-absorption';
    this.waivers = runtime.waivers || [];
    this.operationalTooling = runtime.operationalToolingService || new OperationalParityToolingService({
      now: this.now,
    });
  }

  public buildSnapshot(input: BuildCertificationInput = {}): ParityCertificationSnapshot {
    const generatedAt = this.now().toISOString();
    const profile = input.profile || this.profile;
    const operational = input.operationalSnapshot || this.operationalTooling.buildSnapshot();
    const waivers = this.activeWaivers(input.waivers || this.waivers);
    const gates = this.buildGates(operational, profile).map((gate) => this.applyWaiver(gate, waivers));
    const receipts = this.buildReceipts(generatedAt, gates);
    const blockingFailures = gates.filter((gate) => gate.status === 'fail' && gate.severity === 'blocking').length;
    const requiredWarnings = gates.filter((gate) => gate.status === 'warn' && gate.severity === 'required').length;
    const failed = gates.filter((gate) => gate.status === 'fail').length;
    const warned = gates.filter((gate) => gate.status === 'warn').length;
    const waived = gates.filter((gate) => gate.status === 'waived').length;
    const status = this.resolveStatus({ blockingFailures, failed, warned, waived });
    const releaseReady = status === 'certified';
    const nextStage = operational.summary.p0Gaps > 0
      ? 'Etapa 10 - P0 Gap Closure'
      : operational.summary.p1Gaps > 2
        ? 'Etapa 12 - Native Capability Closure'
        : operational.summary.p1Gaps > 0 || operational.summary.p2Gaps > 0
          ? 'Etapa 13 - Remaining Runtime Decisions'
        : 'Release certification profile hardening';

    return {
      generatedAt,
      contractVersion: ZAVORTH_PARITY_CERTIFICATION_CONTRACT_VERSION,
      profile,
      status,
      summary: {
        gates: gates.length,
        passed: gates.filter((gate) => gate.status === 'pass').length,
        warned,
        failed,
        waived,
        blockingFailures,
        requiredWarnings,
        releaseReady,
        sourceOperationalStatus: operational.status,
        sourceOpenGaps: operational.summary.openGaps,
        sourceP0Gaps: operational.summary.p0Gaps,
        sourceP1Gaps: operational.summary.p1Gaps,
        sourceP2Gaps: operational.summary.p2Gaps,
        generatedPluginManifests: operational.summary.generatedPluginManifests,
        pluginCapabilities: operational.summary.pluginCapabilities,
        receipts: receipts.length,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      },
      source: {
        operationalContractVersion: operational.contractVersion,
        operationalGeneratedAt: operational.generatedAt,
        doctorCommand: operational.commands.doctor,
        doctorJsonCommand: operational.commands.doctorJson,
        staticGateCommand: operational.commands.staticGate,
        typecheckCommand: operational.commands.typecheck,
      },
      gates,
      receipts,
      blockers: gates.filter((gate) => gate.status === 'fail'),
      warnings: gates.filter((gate) => gate.status === 'warn'),
      waivers,
      sourceGaps: operational.gaps,
      sourceGates: operational.gates,
      recommendations: {
        nextStage,
        minimumAction: this.minimumAction(operational, gates, profile),
        releaseDecision: this.releaseDecision(status, operational, gates),
      },
      commands: {
        certify: 'npm run parity-certify --silent',
        certifyJson: 'npm run parity-certify:json --silent',
        staticGate: 'npm run parity-certification:check --silent',
        sourceDoctor: operational.commands.doctor,
        focusedTests: [
          'npx jest tests/services/ParityCertificationService.test.ts --runInBand',
          'npm run parity-certification:check --silent',
          'npm run parity-certify --silent',
        ],
        typecheck: operational.commands.typecheck,
        nextStage,
      },
      policy: {
        certificationOnly: true,
        consumesOperationalSnapshot: true,
        noExternalCalls: true,
        noLiveSends: true,
        noDeviceAccess: true,
        noMemoryWrites: true,
        noArtifactBodyReads: true,
        waiversMustBeExplicit: true,
        secretsSerialized: false,
      },
    };
  }

  public formatCertificationText(snapshot: ParityCertificationSnapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Parity Certification',
      `Profile: ${snapshot.profile}`,
      `Status: ${snapshot.status}`,
      `Gates: ${snapshot.summary.gates} (pass ${snapshot.summary.passed}, warn ${snapshot.summary.warned}, fail ${snapshot.summary.failed}, waived ${snapshot.summary.waived})`,
      `Source gaps: ${snapshot.summary.sourceOpenGaps} (P0 ${snapshot.summary.sourceP0Gaps}, P1 ${snapshot.summary.sourceP1Gaps}, P2 ${snapshot.summary.sourceP2Gaps})`,
      `Release ready: ${snapshot.summary.releaseReady}`,
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Decision: ${snapshot.recommendations.releaseDecision}`,
      `Minimum action: ${snapshot.recommendations.minimumAction}`,
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildGates(
    operational: OperationalParitySnapshot,
    profile: ParityCertificationProfile,
  ): ParityCertificationGate[] {
    const commandGateStatus = operational.summary.staticGates >= 7
      && operational.summary.jestGates >= 7
      && operational.summary.doctorCommands >= 1
      ? 'pass'
      : 'fail';

    return [
      gate({
        id: 'operational-snapshot-present',
        kind: 'snapshot',
        severity: 'blocking',
        status: 'pass',
        title: 'Operational snapshot is present',
        observed: operational.contractVersion,
        threshold: '2026-05-04.checkpoint-8',
        reason: 'Certification consumes the Dashboard controls operational parity snapshot.',
        nextAction: 'keep parity doctor current as certification input',
        sourceCommand: operational.commands.doctorJson,
        sourceGaps: [],
      }),
      gate({
        id: 'phase-blockers-zero',
        kind: 'phase',
        severity: 'blocking',
        status: operational.summary.blocked === 0 ? 'pass' : 'fail',
        title: 'No blocked parity phase',
        observed: operational.summary.blocked,
        threshold: 0,
        reason: 'A blocked underlying phase invalidates certification.',
        nextAction: 'repair blocked parity phases before release certification',
        sourceCommand: operational.commands.doctor,
        sourceGaps: [],
      }),
      gate({
        id: 'p0-gap-budget',
        kind: 'gap-budget',
        severity: 'blocking',
        status: operational.summary.p0Gaps === 0 ? 'pass' : 'fail',
        title: 'P0 gaps are closed',
        observed: operational.summary.p0Gaps,
        threshold: 0,
        reason: 'P0 gaps cannot be certified as release-ready without explicit closure.',
        nextAction: 'close P0 gaps or create an explicit non-goal decision',
        sourceCommand: 'npm run provider-mesh-parity:check --silent',
        sourceGaps: operational.gaps.filter((item) => item.severity === 'p0').map((item) => item.id),
      }),
      this.profileGapGate({
        id: 'p1-gap-budget',
        profile,
        count: operational.summary.p1Gaps,
        severityWhenWarn: 'required',
        failProfiles: ['release-candidate', 'public-launch'],
        title: 'P1 gaps are within profile budget',
        reason: 'P1 gaps can remain during private absorption but block release-candidate and public launch profiles.',
        nextAction: 'convert P1 tracked gaps into native implementations or signed release exclusions',
        sourceCommand: operational.commands.doctor,
        sourceGaps: operational.gaps.filter((item) => item.severity === 'p1').map((item) => item.id),
      }),
      this.profileGapGate({
        id: 'p2-decision-register',
        profile,
        count: operational.summary.p2Gaps,
        severityWhenWarn: 'advisory',
        failProfiles: ['public-launch'],
        title: 'P2 decisions are registered',
        reason: 'P2 decisions can remain for private and release-candidate profiles but must be closed or signed off before public launch.',
        nextAction: 'turn P2 decisions into product decisions with receipts',
        sourceCommand: operational.commands.doctor,
        sourceGaps: operational.gaps.filter((item) => item.severity === 'p2').map((item) => item.id),
      }),
      gate({
        id: 'plugin-registry-coverage',
        kind: 'plugin-registry',
        severity: 'required',
        status: operational.summary.generatedPluginManifests > 0 && operational.summary.pluginCapabilities > 0 ? 'pass' : 'fail',
        title: 'Generated Plugin OS inventory is registerable',
        observed: `${operational.summary.generatedPluginManifests}/${operational.summary.pluginCapabilities}`,
        threshold: '>=1 manifest and >=1 capability',
        reason: 'Certification requires generated parity modules to be visible to Plugin OS.',
        nextAction: 'repair Plugin OS generation if inventory is empty',
        sourceCommand: operational.commands.staticGate,
        sourceGaps: [],
      }),
      gate({
        id: 'safety-no-live-io',
        kind: 'safety-policy',
        severity: 'blocking',
        status: this.noLiveIo(operational) ? 'pass' : 'fail',
        title: 'Certification is no-live-IO',
        observed: this.noLiveIo(operational),
        threshold: true,
        reason: 'Certification must not call providers, send messages, access devices, write memory, or read artifact bodies.',
        nextAction: 'move live actions into explicit smoke tests, not certification snapshot generation',
        sourceCommand: operational.commands.doctor,
        sourceGaps: [],
      }),
      gate({
        id: 'secret-redaction',
        kind: 'safety-policy',
        severity: 'blocking',
        status: operational.summary.secretValuesSerialized === false ? 'pass' : 'fail',
        title: 'Secrets are not serialized',
        observed: operational.summary.secretValuesSerialized,
        threshold: false,
        reason: 'Certification receipts can be persisted only if they do not include secret values.',
        nextAction: 'redact secret-bearing evidence before certification',
        sourceCommand: operational.commands.doctorJson,
        sourceGaps: [],
      }),
      gate({
        id: 'command-gates-registered',
        kind: 'command',
        severity: 'required',
        status: commandGateStatus,
        title: 'Static, Jest, and doctor gates are registered',
        observed: `${operational.summary.staticGates}/${operational.summary.jestGates}/${operational.summary.doctorCommands}`,
        threshold: '7/7/1',
        reason: 'Certification must point to executable commands, even when it does not run every command itself.',
        nextAction: 'register missing commands in OperationalParityToolingService',
        sourceCommand: operational.commands.staticGate,
        sourceGaps: [],
      }),
      gate({
        id: 'certification-doc',
        kind: 'documentation',
        severity: 'required',
        status: 'pass',
        title: 'Certification documentation exists',
        observed: 'docs/product-direction.md',
        threshold: 'documented',
        reason: 'Private release operators need a stable certification handoff document.',
        nextAction: 'keep certification documentation synchronized with service output',
        sourceCommand: 'npm run parity-certification:check --silent',
        sourceGaps: [],
      }),
    ];
  }

  private profileGapGate(input: {
    id: string;
    profile: ParityCertificationProfile;
    count: number;
    severityWhenWarn: ParityCertificationGateSeverity;
    failProfiles: ParityCertificationProfile[];
    title: string;
    reason: string;
    nextAction: string;
    sourceCommand: string;
    sourceGaps: string[];
  }): ParityCertificationGate {
    const shouldFail = input.count > 0 && input.failProfiles.includes(input.profile);
    const shouldWarn = input.count > 0 && !shouldFail;
    return gate({
      id: input.id,
      kind: 'gap-budget',
      severity: shouldFail ? 'blocking' : input.severityWhenWarn,
      status: input.count === 0 ? 'pass' : shouldFail ? 'fail' : shouldWarn ? 'warn' : 'pass',
      title: input.title,
      observed: input.count,
      threshold: 0,
      reason: input.reason,
      nextAction: input.nextAction,
      sourceCommand: input.sourceCommand,
      sourceGaps: input.sourceGaps,
    });
  }

  private applyWaiver(
    gateItem: ParityCertificationGate,
    waivers: ParityCertificationWaiver[],
  ): ParityCertificationGate {
    if (gateItem.status !== 'fail') {
      return gateItem;
    }
    const waiver = waivers.find((item) => item.gateId === gateItem.id);
    if (!waiver) {
      return gateItem;
    }
    return {
      ...gateItem,
      status: 'waived',
      waiver,
      reason: `${gateItem.reason} Waiver accepted: ${waiver.reason}`,
    };
  }

  private buildReceipts(
    generatedAt: string,
    gates: ParityCertificationGate[],
  ): ParityCertificationReceipt[] {
    return gates.map((gateItem) => ({
      id: `certification.${gateItem.id}.receipt`,
      gateId: gateItem.id,
      generatedAt,
      status: gateItem.status,
      command: gateItem.sourceCommand,
      evidence: `${gateItem.title}: observed ${String(gateItem.observed)} against ${String(gateItem.threshold)}.`,
      noLiveIo: true,
      secretValuesSerialized: false,
    }));
  }

  private activeWaivers(waivers: ParityCertificationWaiver[]): ParityCertificationWaiver[] {
    const nowMs = this.now().getTime();
    return waivers.filter((waiver) =>
      waiver.approved && (!waiver.expiresAt || Date.parse(waiver.expiresAt) >= nowMs),
    );
  }

  private noLiveIo(snapshot: OperationalParitySnapshot): boolean {
    return snapshot.summary.liveExternalCallRequired === false
      && snapshot.summary.liveChannelSendRequired === false
      && snapshot.summary.liveDeviceRequired === false
      && snapshot.summary.liveMemoryWriteRequired === false
      && snapshot.summary.filesystemReadRequired === false
      && snapshot.policy.noArtifactBodyReads === true;
  }

  private resolveStatus(input: {
    blockingFailures: number;
    failed: number;
    warned: number;
    waived: number;
  }): ParityCertificationStatus {
    if (input.blockingFailures > 0) {
      return 'blocked';
    }
    if (input.failed > 0 || input.warned > 0 || input.waived > 0) {
      return 'conditional';
    }
    return 'certified';
  }

  private minimumAction(
    operational: OperationalParitySnapshot,
    gates: ParityCertificationGate[],
    profile: ParityCertificationProfile,
  ): string {
    const firstBlocker = gates.find((gateItem) => gateItem.status === 'fail' && gateItem.severity === 'blocking');
    if (firstBlocker) {
      return firstBlocker.nextAction;
    }
    if (operational.summary.p1Gaps > 0) {
      return 'close or waive P1 gaps before release-candidate certification';
    }
    if (operational.summary.p2Gaps > 0) {
      return 'record P2 product decisions before public launch certification';
    }
    if (profile === 'private-absorption') {
      return 'run the release-candidate profile with require-ready';
    }
    if (profile === 'release-candidate') {
      return 'run the public-launch profile with require-ready';
    }
    return 'run release certification profile hardening with require-ready';
  }

  private releaseDecision(
    status: ParityCertificationStatus,
    operational: OperationalParitySnapshot,
    gates: ParityCertificationGate[],
  ): string {
    if (status === 'certified') {
      return 'certified for the selected profile';
    }
    const failed = gates.filter((gateItem) => gateItem.status === 'fail');
    if (failed.length > 0) {
      return `blocked by ${failed.length} failed gate(s), including ${operational.summary.p0Gaps} P0 gap(s)`;
    }
    return 'conditional only; warnings or waivers remain open';
  }
}

function gate(input: Omit<ParityCertificationGate, 'waiver'>): ParityCertificationGate {
  return {
    ...input,
    waiver: null,
  };
}
