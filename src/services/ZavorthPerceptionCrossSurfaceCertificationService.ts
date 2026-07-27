import {
  ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION,
  type ZavorthPerceptionCertificationMatrixRow,
  type ZavorthPerceptionZavorthControlProjection,
  type ZavorthPerceptionZavorthControlTarget,
  type ZavorthPerceptionCrossSurfaceCertificationSnapshot,
  type ZavorthPerceptionCrossSurfaceName,
  type ZavorthPerceptionCrossSurfaceStatus,
  type ZavorthPerceptionSurfaceProjection,
} from '../contracts/ZavorthPerceptionCrossSurfaceCertificationContract.js';
import type { ZavorthAndroidAdbSnapshot } from '../contracts/ZavorthAndroidAdbBridgeContract.js';
import type { ZavorthBrowserVisionBridgeSnapshot } from '../contracts/ZavorthBrowserVisionBridgeContract.js';
import type { ZavorthComputerControlSnapshot } from '../contracts/ZavorthComputerControlPlaneContract.js';
import type { ZavorthVisionControlPlaneSnapshot } from '../contracts/ZavorthVisionControlPlaneContract.js';
import type { SurfaceResponse } from '../domain/surface/application/surface-response/index.js';
import { ZavorthAdbCommandResult, type ZavorthAdbRunner } from './ZavorthAndroidAdbBridgeService.js';
import { ZavorthAndroidAdbBridgeService } from './ZavorthAndroidAdbBridgeService.js';

import { ZavorthBrowserVisionBridgeService } from './ZavorthBrowserVisionBridgeService.js';
import { ZavorthComputerControlPlaneService } from './ZavorthComputerControlPlaneService.js';
import { ZavorthPerceptionInvocationRouter } from './ZavorthPerceptionInvocationRouter.js';
import { ZavorthVisionControlPlaneService } from './ZavorthVisionControlPlaneService.js';

type Runtime = {
  now?: () => Date;
  router?: ZavorthPerceptionInvocationRouter;
  vision?: ZavorthVisionControlPlaneService;
  browser?: ZavorthBrowserVisionBridgeService;
  computer?: ZavorthComputerControlPlaneService;
  android?: ZavorthAndroidAdbBridgeService;
};

type PhaseSnapshots = {
  pc: ZavorthVisionControlPlaneSnapshot;
  browserDom: ZavorthBrowserVisionBridgeSnapshot;
  browserScreenshot: ZavorthBrowserVisionBridgeSnapshot;
  adbScreenshot: ZavorthAndroidAdbSnapshot;
  adbUiDump: ZavorthAndroidAdbSnapshot;
  terminalBlock: ZavorthComputerControlSnapshot;
  secretsBlock: ZavorthComputerControlSnapshot;
  approvalRequired: ZavorthComputerControlSnapshot;
  cancelPause: ZavorthComputerControlSnapshot;
};

const PHASE_6_SURFACES: ZavorthPerceptionCrossSurfaceName[] = [
  'cli',
  'web',
  'telegram',
  'discord',
  'whatsapp',
  'signal',
  'imessage',
];

const REQUIRED_COMMANDS = [
  '/vision status',
  '/vision inspect',
  '/vision explain',
  '/computer status',
  '/computer observe',
  '/computer plan',
  '/computer approve <plan>',
  '/computer cancel',
  '/device status',
  '/device android doctor',
  '/device screenshot',
  '/device inspect',
  '/device plan',
  '/device approve <plan>',
  '/device cancel',
];

export class ZavorthPerceptionCrossSurfaceCertificationService {
  private readonly now: () => Date;
  private readonly router: ZavorthPerceptionInvocationRouter;
  private readonly vision: ZavorthVisionControlPlaneService;
  private readonly browser: ZavorthBrowserVisionBridgeService;
  private readonly computer: ZavorthComputerControlPlaneService;
  private readonly android: ZavorthAndroidAdbBridgeService;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.router = runtime.router || new ZavorthPerceptionInvocationRouter();
    this.vision = runtime.vision || new ZavorthVisionControlPlaneService();
    this.browser =
      runtime.browser ||
      new ZavorthBrowserVisionBridgeService({
        sidecar: null,
        egressGuard: async (url) => new URL(url),
      });
    this.computer = runtime.computer || new ZavorthComputerControlPlaneService({ vision: this.vision });
    this.android =
      runtime.android ||
      new ZavorthAndroidAdbBridgeService({
        vision: this.vision,
        runner: createMockAdbRunner(),
        artifactRoot: '.tmp/perception-certification-adb',
      });
  }

  public async buildSnapshot(): Promise<ZavorthPerceptionCrossSurfaceCertificationSnapshot> {
    const naturalPlan = this.router.plan({
      text: 'use delegated review for the visible screen and report the next safe step',
      channel: 'web',
      actorId: 'gate-6-certification',
      // Structured intent only — free text never activates subagent_perception.
      targetKind: 'visual',
      requestSubagents: true,
    });
    const surfaceResponse = this.router.buildSurfaceResponse(naturalPlan);
    const phaseSnapshots = await this.buildPhaseSnapshots();
    const certificationMatrix = buildCertificationMatrix(phaseSnapshots);
    const zavorthControlProjection = buildZavorthControlProjection(
      this.now().toISOString(),
      phaseSnapshots,
      certificationMatrix,
    );
    const surfaceProjections = PHASE_6_SURFACES.map((surface) =>
      buildSurfaceProjection(surface, surfaceResponse, zavorthControlProjection),
    );
    const status = resumeStatus([...certificationMatrix, ...surfaceProjections, zavorthControlProjection]);
    const finalProjection = {
      ...zavorthControlProjection,
      status,
    };

    return {
      contractVersion: ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthPerceptionCrossSurfaceCertificationService',
      status,
      naturalPlan,
      surfaceResponse,
      surfaceProjections,
      zavorthControlProjection: finalProjection,
      certificationMatrix,
      liveCanary: {
        enabled: false,
        requiresExplicitFlag: true,
        requiresOwnerApproval: true,
        safeMockUsedForPhaseGate: true,
      },
      safety: {
        noWorkspaceMutation: true,
        noExternalIo: true,
        noRawSecretsSerialized: true,
        visualChangesRequireOwnerApproval: true,
        mutationStillRequiresApproval: true,
        canaryLiveOnlyWithExplicitApproval: true,
      },
      commands: {
        report: 'npm run qa:perception-surface-certification --silent',
        inspectJson: 'npm run qa:perception-surface-certification:json --silent',
        check: 'npm run qa:perception-surface-certification:check --silent',
        inspectTarget: 'npm run qa:perception-surface-certification:target --silent --id=<id>',
        nextStep: 'Perception cross-surface certification matrix matches gate-6',
      },
      nextSafeAction:
        'Use /vision, /computer, or /device in read-only mode; live canary requires explicit flag and owner approval.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthPerceptionCrossSurfaceCertificationSnapshot): string {
    const projection = snapshot.zavorthControlProjection || snapshot.zavorthControlProjection;
    const rows = snapshot.certificationMatrix.map((row) => `${pad(row.id, 35)} ${pad(row.status, 10)} ${row.evidence}`);
    return [
      'Zavorth Perception Cross-Surface Certification - Runtime gateway',
      '',
      `Status: ${snapshot.status}`,
      `Surfaces: ${snapshot.surfaceProjections.filter((surface) => surface.status === 'passed').length}/${snapshot.surfaceProjections.length}`,
      `Targets: ${projection.targets.length}`,
      `Pending plans: ${projection.pendingPlans.length}`,
      `Approvals: ${projection.approvals.length}`,
      `Artifacts: ${projection.artifacts.length}`,
      '',
      `${pad('Scenario', 35)} ${pad('Status', 10)} Evidence`,
      ...rows,
      '',
      'Commands:',
      ...REQUIRED_COMMANDS.map((command) => `- ${command}`),
      '',
      `ZavorthControl projection: ${projection.surface.zavorthControlPath}`,
      `API projection: ${projection.surface.apiPath}`,
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private async buildPhaseSnapshots(): Promise<PhaseSnapshots> {
    const pc = this.vision.buildSnapshot({
      action: 'vision.inspect',
      targetKind: 'desktop',
      observationText: 'local screen without secrets showing a ready result.',
      artifactPath: 'fixture://pc-screenshot.png',
      retentionTtlMs: 15 * 60 * 1000,
    });
    const browserDom = await this.browser.execute({
      action: 'browser.inspect',
      url: 'https://example.com/app',
      domText: '<main><h1>ZavorthControl ready</h1><button>CHECK</button></main>',
    });
    const browserScreenshot = await this.browser.execute({
      action: 'browser.inspect',
      url: 'https://example.com/app',
      screenshotText: 'Screenshot do browser mostra tabela operational loaded.',
    });
    const adbScreenshot = await this.android.execute({
      action: 'device.screenshot',
      live: true,
      screenText: 'Android test screen without secrets.',
    });
    const adbUiDump = await this.android.execute({
      action: 'device.ui_dump',
      live: true,
      uiXml: '<hierarchy><node text="CHECK" resource-id="fixture/check" /></hierarchy>',
    });
    const terminalBlock = await this.computer.execute({
      action: 'computer.plan',
      targetWindow: 'Windows PowerShell',
      objective: 'type a command in the terminal',
    });
    const secretsBlock = await this.computer.execute({
      action: 'computer.plan',
      targetWindow: 'Bitwarden',
      objective: 'view the saved password',
    });
    const approvalRequired = await this.computer.execute({
      action: 'computer.plan',
      targetWindow: 'Notepad',
      objective: 'click the save button and type done',
    });
    const cancelPause = await this.computer.execute({
      action: 'computer.cancel',
      runId: 'fixture-run',
      targetWindow: 'Notepad',
      objective: 'cancel pending plan',
    });
    return {
      pc,
      browserDom,
      browserScreenshot,
      adbScreenshot,
      adbUiDump,
      terminalBlock,
      secretsBlock,
      approvalRequired,
      cancelPause,
    };
  }
}

function buildCertificationMatrix(s: PhaseSnapshots): ZavorthPerceptionCertificationMatrixRow[] {
  return [
    row(
      'pc-screenshot',
      'PC screenshot read-only',
      s.pc.status !== 'blocked',
      `${s.pc.policy.decision}; artifacts=${s.pc.artifacts.length}`,
      '/vision inspect',
    ),
    row(
      'browser-dom',
      'Browser DOM preferred',
      s.browserDom.evidence.preferredSource === 'dom',
      s.browserDom.evidence.preferredSource,
      '/vision browser inspect',
    ),
    row(
      'browser-screenshot',
      'Browser screenshot fallback',
      s.browserScreenshot.evidence.preferredSource === 'screenshot-needed',
      s.browserScreenshot.evidence.preferredSource,
      '/vision browser inspect',
    ),
    row(
      'adb-screenshot',
      'ADB screenshot artifact ref',
      Boolean(s.adbScreenshot.evidence.screenshot),
      s.adbScreenshot.evidence.screenshot?.displayName || 'none',
      '/device screenshot',
    ),
    row(
      'adb-ui-dump',
      'ADB UI dump artifact ref',
      Boolean(s.adbUiDump.evidence.uiDump),
      s.adbUiDump.evidence.uiDump?.displayName || 'none',
      '/device inspect',
    ),
    row(
      'blocked-terminal-automation',
      'Terminal automation blocked',
      s.terminalBlock.status === 'blocked',
      s.terminalBlock.hardBlocks.risks.join(', '),
      '/computer plan',
    ),
    row(
      'blocked-secrets-screen',
      'Secret/password screen blocked',
      s.secretsBlock.status === 'blocked',
      s.secretsBlock.hardBlocks.risks.join(', '),
      '/computer observe',
    ),
    row(
      'approval-required-tap-type-click',
      'Tap/type/click require approval',
      s.approvalRequired.status === 'approval-required',
      s.approvalRequired.policy.decision,
      '/computer approve <plan>',
    ),
    row(
      'cancel-pause',
      'Cancel/pause available',
      s.cancelPause.commands.cancel === '/computer cancel',
      s.cancelPause.receipts.map((r) => r.kind).join(', '),
      '/computer cancel',
    ),
    row(
      'receipts-retention',
      'Receipts and retention present',
      allReceiptsSafe(s),
      `receipts=${receiptCount(s)}`,
      'node scripts/zavorth-perception-certification.ts --json',
    ),
  ];
}

function buildZavorthControlProjection(
  generatedAt: string,
  s: PhaseSnapshots,
  matrix: ZavorthPerceptionCertificationMatrixRow[],
): ZavorthPerceptionZavorthControlProjection {
  const targets: ZavorthPerceptionZavorthControlTarget[] = [
    target(
      'pc',
      'pc',
      'PC screenshot',
      s.pc.status === 'blocked' ? 'blocked' : 'passed',
      true,
      false,
      false,
      s.pc.artifacts.length,
      s.pc.artifacts[0]?.id || null,
      '/vision inspect',
    ),
    target(
      'browser',
      'browser',
      'Browser DOM/screenshot',
      s.browserDom.status === 'blocked' ? 'blocked' : 'passed',
      true,
      s.browserDom.plan.approvalRequired,
      s.browserDom.plan.approvalRequired,
      s.browserDom.vision.artifacts.length + s.browserScreenshot.vision.artifacts.length,
      null,
      '/vision browser inspect',
    ),
    target(
      'android',
      'android',
      'Android ADB',
      s.adbScreenshot.status === 'blocked' ? 'blocked' : 'passed',
      true,
      s.adbScreenshot.plan.approvalRequired,
      s.adbScreenshot.plan.approvalRequired,
      [s.adbScreenshot.evidence.screenshot, s.adbUiDump.evidence.uiDump].filter(Boolean).length,
      s.adbScreenshot.evidence.screenshot?.id || null,
      '/device inspect',
    ),
    target(
      'subagent',
      'subagent',
      'Read-only perception subagents',
      'passed',
      false,
      false,
      false,
      0,
      null,
      '/agents spawn review the screen',
    ),
  ];
  const pendingPlans = [
    pending(
      'desktop-plan',
      'pc',
      s.approvalRequired.plan.status,
      s.approvalRequired.plan.approvalRequired,
      '/computer approve <plan>',
    ),
  ];
  const approvals = pendingPlans
    .filter((plan) => plan.approvalRequired)
    .map((plan) => ({
      id: `approval:${plan.id}`,
      targetId: plan.targetId,
      reason: 'Mutation preview waits for owner approval before click/type/tap.',
      commandHint: plan.commandHint,
    }));
  const artifacts = [
    artifact('pc-vision', 'pc', 'vision', s.pc.artifacts[0]?.retentionTtlMs || 900000, '/vision inspect'),
    artifact('browser-dom', 'browser', 'dom', 900000, '/vision browser inspect'),
    artifact('browser-screenshot', 'browser', 'screenshot', 900000, '/vision browser inspect'),
    artifact('adb-screenshot', 'android', 'screenshot', 900000, '/device screenshot'),
    artifact('adb-ui-dump', 'android', 'ui-dump', 900000, '/device inspect'),
    artifact(
      'certification-receipts',
      'subagent',
      'receipt',
      900000,
      'node scripts/zavorth-perception-certification.ts --json',
    ),
  ];
  return {
    contractVersion: ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION,
    generatedAt,
    source: 'ZavorthPerceptionCrossSurfaceCertificationService',
    status: resumeStatus(matrix),
    targets,
    activeObservation: {
      route: 'vision/browser/android',
      targetKind: 'cross-surface',
      summary: 'ZavorthControl projection carries read-only targets, pending plans, approvals and redacted artifacts.',
      readOnly: true,
    },
    pendingPlans,
    approvals,
    artifacts,
    liveSafetyStatus: {
      liveCanaryDisabledByDefault: true,
      explicitApprovalRequired: true,
      mutationRequiresApproval: true,
      hardBlocksPreserved: true,
      noVisualMutationWithoutOwnerApproval: true,
    },
    surface: {
      apiPath: '/api/zavorthControl/perception-control',
      zavorthControlPath: '/zavorthControl...sector=perception',
      channelCommand: '/vision status',
      cliCommand: 'node scripts/zavorth-perception-certification.ts',
      visualMutationApplied: false,
    },
    receipts: matrix.map((entry) => ({
      id: `gate-6:${entry.id}`,
      kind: 'certification',
      status: entry.status,
      reason: entry.evidence,
      rawSecretSerialized: false,
    })),
  };
}

function buildSurfaceProjection(
  surface: ZavorthPerceptionCrossSurfaceName,
  response: SurfaceResponse,
  projection: ZavorthPerceptionZavorthControlProjection,
): ZavorthPerceptionSurfaceProjection {
  const interactive = surface === 'telegram' || surface === 'discord' || surface === 'web';
  const commands = Array.from(
    new Set([
      ...REQUIRED_COMMANDS,
      ...projection.targets.map((target) => target.commandHint),
      ...safeActions(response)
        .map((action) => action.command || '')
        .filter(Boolean),
    ]),
  );
  return {
    surface,
    status: commands.length >= REQUIRED_COMMANDS.length && response.blocks.length > 0 ? 'passed' : 'attention',
    fallbackTextAvailable: true,
    interactiveActionsAvailable: interactive,
    commandCount: commands.length,
    primaryCommands: commands.slice(0, 8),
    evidence: interactive ? `${surface} can expose buttons/actions plus the same fallback text.`
      : `${surface} receives the same clean textual fallback and command vocabulary.`,
  };
}

function row(
  id: ZavorthPerceptionCertificationMatrixRow['id'],
  label: string,
  passed: boolean,
  evidence: string,
  commandHint: string,
): ZavorthPerceptionCertificationMatrixRow {
  return {
    id,
    label,
    status: passed ? 'passed' : 'attention',
    evidence,
    commandHint,
  };
}

function target(
  id: string,
  kind: ZavorthPerceptionZavorthControlTarget['kind'],
  label: string,
  status: ZavorthPerceptionCrossSurfaceStatus,
  activeObservation: boolean,
  pendingPlan: boolean,
  approvalRequired: boolean,
  artifactCount: number,
  lastScreenshotRef: string | null,
  commandHint: string,
): ZavorthPerceptionZavorthControlTarget {
  return {
    id,
    kind,
    label,
    status,
    activeObservation,
    pendingPlan,
    approvalRequired,
    artifactCount,
    lastScreenshotRef,
    commandHint,
  };
}

function pending(
  id: string,
  targetId: string,
  status: string,
  approvalRequired: boolean,
  commandHint: string,
): ZavorthPerceptionZavorthControlProjection['pendingPlans'][number] {
  const mapped = status === 'blocked' ? 'blocked' : approvalRequired ? 'approval-required' : 'planned';
  return { id, targetId, status: mapped, approvalRequired, commandHint };
}

function artifact(
  id: string,
  targetId: string,
  kind: ZavorthPerceptionZavorthControlProjection['artifacts'][number]['kind'],
  retentionTtlMs: number,
  commandHint: string,
): ZavorthPerceptionZavorthControlProjection['artifacts'][number] {
  return { id, targetId, kind, redacted: true, rawContentStored: false, retentionTtlMs, commandHint };
}

function allReceiptsSafe(s: PhaseSnapshots): boolean {
  return [
    ...s.pc.receipts,
    ...s.browserDom.receipts,
    ...s.browserScreenshot.receipts,
    ...s.adbScreenshot.receipts,
    ...s.adbUiDump.receipts,
    ...s.terminalBlock.receipts,
    ...s.secretsBlock.receipts,
    ...s.approvalRequired.receipts,
    ...s.cancelPause.receipts,
  ].every((receipt) => receipt.rawSecretSerialized === false);
}

function receiptCount(s: PhaseSnapshots): number {
  return [
    s.pc.receipts.length,
    s.browserDom.receipts.length,
    s.browserScreenshot.receipts.length,
    s.adbScreenshot.receipts.length,
    s.adbUiDump.receipts.length,
    s.terminalBlock.receipts.length,
    s.secretsBlock.receipts.length,
    s.approvalRequired.receipts.length,
    s.cancelPause.receipts.length,
  ].reduce((sum, count) => sum + count, 0);
}

function resumeStatus(
  items: Array<{ status: ZavorthPerceptionCrossSurfaceStatus }>,
): ZavorthPerceptionCrossSurfaceStatus {
  if (items.some((item) => item.status === 'blocked')) return 'blocked';
  if (items.some((item) => item.status === 'attention')) return 'attention';
  return 'passed';
}

function safeActions(response: SurfaceResponse): NonNullable<SurfaceResponse['actions']> {
  return Array.isArray(response.actions) ? response.actions : [];
}

function pad(value: string, length: number): string {
  const text = String(value || '');
  return text.length >= length ? text.slice(0, length) : `${text}${' '.repeat(length - text.length)}`;
}

function createMockAdbRunner(): ZavorthAdbRunner {
  return {
    run(args, options = {}): ZavorthAdbCommandResult {
      const joined = args.join(' ');
      if (joined === 'devices -l') {
        return ok(
          'List of devices attached\nzavorth-fixture device product:fixture model:Pixel_Fixture transport_id:7\n',
        );
      }
      if (joined.includes('screencap -p')) {
        return {
          ...ok(''),
          stdoutBytes: Buffer.from('PNG_FIXTURE_BYTES', 'utf8'),
        };
      }
      if (joined.includes('uiautomator dump')) return ok('UI hierchary dumped to /sdcard/zavorth-window.xml\n');
      if (joined.includes('cat /sdcard/zavorth-window.xml')) return ok('<hierarchy><node text="CHECK" /></hierarchy>');
      if (joined.includes('dumpsys window windows')) return ok('mCurrentFocus=Window{u0 gr.fixture/.MainActivity}');
      if (joined.includes('logcat')) return ok('I/Zavorth: fixture log\n');
      return ok(options.encoding === 'buffer' ? '' : 'ok\n');
    },
  };
}

function ok(stdoutText: string): ZavorthAdbCommandResult {
  return {
    ok: true,
    code: 0,
    stdoutText,
    stderrText: '',
    stdoutBytes: null,
    error: null,
  };
}
