import type { ZavorthControlExperienceHomeSnapshot } from '../contracts/ZavorthControlExperienceHomeContract.js';
import { ZavorthControlExperienceHomeService } from './ZavorthControlExperienceHomeService.js';
import { ZavorthDailyUseScenarioTestService, type ZavorthDailyUseScenarioTestSnapshot } from './ZavorthDailyUseScenarioTestService.js';
import { ZavorthReadyToGoService, type ZavorthReadyToGoSnapshot, type ZavorthReadyToGoStatus } from './ZavorthReadyToGoService.js';
import { ZavorthTrustApprovalUxFinalService, type ZavorthTrustApprovalUxFinalSnapshot } from './ZavorthTrustApprovalUxFinalService.js';

export const ZAVORTH_ONE_COMMAND_OPERATOR_CHECK_CONTRACT_VERSION =
  'zavorth-one-command-operator-check/1' as const;

export type ZavorthOneCommandOperatorCheckStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthOneCommandOperatorCheckInput = {
  live?: boolean;
  strict?: boolean;
  userId?: string | null;
  sessionId?: string | null;
  workspaceHint?: string | null;
};

export type ZavorthOneCommandOperatorCheckArea = {
  id: 'ready-to-go' | 'daily-use' | 'zavorthControl-permissions' | 'trust-approvals' | 'operator-safety';
  label: string;
  status: ZavorthOneCommandOperatorCheckStatus;
  summary: string;
  evidence: string[];
  nextAction: string;
};

export type ZavorthOneCommandOperatorCheckSnapshot = {
  contractVersion: typeof ZAVORTH_ONE_COMMAND_OPERATOR_CHECK_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'one-command-operator-check';
  generatedAt: string;
  status: ZavorthOneCommandOperatorCheckStatus;
  strictPass: boolean;
  headline: string;
  summary: {
    areas: number;
    ready: number;
    attention: number;
    blocked: number;
    liveProviderProbeRequested: boolean;
    remoteReady: boolean;
    localReady: boolean;
    dailyUseFailures: number;
    pendingApprovals: number;
    activeBreakGlassPolicies: number;
  };
  areas: ZavorthOneCommandOperatorCheckArea[];
  commands: {
    run: 'zavorth operator-check';
    json: 'zavorth operator-check --json';
    strict: 'zavorth operator-check --strict';
    live: 'zavorth operator-check --live';
    zavorthControl: '/zavorthControl';
    trust: 'zavorth trust';
    ready: 'zavorth ready';
  };
  safety: {
    noPromptExecution: true;
    noToolExecution: true;
    noLiveTransactionExecution: true;
    noRawSecretsSerialized: true;
    liveProviderProbeOnlyWhenRequested: boolean;
    zavorthControlCanExecuteTargetAction: false;
    approvalsRemainGatewayMediated: true;
  };
  source: {
    readyToGo: Pick<ZavorthReadyToGoSnapshot, 'generatedAt' | 'status' | 'remoteReady' | 'localReady' | 'summary'>;
    dailyUse: Pick<ZavorthDailyUseScenarioTestSnapshot, 'generatedAt' | 'status' | 'summary'>;
    zavorthControl: Pick<ZavorthControlExperienceHomeSnapshot, 'generatedAt' | 'surface' | 'permissionPanel' | 'safety'>;
    trust: Pick<ZavorthTrustApprovalUxFinalSnapshot, 'generatedAt' | 'status' | 'summary' | 'safety'>;
  };
};

type ReadyToGoLike = Pick<ZavorthReadyToGoService, 'buildSnapshot'>;
type DailyUseLike = Pick<ZavorthDailyUseScenarioTestService, 'buildSnapshot'>;
type ZavorthControlLike = Pick<ZavorthControlExperienceHomeService, 'buildSnapshot'>;
type TrustLike = Pick<ZavorthTrustApprovalUxFinalService, 'buildSnapshot'>;

export type ZavorthOneCommandOperatorCheckRuntime = {
  now?: () => Date;
  readyToGo?: ReadyToGoLike;
  dailyUse?: DailyUseLike;
  zavorthControl?: ZavorthControlLike;
  trust?: TrustLike;
};

export class ZavorthOneCommandOperatorCheckService {
  private readonly now: () => Date;
  private readonly readyToGo: ReadyToGoLike;
  private readonly dailyUse: DailyUseLike;
  private readonly zavorthControl: ZavorthControlLike;
  private readonly trust: TrustLike;

  public constructor(runtime: ZavorthOneCommandOperatorCheckRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readyToGo = runtime.readyToGo || new ZavorthReadyToGoService({ now: this.now });
    this.dailyUse = runtime.dailyUse || new ZavorthDailyUseScenarioTestService({ now: this.now });
    this.zavorthControl = runtime.zavorthControl || new ZavorthControlExperienceHomeService({ now: this.now });
    this.trust = runtime.trust || new ZavorthTrustApprovalUxFinalService({ now: this.now });
  }

  public async buildSnapshot(input: ZavorthOneCommandOperatorCheckInput = {}): Promise<ZavorthOneCommandOperatorCheckSnapshot> {
    const live = input.live === true;
    const [readyToGo, dailyUse, zavorthControl, trust] = await Promise.all([
      this.readyToGo.buildSnapshot({
        refreshProviders: live,
        includeAdvancedProviders: false,
        userId: input.userId || 'local-user',
        sessionId: input.sessionId || 'operator-check',
        workspaceHint: input.workspaceHint || process.cwd(),
      }),
      this.dailyUse.buildSnapshot(),
      Promise.resolve(this.zavorthControl.buildSnapshot()),
      Promise.resolve(this.trust.buildSnapshot({ limit: 8 })),
    ]);

    const areas = [
      buildReadyToGoArea(readyToGo, live),
      buildDailyUseArea(dailyUse),
      buildZavorthControlPermissionArea(zavorthControl),
      buildTrustArea(trust),
      buildSafetyArea({ readyToGo, dailyUse, zavorthControl, trust, live }),
    ];
    const summary = {
      areas: areas.length,
      ready: areas.filter((area) => area.status === 'ready').length,
      attention: areas.filter((area) => area.status === 'attention').length,
      blocked: areas.filter((area) => area.status === 'blocked').length,
      liveProviderProbeRequested: live,
      remoteReady: readyToGo.remoteReady,
      localReady: readyToGo.localReady,
      dailyUseFailures: dailyUse.summary.failed,
      pendingApprovals: trust.summary.pendingApprovals,
      activeBreakGlassPolicies: trust.summary.activeBreakGlassPolicies,
    };
    const status = summary.blocked > 0
      ? 'blocked'
      : summary.attention > 0
        ? 'attention'
        : 'ready';
    const strictPass = status === 'ready';

    return {
      contractVersion: ZAVORTH_ONE_COMMAND_OPERATOR_CHECK_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'one-command-operator-check',
      generatedAt: this.now().toISOString(),
      status,
      strictPass,
      headline: buildHeadline(status, readyToGo),
      summary,
      areas,
      commands: {
        run: 'zavorth operator-check',
        json: 'zavorth operator-check --json',
        strict: 'zavorth operator-check --strict',
        live: 'zavorth operator-check --live',
        zavorthControl: '/zavorthControl',
        trust: 'zavorth trust',
        ready: 'zavorth ready',
      },
      safety: {
        noPromptExecution: true,
        noToolExecution: true,
        noLiveTransactionExecution: true,
        noRawSecretsSerialized: true,
        liveProviderProbeOnlyWhenRequested: !live || input.live === true,
        zavorthControlCanExecuteTargetAction: false,
        approvalsRemainGatewayMediated: true,
      },
      source: {
        readyToGo: {
          generatedAt: readyToGo.generatedAt,
          status: readyToGo.status,
          remoteReady: readyToGo.remoteReady,
          localReady: readyToGo.localReady,
          summary: readyToGo.summary,
        },
        dailyUse: {
          generatedAt: dailyUse.generatedAt,
          status: dailyUse.status,
          summary: dailyUse.summary,
        },
        zavorthControl: {
          generatedAt: zavorthControl.generatedAt,
          surface: zavorthControl.surface,
          permissionPanel: zavorthControl.permissionPanel,
          safety: zavorthControl.safety,
        },
        trust: {
          generatedAt: trust.generatedAt,
          status: trust.status,
          summary: trust.summary,
          safety: trust.safety,
        },
      },
    };
  }

  public renderCli(snapshot: ZavorthOneCommandOperatorCheckSnapshot): string {
    const areaLines = snapshot.areas.map((area) => [
      `- ${area.label}: ${renderStatus(area.status)}`,
      `  ${area.summary}`,
      `  next: ${area.nextAction}`,
    ].join('\n'));
    return [
      'Zavorth Operator Check',
      snapshot.headline,
      '',
      `Status: ${renderStatus(snapshot.status)}`,
      `usage remote: ${snapshot.summary.remoteReady ? 'ready' : 'com attention'}`,
      `usage local: ${snapshot.summary.localReady ? 'ready' : 'blocked'}`,
      `Areas: ${snapshot.summary.ready} ready, ${snapshot.summary.attention} attention, ${snapshot.summary.blocked} blocked`,
      '',
      'Areas',
      ...areaLines,
      '',
      'Comandos uteis',
      `- ZavorthControl: ${snapshot.commands.zavorthControl}`,
      `- Trust: ${snapshot.commands.trust}`,
      `- Ready: ${snapshot.commands.ready}`,
      `- JSON: ${snapshot.commands.json}`,
      snapshot.summary.liveProviderProbeRequested ? 'Live provider probe: explicitly requested.'
        : 'Live provider probe: not executed. Use --live when you want to test providers now.',
      '',
    ].join('\n');
  }
}

function buildReadyToGoArea(snapshot: ZavorthReadyToGoSnapshot, live: boolean): ZavorthOneCommandOperatorCheckArea {
  return {
    id: 'ready-to-go',
    label: 'Ready To Go',
    status: mapReadyToGoStatus(snapshot.status),
    summary: `${snapshot.actions.primary} Provider default=${snapshot.summary.providerDefaultRoutes}; Telegram=${snapshot.channels.telegram}; ZavorthControl=${snapshot.channels.zavorthControl}.`,
    evidence: [
      `remoteReady=${snapshot.remoteReady}`,
      `localReady=${snapshot.localReady}`,
      `providerProbe=${live ? 'explicit-live' : 'offline'}`,
    ],
    nextAction: snapshot.status === 'ready' ? 'Use Zavorth normalmente.' : snapshot.actions.fixes,
  };
}

function buildDailyUseArea(snapshot: ZavorthDailyUseScenarioTestSnapshot): ZavorthOneCommandOperatorCheckArea {
  return {
    id: 'daily-use',
    label: 'Daily Use Scenarios',
    status: mapScenarioStatus(snapshot.status),
    summary: `${snapshot.summary.passed}/${snapshot.summary.scenarios} cenarios passaram; ${snapshot.summary.failed} falharam; ${snapshot.summary.attention} need attention.`,
    evidence: snapshot.findings.slice(0, 3).map((finding) => `${finding.severity}: ${finding.summary}`),
    nextAction: snapshot.findings[0]?.nextAction || 'Keep daily flows green.',
  };
}

function buildZavorthControlPermissionArea(snapshot: ZavorthControlExperienceHomeSnapshot): ZavorthOneCommandOperatorCheckArea {
  const permissionPanel = snapshot.permissionPanel;
  const itemIds = Array.isArray(permissionPanel?.items)
    ? permissionPanel.items.map((item) => item.id)
    : [];
  const complete = ['permissions', 'auto-approvals', 'extreme-mode', 'revoke', 'receipts']
    .every((item) => (itemIds as string[]).includes(item));
  const zavorthControlCanExecute = snapshot.safety?.zavorthControlCanExecuteTargetAction === false ? false : true;
  return {
    id: 'zavorthControl-permissions',
    label: 'ZavorthControl Permissions',
    status: complete && zavorthControlCanExecute === false ? 'ready' : 'blocked',
    summary: complete ? 'ZavorthControl exposes permissions, auto-approvals, extreme mode, revocation, and receipts without direct authority.'
      : 'ZavorthControl does not expose all requested permission areas yet.',
    evidence: [
      `items=${itemIds.join(',')}`,
      `zavorthControlCanExecute=${zavorthControlCanExecute}`,
      permissionPanel?.defaultPosture || 'permissionPanel=missing',
    ],
    nextAction: complete ? '/zavorthControl' : 'run zavorth zavorthControl-home e fix permission projection.',
  };
}

function buildTrustArea(snapshot: ZavorthTrustApprovalUxFinalSnapshot): ZavorthOneCommandOperatorCheckArea {
  const status = snapshot.status === 'danger' ? 'blocked' : snapshot.status;
  return {
    id: 'trust-approvals',
    label: 'Trust & Approvals',
    status,
    summary: `${snapshot.summary.pendingApprovals} pending; ${snapshot.summary.activePersistentPolicies} persistent; ${snapshot.summary.activeBreakGlassPolicies} break-glass.`,
    evidence: [
      `criticalCannotBeAutoApproved=${snapshot.safety.criticalRiskCannotBeAutoApproved}`,
      `breakGlassDoubleConfirm=${snapshot.safety.breakGlassRequiresDoubleConfirmation}`,
      `receiptsRequired=${snapshot.safety.receiptsRequired}`,
    ],
    nextAction: snapshot.narrative.nextAction,
  };
}

function buildSafetyArea(input: {
  readyToGo: ZavorthReadyToGoSnapshot;
  dailyUse: ZavorthDailyUseScenarioTestSnapshot;
  zavorthControl: ZavorthControlExperienceHomeSnapshot;
  trust: ZavorthTrustApprovalUxFinalSnapshot;
  live: boolean;
}): ZavorthOneCommandOperatorCheckArea {
  const ok = input.readyToGo.safety.noRawSecretsSerialized
    && input.dailyUse.safety.noFileContentExfiltration
    && input.zavorthControl.safety.rawSecretsSerialized === false
    && input.trust.safety.rawSecretsSerialized === false
    && input.trust.safety.naturalLanguageCanRequestApprovalButNotBypass;
  return {
    id: 'operator-safety',
    label: 'Operator Safety',
    status: ok ? 'ready' : 'blocked',
    summary: ok ? 'without prompt/tool/transaction live oculta; secrets e approvals seguem governados.'
      : 'An operator safety guarantee failed.',
    evidence: [
      `liveProbeRequested=${input.live}`,
      `dailyUseDryRunOnly=${input.dailyUse.safety.dryRunOnly}`,
      `noRawSecrets=${input.readyToGo.safety.noRawSecretsSerialized && input.trust.safety.rawSecretsSerialized === false}`,
      `approvalBypass=${!input.trust.safety.naturalLanguageCanRequestApprovalButNotBypass}`,
    ],
    nextAction: ok ? 'No critical action.' : 'run npm run security:ci before operar.',
  };
}

function mapReadyToGoStatus(status: ZavorthReadyToGoStatus): ZavorthOneCommandOperatorCheckStatus {
  return status;
}

function mapScenarioStatus(status: ZavorthDailyUseScenarioTestSnapshot['status']): ZavorthOneCommandOperatorCheckStatus {
  if (status === 'failed') return 'blocked';
  if (status === 'passed') return 'ready';
  return 'attention';
}

function buildHeadline(status: ZavorthOneCommandOperatorCheckStatus, readyToGo: ZavorthReadyToGoSnapshot): string {
  if (status === 'ready') return 'Everything is ready to operate: local, remote, trust, and zavorthControl are coherent.';
  if (status === 'attention') return 'Zavorth is utilizavel, mas ha avisos que merecunder review before depender remote.';
  return readyToGo.actions.primary;
}

function renderStatus(status: ZavorthOneCommandOperatorCheckStatus): string {
  if (status === 'ready') return 'ready';
  if (status === 'attention') return 'attention';
  return 'blocked';
}
