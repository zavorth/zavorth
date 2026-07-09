import {
  buildZavorthTransactionCertificationContractSnapshot,
  ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION,
  type ZavorthTransactionCertificationContractSnapshot,
  type ZavorthTransactionCertificationGate,
  type ZavorthTransactionCertificationGateKind,
  type ZavorthTransactionCertificationReport,
  type ZavorthTransactionCertificationScenario,
  type ZavorthTransactionCertificationScenarioCheck,
  type ZavorthTransactionCertificationScenarioId,
  type ZavorthTransactionCertificationStatus,
} from '../contracts/ZavorthTransactionCertificationContract.js';
import type {
  ZavorthTransactionZavorthControlProjectInput,
  ZavorthTransactionZavorthControlProjection,
  ZavorthTransactionZavorthControlTone,
} from '../contracts/ZavorthTransactionZavorthControlContract.js';
import type {
  ZavorthTransactionSurfaceKind,
} from '../contracts/ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionRuntimeStatus,
} from '../contracts/ZavorthTransactionRuntimeContract.js';
import { ZavorthTransactionApprovalLedgerService } from './ZavorthTransactionApprovalLedgerService.js';

import { ZavorthTransactionZavorthControlProjectionService } from './ZavorthTransactionZavorthControlProjectionService.js';
import { ZavorthTransactionConnectorRegistryService } from './ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from './ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from './ZavorthTransactionPreviewService.js';
import { ZavorthTransactionRuntimeOrchestratorService } from './ZavorthTransactionRuntimeOrchestratorService.js';
import { ZavorthTransactionSurfaceGatewayService } from './ZavorthTransactionSurfaceGatewayService.js';

type CertificationDeps = {
  now?: () => Date;
  zavorthControl?: ZavorthTransactionZavorthControlProjectionService;
  credentialRefs?: ZavorthTransactionCredentialRefService;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

type CertificationScenarioSpec = {
  id: ZavorthTransactionCertificationScenarioId;
  label: string;
  surface: ZavorthTransactionSurfaceKind;
  input: (credentialRef: string | null) => ZavorthTransactionZavorthControlProjectInput;
  expectedStatus: ZavorthTransactionRuntimeStatus;
  expectedTone: ZavorthTransactionZavorthControlTone;
  expectedRoute?: string;
  expectedEnabledAction?: string;
  expectedLane?: string;
  expectedTimeline?: Record<string, string>;
  expectedConnectorStatus?: string;
};

const RAW_SECRET_SENTINEL = 'sk-super-secret-value-123456';

const SAFETY = {
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  externalSideEffects: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
} as const;

export class ZavorthTransactionCertificationService {
  private readonly now: () => Date;
  private readonly zavorthControl: ZavorthTransactionZavorthControlProjectionService;
  private readonly credentialRefs: ZavorthTransactionCredentialRefService;

  public constructor(deps: CertificationDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.credentialRefs = deps.credentialRefs ?? new ZavorthTransactionCredentialRefService({
      storeFile: deps.credentialStoreFile,
      now: this.now,
    });
    this.zavorthControl = deps.zavorthControl ?? createZavorthControl({
      now: this.now,
      credentialRefs: this.credentialRefs,
      ledgerFile: deps.ledgerFile,
    });
  }

  public buildSnapshot(): ZavorthTransactionCertificationContractSnapshot {
    return buildZavorthTransactionCertificationContractSnapshot();
  }

  public certify(): ZavorthTransactionCertificationReport {
    const generatedAt = this.now().toISOString();
    const credentialRef = this.registerPaperCredentialRef();
    const scenarios = buildScenarioSpecs().map((spec) => this.runScenario(spec, credentialRef));
    const gates = buildGates(scenarios);
    const failedScenarioCount = scenarios.filter((scenario) => scenario.status === 'failed').length;
    const status: ZavorthTransactionCertificationStatus = failedScenarioCount === 0 && gates.every((gate) => gate.passed)
      ? 'passed'
      : 'failed';

    return {
      version: ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION,
      generatedAt,
      status,
      summary: status === 'passed'
        ? 'Transaction Plane Phases 0-8 certified as governed, redacted and live-disabled.'
        : 'Transaction Plane certification failed; inspect failed scenarios and gates.',
      scenarioCount: scenarios.length,
      passedScenarioCount: scenarios.length - failedScenarioCount,
      failedScenarioCount,
      gates,
      scenarios,
      safety: SAFETY,
      nextStage: 'Intent model0 - Owner-Gated Live Candidate Envelope',
    };
  }

  public renderReport(report: ZavorthTransactionCertificationReport): string {
    return [
      '[transaction-certification] Certification matrix transaction certification',
      `[transaction-certification] status: ${report.status}`,
      `[transaction-certification] scenarios: ${report.passedScenarioCount}/${report.scenarioCount}`,
      `[transaction-certification] gates: ${report.gates.filter((gate) => gate.passed).length}/${report.gates.length}`,
      `[transaction-certification] no-live-execution: ${report.safety.noLiveExecution}`,
      `[transaction-certification] no-raw-secret-serialized: ${report.safety.noRawSecretSerialized}`,
      `[transaction-certification] live-action-applied: ${report.safety.liveActionApplied}`,
      ...report.gates.map((gate) => `[transaction-certification] gate: ${gate.kind} passed=${gate.passed} summary=${gate.summary}`),
      ...report.scenarios.map((scenario) => `[transaction-certification] scenario: ${scenario.id} status=${scenario.status} observed=${scenario.observedStatus}/${scenario.observedTone}`),
      `[transaction-certification] next: ${report.nextStage}`,
    ].join('\n');
  }

  private registerPaperCredentialRef(): string | null {
    const result = this.credentialRefs.register({
      label: 'Certification matrix exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now: this.now(),
    });
    return result.record?.ref ?? null;
  }

  private runScenario(
    spec: CertificationScenarioSpec,
    credentialRef: string | null,
  ): ZavorthTransactionCertificationScenario {
    const projection = this.zavorthControl.project(spec.input(credentialRef));
    const enabledActions = projection.operatorActions
      .filter((action) => action.enabled)
      .map((action) => action.sourceActionId);
    const laneKinds = projection.lanes.map((lane) => lane.kind);
    const timelineStatuses = Object.fromEntries(projection.timeline.map((item) => [item.id, item.status]));
    const checks = buildScenarioChecks(spec, projection, enabledActions, laneKinds, timelineStatuses);
    const status: ZavorthTransactionCertificationStatus = checks.every((check) => check.passed) ? 'passed' : 'failed';

    return {
      id: spec.id,
      label: spec.label,
      surface: spec.surface,
      status,
      expectedStatus: spec.expectedStatus,
      observedStatus: projection.status,
      expectedTone: spec.expectedTone,
      observedTone: projection.tone,
      projectionId: projection.id,
      sourceProjectionId: projection.sourceProjectionId,
      naturalFirstRoute: projection.surfaceProjection.naturalFirst.route,
      connectorStatus: projection.surfaceProjection.runtime.connectorRun?.status ?? 'not-run',
      enabledActions,
      laneKinds,
      timelineStatuses,
      checks,
    };
  }
}

function createZavorthControl(input: {
  now: () => Date;
  credentialRefs: ZavorthTransactionCredentialRefService;
  ledgerFile?: string;
}): ZavorthTransactionZavorthControlProjectionService {
  const previewService = new ZavorthTransactionPreviewService();
  return new ZavorthTransactionZavorthControlProjectionService({
    now: input.now,
    surfaceGateway: new ZavorthTransactionSurfaceGatewayService({
      now: input.now,
      runtime: new ZavorthTransactionRuntimeOrchestratorService({
        now: input.now,
        previewService,
        approvalLedger: new ZavorthTransactionApprovalLedgerService({
          ledgerFile: input.ledgerFile,
          now: input.now,
          previewService,
        }),
        credentialRefs: input.credentialRefs,
        connectorRegistry: new ZavorthTransactionConnectorRegistryService({
          now: input.now,
        }),
      }),
    }),
  });
}

function buildScenarioSpecs(): CertificationScenarioSpec[] {
  return [
    {
      id: 'web-trade-approval',
      label: 'Web trade stops at approval gate.',
      surface: 'web',
      input: () => ({
        text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
        surface: 'web',
        mode: 'paper',
      }),
      expectedStatus: 'approval-required',
      expectedTone: 'attention',
      expectedRoute: 'approval-proposal',
      expectedEnabledAction: 'request-approval',
      expectedLane: 'approval',
      expectedTimeline: {
        approval: 'pending',
        connector: 'pending',
      },
    },
    {
      id: 'api-approved-paper-trade',
      label: 'API approved paper trade reaches typed connector simulation.',
      surface: 'api',
      input: (credentialRef) => ({
        text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
        surface: 'api',
        approve: true,
        mode: 'paper',
        credentialRef,
      }),
      expectedStatus: 'simulated',
      expectedTone: 'success',
      expectedRoute: 'approval-proposal',
      expectedLane: 'connector',
      expectedTimeline: {
        approval: 'done',
        credential: 'done',
        connector: 'done',
      },
      expectedConnectorStatus: 'simulated',
    },
    {
      id: 'cli-credential-required',
      label: 'CLI approved trade asks for credential ref when required.',
      surface: 'cli',
      input: () => ({
        text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
        surface: 'cli',
        approve: true,
        mode: 'paper',
        requireCredential: true,
      }),
      expectedStatus: 'credential-required',
      expectedTone: 'attention',
      expectedRoute: 'approval-proposal',
      expectedEnabledAction: 'provide-credential-ref',
      expectedLane: 'credential',
      expectedTimeline: {
        approval: 'done',
        credential: 'pending',
        connector: 'pending',
      },
    },
    {
      id: 'telegram-price-monitor',
      label: 'Telegram monitor runs as non-live market-data simulation.',
      surface: 'telegram',
      input: () => ({
        text: 'Monitore notebook abaixo de R$3500 e me avise.',
        surface: 'telegram',
        mode: 'sandbox',
      }),
      expectedStatus: 'simulated',
      expectedTone: 'success',
      expectedRoute: 'tool-preview',
      expectedLane: 'connector',
      expectedTimeline: {
        approval: 'skipped',
        connector: 'done',
      },
      expectedConnectorStatus: 'simulated',
    },
    {
      id: 'web-raw-secret-blocked',
      label: 'Web raw secret request is blocked and redacted.',
      surface: 'web',
      input: () => ({
        text: `Compre ETH ate R$100 usando api_key=${RAW_SECRET_SENTINEL}.`,
        surface: 'web',
        approve: true,
        mode: 'paper',
      }),
      expectedStatus: 'blocked',
      expectedTone: 'blocked',
      expectedRoute: 'approval-proposal',
      expectedLane: 'safety',
      expectedTimeline: {
        preview: 'blocked',
        connector: 'blocked',
      },
    },
  ];
}

function buildScenarioChecks(
  spec: CertificationScenarioSpec,
  projection: ZavorthTransactionZavorthControlProjection,
  enabledActions: string[],
  laneKinds: string[],
  timelineStatuses: Record<string, string>,
): ZavorthTransactionCertificationScenarioCheck[] {
  const serialized = JSON.stringify(projection);
  const checks: ZavorthTransactionCertificationScenarioCheck[] = [
    check('status', 'expected runtime status', spec.expectedStatus, projection.status),
    check('tone', 'expected cockpit tone', spec.expectedTone, projection.tone),
    check('natural-first-route', 'expected Natural First route', spec.expectedRoute ?? 'any', spec.expectedRoute ? projection.surfaceProjection.naturalFirst.route : 'any'),
    check('lane', 'expected cockpit lane', spec.expectedLane ?? 'any', spec.expectedLane && laneKinds.includes(spec.expectedLane) ? spec.expectedLane : 'missing'),
    check('no-live-execution', 'live execution disabled', 'true/false/false', `${projection.safety.noLiveExecution}/${projection.safety.liveActionApplied}/${projection.safety.externalSideEffects}`),
    check('redaction', 'raw secret not serialized', 'absent', serialized.includes(RAW_SECRET_SENTINEL) ? 'present' : 'absent'),
    check('zavorthControl-shape', 'lanes and operator actions present', '>=8/>=6', `${projection.lanes.length}/${projection.operatorActions.length}`),
  ];

  if (spec.expectedEnabledAction) {
    checks.push(check(
      'enabled-action',
      'expected operator action enabled',
      spec.expectedEnabledAction,
      enabledActions.includes(spec.expectedEnabledAction) ? spec.expectedEnabledAction : 'missing',
    ));
  }
  if (spec.expectedConnectorStatus) {
    checks.push(check(
      'connector-status',
      'expected typed connector status',
      spec.expectedConnectorStatus,
      projection.surfaceProjection.runtime.connectorRun?.status ?? 'not-run',
    ));
  }
  for (const [id, expected] of Object.entries(spec.expectedTimeline ?? {})) {
    checks.push(check(`timeline-${id}`, `timeline ${id}`, expected, timelineStatuses[id] ?? 'missing'));
  }

  return checks.map((item) => {
    if (item.id === 'zavorthControl-shape') {
      return {
        ...item,
        passed: projection.lanes.length >= 8 && projection.operatorActions.length >= 6,
      };
    }
    if (item.id === 'no-live-execution') {
      return {
        ...item,
        passed: projection.safety.noLiveExecution === true
          && projection.safety.liveActionApplied === false
          && projection.safety.externalSideEffects === false,
      };
    }
    return item;
  });
}

function check(
  id: string,
  label: string,
  expected: string,
  observed: string,
): ZavorthTransactionCertificationScenarioCheck {
  return {
    id,
    label,
    expected,
    observed,
    passed: expected === observed,
  };
}

function buildGates(scenarios: ZavorthTransactionCertificationScenario[]): ZavorthTransactionCertificationGate[] {
  const surfaces = new Set(scenarios.map((scenario) => scenario.surface));
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const gates: Array<{
    kind: ZavorthTransactionCertificationGateKind;
    passed: boolean;
    summary: string;
    evidence: string[];
  }> = [
    {
      kind: 'natural-first-routing',
      passed: scenarios.every((scenario) => scenario.naturalFirstRoute === 'approval-proposal' || scenario.naturalFirstRoute === 'tool-preview'),
      summary: 'Natural First routes transactional free text into governed approval or preview paths.',
      evidence: scenarios.map((scenario) => `${scenario.id}:${scenario.naturalFirstRoute}`),
    },
    {
      kind: 'approval-gate',
      passed: scenarioById.get('web-trade-approval')?.observedStatus === 'approval-required'
        && scenarioById.get('web-trade-approval')?.enabledActions.includes('request-approval') === true,
      summary: 'Real value movement blocks at explicit approval before simulation continues.',
      evidence: evidenceForScenario(scenarioById.get('web-trade-approval')),
    },
    {
      kind: 'credential-ref-gate',
      passed: scenarioById.get('cli-credential-required')?.observedStatus === 'credential-required'
        && scenarioById.get('cli-credential-required')?.enabledActions.includes('provide-credential-ref') === true,
      summary: 'Credential-dependent connector simulation asks for SecretRef metadata only.',
      evidence: evidenceForScenario(scenarioById.get('cli-credential-required')),
    },
    {
      kind: 'typed-connector-simulation',
      passed: scenarioById.get('api-approved-paper-trade')?.connectorStatus === 'simulated'
        && scenarioById.get('telegram-price-monitor')?.connectorStatus === 'simulated',
      summary: 'Approved trade and monitor requests reach typed connector simulation without live effects.',
      evidence: [
        ...evidenceForScenario(scenarioById.get('api-approved-paper-trade')),
        ...evidenceForScenario(scenarioById.get('telegram-price-monitor')),
      ],
    },
    {
      kind: 'zavorthControl-projection',
      passed: scenarios.every((scenario) => scenario.laneKinds.includes('safety') && scenario.checks.some((item) => item.id === 'zavorthControl-shape' && item.passed)),
      summary: 'Every scenario renders cockpit lanes, timeline and operator actions.',
      evidence: scenarios.map((scenario) => `${scenario.id}:lanes=${scenario.laneKinds.length}:actions=${scenario.enabledActions.join('|') || 'none'}`),
    },
    {
      kind: 'cross-surface-consistency',
      passed: ['web', 'api', 'cli', 'telegram'].every((surface) => surfaces.has(surface as ZavorthTransactionSurfaceKind)),
      summary: 'Certification covers Web, API, CLI and Telegram surfaces through the same projection path.',
      evidence: [...surfaces].sort(),
    },
    {
      kind: 'secret-redaction',
      passed: scenarioById.get('web-raw-secret-blocked')?.observedStatus === 'blocked'
        && scenarioById.get('web-raw-secret-blocked')?.checks.find((item) => item.id === 'redaction')?.passed === true,
      summary: 'Raw transaction secrets are blocked and absent from certification output.',
      evidence: evidenceForScenario(scenarioById.get('web-raw-secret-blocked')),
    },
    {
      kind: 'no-live-execution',
      passed: scenarios.every((scenario) => scenario.checks.find((item) => item.id === 'no-live-execution')?.passed === true),
      summary: 'All scenarios preserve live-disabled safety flags.',
      evidence: scenarios.map((scenario) => `${scenario.id}:live=false`),
    },
  ];

  return gates;
}

function evidenceForScenario(scenario: ZavorthTransactionCertificationScenario | undefined): string[] {
  if (!scenario) {
    return ['missing-scenario'];
  }
  return [
    `status=${scenario.observedStatus}`,
    `tone=${scenario.observedTone}`,
    `route=${scenario.naturalFirstRoute}`,
    `connector=${scenario.connectorStatus}`,
  ];
}
