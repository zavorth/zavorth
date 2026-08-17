import {
  ZAVORTH_ANDROID_ADB_BRIDGE_CONTRACT_VERSION,
  type ZavorthAndroidAdbAction,
  type ZavorthAndroidAdbArtifactRef,
  type ZavorthAndroidAdbInput,
  type ZavorthAndroidAdbPlanStep,
  type ZavorthAndroidAdbPlanStepKind,
  type ZavorthAndroidAdbReceipt,
  type ZavorthAndroidAdbRiskKind,
  type ZavorthAndroidAdbSnapshot,
  type ZavorthAndroidAdbStatus,
  type ZavorthAndroidDeviceInfo,
  type ZavorthAndroidDeviceState,
} from '../contracts/ZavorthAndroidAdbBridgeContract.js';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  createSurfaceResponse,
  type SurfaceReceiptStatus,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../domain/surface/application/surface-response/index.js';

import type { ZavorthVisionPolicyDecision } from '../contracts/ZavorthVisionControlPlaneContract.js';
import { ZavorthVisionControlPlaneService } from './ZavorthVisionControlPlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type ZavorthAdbRunOptions = {
  binary?: string;
  timeoutMs?: number;
  encoding?: 'utf8' | 'buffer';
};

export type ZavorthAdbCommandResult = {
  ok: boolean;
  code: number | null;
  stdoutText: string;
  stderrText: string;
  stdoutBytes: Buffer | null;
  error: string | null;
};

export type ZavorthAdbRunner = {
  run(args: string[], options?: ZavorthAdbRunOptions): Promise<ZavorthAdbCommandResult> | ZavorthAdbCommandResult;
};

type AndroidAdbBridgeDeps = {
  runner?: ZavorthAdbRunner | null;
  vision?: ZavorthVisionControlPlaneService;
  adbBinary?: string;
  artifactRoot?: string;
};

type AdbDiscovery = {
  available: boolean;
  devices: ZavorthAndroidDeviceInfo[];
  selected: ZavorthAndroidDeviceInfo | null;
  error: string | null;
  readOnlyCommandsExecuted: number;
};

type EvidenceBundle = {
  screenText: string | null;
  uiXml: string | null;
  logcatText: string | null;
  currentActivity: string | null;
  screenshot: ZavorthAndroidAdbArtifactRef | null;
  uiDump: ZavorthAndroidAdbArtifactRef | null;
  logcat: ZavorthAndroidAdbArtifactRef | null;
  readOnlyCommandsExecuted: number;
  errors: string[];
};

type HardBlockResult = {
  matched: boolean;
  risks: ZavorthAndroidAdbRiskKind[];
  reason: string | null;
};

const DEFAULT_LOG_LINES = 160;
const DEFAULT_TIMEOUT_MS = 3500;
const MUTATING_STEP_KINDS = new Set<ZavorthAndroidAdbPlanStepKind>([
  'tap',
  'swipe',
  'type-text',
  'keyevent',
  'start-intent',
  'install',
  'uninstall',
]);

const SENSITIVE_RULES: Array<{
  risk: ZavorthAndroidAdbRiskKind;
  pattern: RegExp;
  reason: string;
}> = [
  {
    risk: 'credential-or-mfa-screen',
    pattern: /\b(password|mfa|2fa|otp|authenticator|passkey|webauthn|captcha|login approval)\b/i,
    reason: 'Credential, MFA, passkey and CAPTCHA screens are blocked for device control.',
  },
  {
    risk: 'banking-or-payment',
    pattern: /\b(bank|banco|pix|pagamento|payment|checkout|cartao|credit card|boleto|paypal|stripe)\b/i,
    reason: 'Banking, checkout and payment screens are blocked.',
  },
  {
    risk: 'wallet-or-seed',
    pattern: /\b(seed phrase|wallet|metamask|ledger|trezor|private key)\b/i,
    reason: 'Wallet, seed phrase and private key screens are blocked.',
  },
  {
    risk: 'destructive-adb',
    pattern: /\b(factory reset|wipe|fastboot|reboot bootloader|root|su\b|rm -rf|delete data|clear data|pm clear|settings put|grant permission|revoke permission)\b/i,
    reason: 'Destructive or privilege-changing ADB operations are blocked.',
  },
  {
    risk: 'install-uninstall',
    pattern: /\b(install|uninstall|pm install|pm uninstall|adb install|adb uninstall|instalar|desinstalar)\b/i,
    reason: 'ADB install and uninstall are blocked by default and require a later admin policy.',
  },
];

export class ZavorthAndroidAdbBridgeService {
  private readonly runner: ZavorthAdbRunner;
  private readonly vision: ZavorthVisionControlPlaneService;
  private readonly adbBinary: string;
  private readonly artifactRoot: string;

  constructor(deps: AndroidAdbBridgeDeps = {}) {
    this.runner = deps.runner === undefined || deps.runner === null ? new LocalAdbRunner() : deps.runner;
    this.vision = deps.vision || new ZavorthVisionControlPlaneService();
    this.adbBinary = String(deps.adbBinary || 'adb').trim() || 'adb';
    this.artifactRoot = deps.artifactRoot || path.join(process.cwd(), '.tmp', 'android-adb-artifacts');
  }

  public async execute(input: ZavorthAndroidAdbInput = {}): Promise<ZavorthAndroidAdbSnapshot> {
    const action = normalizeAction(input.action);
    const sourceSurface = String(input.sourceSurface || 'shared-surface').trim() || 'shared-surface';
    const artifactRoot = input.artifactRoot || this.artifactRoot;
    const shouldProbe = input.live === true || action === 'device.status' || action === 'device.list' || action === 'device.doctor';
    const discovery = shouldProbe
      ? await this.discoverDevices(input.deviceSerial || null)
      : emptyDiscovery();
    const evidence = await this.collectEvidence(action, input, discovery, artifactRoot);
    const hardBlocks = detectHardBlocks(input, evidence);
    const steps = buildPlanSteps(action, input);
    const mutationRequested = steps.some((step) => step.mutation);
    const blockedByDefault = steps.some((step) => step.blockedByDefault);
    const approvalRequired = mutationRequested && !input.approvalId && !blockedByDefault;
    const receipts = this.buildReceipts({
      action,
      input,
      discovery,
      evidence,
      hardBlocks,
      steps,
      approvalRequired,
      blockedByDefault,
    });

    const status = resolveStatus({
      action,
      input,
      discovery,
      hardBlocks,
      mutationRequested,
      approvalRequired,
      blockedByDefault,
      evidence,
    });

    return this.buildSnapshot({
      input,
      action,
      sourceSurface,
      discovery,
      evidence,
      hardBlocks,
      steps,
      approvalRequired,
      mutationRequested,
      blockedByDefault,
      status,
      receipts,
    });
  }

  public buildSurfaceResponse(snapshot: ZavorthAndroidAdbSnapshot): SurfaceResponse {
    const receipts = snapshot.receipts.map((entry) => ({
      id: entry.id,
      title: entry.kind,
      status: mapReceiptStatus(entry.status),
      reason: entry.reason,
      policyProfile: snapshot.policy.profile,
      redacted: snapshot.vision.redaction.applied,
      riskBlocked: entry.status === 'blocked' || entry.status === 'deny',
      createdAt: snapshot.generatedAt,
      metadata: {
        rawSecretSerialized: entry.rawSecretSerialized,
      },
    }));
    return createSurfaceResponse({
      id: `zavorth-device-${safeId(snapshot.action)}-${safeId(snapshot.generatedAt)}`,
      intent: 'status',
      title: 'Android ADB Device Bridge',
      summary: `${snapshot.status}: ${snapshot.policy.reason}`,
      tone: snapshot.status === 'blocked' || snapshot.status === 'adb-unavailable' || snapshot.status === 'unauthorized'
        ? 'danger'
        : snapshot.status === 'approval-required' || snapshot.status === 'attention' || snapshot.status === 'redacted' || snapshot.status === 'no-device'
          ? 'warning'
          : 'success',
      blocks: [
        {
          kind: 'text',
          title: 'Governed device',
          text: this.formatSnapshotText(snapshot),
        },
        {
          kind: 'table',
          table: {
            title: 'Doctor',
            columns: [
              { key: 'item', label: 'Item', width: 26 },
              { key: 'value', label: 'Value', width: 48 },
            ],
            rows: [
              { item: 'adb', value: snapshot.doctor.adbAvailable ? 'available' : 'unavailable' },
              { item: 'device', value: snapshot.doctor.deviceConnected ? 'connected' : 'missing' },
              { item: 'authorization', value: snapshot.doctor.authorization },
              { item: 'screen', value: snapshot.doctor.screenReadable ? 'readable' : snapshot.device.screenState },
              { item: 'activity', value: snapshot.evidence.currentActivity || 'n/d' },
            ],
          },
        },
        ...buildAndroidSetupBlocks(snapshot),
        {
          kind: 'list',
          title: 'Plan',
          items: snapshot.plan.steps.length > 0
            ? snapshot.plan.steps.map((step) => `${step.kind}: ${step.label} | approval=${step.requiresApproval ? 'yes' : 'no'} | blocked=${step.blockedByDefault ? 'yes' : 'no'}`)
            : ['No active plan. Use /device inspect, /device screenshot, or /device plan.'],
        },
        ...receipts.map((entry) => ({
          kind: 'receipt' as const,
          receipt: entry,
        })),
      ],
      actions: this.buildActions(snapshot),
      receipts,
      metadata: {
        source: snapshot.source,
        action: snapshot.action,
        status: snapshot.status,
        selectedSerial: snapshot.device.selectedSerial,
        mutationRequested: snapshot.plan.mutationRequested,
        liveMutationPerformed: snapshot.safety.liveMutationPerformed,
        setupRequired: ['adb-unavailable', 'no-device', 'unauthorized'].includes(snapshot.status),
      },
    });
  }

  public formatSnapshotText(snapshot: ZavorthAndroidAdbSnapshot): string {
    return [
      'Android ADB Device Bridge',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `ADB: ${snapshot.adb.available ? 'available' : 'unavailable'} (${snapshot.adb.binary})`,
      `Device: ${snapshot.device.selectedSerial || 'n/d'} | state=${snapshot.device.state}`,
      `Policy: ${snapshot.policy.decision}`,
      `Hard blocks: ${snapshot.hardBlocks.matched ? snapshot.hardBlocks.risks.join(', ') : 'none'}`,
      `Artifacts: screenshot=${snapshot.evidence.screenshot?.path || 'none'} ui=${snapshot.evidence.uiDump?.path || 'none'} logcat=${snapshot.evidence.logcat?.path || 'none'}`,
      '',
      'Safety:',
      '- read-only ADB only without approval',
      '- tap, swipe, text input, keyevent and intent require approval',
      '- install/uninstall blocked by default',
      '- destructive ADB blocked',
      '- screenshot artifact refs only; no raw image serialization',
      '- UI dump and logcat are filtered/redacted',
      '',
      'Plan:',
      ...(snapshot.plan.steps.length > 0
        ? snapshot.plan.steps.map((step) => `- ${step.kind}: ${step.label} | approval=${step.requiresApproval ? 'yes' : 'no'} | blocked=${step.blockedByDefault ? 'yes' : 'no'}`)
        : ['- none']),
      '',
      'Commands:',
      `- ${snapshot.commands.status}`,
      `- ${snapshot.commands.doctor}`,
      `- ${snapshot.commands.screenshot}`,
      `- ${snapshot.commands.inspect}`,
      `- ${snapshot.commands.plan}`,
      `- ${snapshot.commands.approve}`,
      `- ${snapshot.commands.cancel}`,
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private async discoverDevices(deviceSerial: string | null): Promise<AdbDiscovery> {
    const result = await this.safeRun(['devices', '-l'], { timeoutMs: DEFAULT_TIMEOUT_MS });
    if (!result.ok) {
      return {
        available: false,
        devices: [],
        selected: null,
        error: result.error || result.stderrText || 'adb devices -l failed or adb is unavailable.',
        readOnlyCommandsExecuted: 1,
      };
    }
    const devices = parseDevices(result.stdoutText, deviceSerial);
    const selected = selectDevice(devices, deviceSerial);
    return {
      available: true,
      devices,
      selected,
      error: null,
      readOnlyCommandsExecuted: 1,
    };
  }

  private async collectEvidence(
    action: ZavorthAndroidAdbAction,
    input: ZavorthAndroidAdbInput,
    discovery: AdbDiscovery,
    artifactRoot: string,
  ): Promise<EvidenceBundle> {
    const evidence: EvidenceBundle = {
      screenText: input.screenText || null,
      uiXml: input.uiXml || null,
      logcatText: filterLogcat(input.logcatText || '', input.maxLogLines || DEFAULT_LOG_LINES) || null,
      currentActivity: input.activityName || null,
      screenshot: null,
      uiDump: null,
      logcat: null,
      readOnlyCommandsExecuted: 0,
      errors: [],
    };
    if (!input.live || !discovery.available || !discovery.selected || discovery.selected.state !== 'authorized') {
      return evidence;
    }

    const serialArgs = ['-s', discovery.selected.serial];
    if (action === 'device.observe' || action === 'device.screenshot') {
      const screenshot = await this.safeRun([...serialArgs, 'exec-out', 'screencap', '-p'], {
        timeoutMs: DEFAULT_TIMEOUT_MS,
        encoding: 'buffer',
      });
      evidence.readOnlyCommandsExecuted += 1;
      if (screenshot.ok && screenshot.stdoutBytes && screenshot.stdoutBytes.length > 0) {
        evidence.screenshot = writeArtifact(artifactRoot, 'screenshot', 'png', screenshot.stdoutBytes, 'image/png');
      } else if (screenshot.error || screenshot.stderrText) {
        evidence.errors.push(screenshot.error || screenshot.stderrText);
      }
    }

    if (action === 'device.observe' || action === 'device.ui_dump') {
      const dump = await this.safeRun([...serialArgs, 'shell', 'uiautomator', 'dump', '/sdcard/zavorth-window.xml']);
      evidence.readOnlyCommandsExecuted += 1;
      if (!dump.ok && (dump.error || dump.stderrText)) {
        evidence.errors.push(dump.error || dump.stderrText);
      }
      const cat = await this.safeRun([...serialArgs, 'shell', 'cat', '/sdcard/zavorth-window.xml']);
      evidence.readOnlyCommandsExecuted += 1;
      if (cat.ok && cat.stdoutText.trim()) {
        evidence.uiXml = cat.stdoutText;
        evidence.uiDump = writeArtifact(artifactRoot, 'ui-dump', 'xml', Buffer.from(cat.stdoutText, 'utf8'), 'application/xml');
      } else if (cat.error || cat.stderrText) {
        evidence.errors.push(cat.error || cat.stderrText);
      }
    }

    if (action === 'device.observe' || action === 'device.doctor') {
      const activity = await this.safeRun([...serialArgs, 'shell', 'dumpsys', 'window', 'windows']);
      evidence.readOnlyCommandsExecuted += 1;
      if (activity.ok) {
        evidence.currentActivity = extractCurrentActivity(activity.stdoutText) || evidence.currentActivity;
      }
    }

    if (action === 'device.logcat') {
      const logcat = await this.safeRun([...serialArgs, 'logcat', '-d', '-t', String(input.maxLogLines || DEFAULT_LOG_LINES)]);
      evidence.readOnlyCommandsExecuted += 1;
      if (logcat.ok && logcat.stdoutText.trim()) {
        evidence.logcatText = filterLogcat(logcat.stdoutText, input.maxLogLines || DEFAULT_LOG_LINES);
        evidence.logcat = writeArtifact(artifactRoot, 'logcat', 'txt', Buffer.from(evidence.logcatText || '', 'utf8'), 'text/plain');
      } else if (logcat.error || logcat.stderrText) {
        evidence.errors.push(logcat.error || logcat.stderrText);
      }
    }

    return evidence;
  }

  private async safeRun(args: string[], options: ZavorthAdbRunOptions = {}): Promise<ZavorthAdbCommandResult> {
    try {
      return await this.runner.run(args, {
        binary: this.adbBinary,
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        encoding: options.encoding || 'utf8',
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Android Adb Bridge] string operation failed', error);
    return {
        ok: false,
        code: null,
        stdoutText: '',
        stderrText: '',
        stdoutBytes: null,
        error: error instanceof Error ? err.message : String(error),
      };
  }
  }

  private buildSnapshot(input: {
    input: ZavorthAndroidAdbInput;
    action: ZavorthAndroidAdbAction;
    sourceSurface: string;
    discovery: AdbDiscovery;
    evidence: EvidenceBundle;
    hardBlocks: HardBlockResult;
    steps: ZavorthAndroidAdbPlanStep[];
    approvalRequired: boolean;
    mutationRequested: boolean;
    blockedByDefault: boolean;
    status: ZavorthAndroidAdbStatus;
    receipts: ZavorthAndroidAdbReceipt[];
  }): ZavorthAndroidAdbSnapshot {
    const evidenceText = joinEvidence(input.input, input.evidence);
    const vision = this.vision.buildSnapshot({
      action: 'vision.inspect',
      targetKind: 'android',
      targetRef: input.discovery.selected?.serial || input.input.deviceSerial || 'android-device',
      sourceSurface: input.sourceSurface,
      actorId: input.input.actorId,
      observationText: evidenceText || 'Android ADB bridge has no live visual evidence yet.',
      requestedByNaturalLanguage: Boolean(input.input.objective),
      retentionTtlMs: 15 * 60 * 1000,
    });
    const status = input.status === 'ready' && vision.status === 'redacted' ? 'redacted' : input.status;
    const decision = resolvePolicyDecision(status, input.hardBlocks, input.mutationRequested, input.approvalRequired, input.blockedByDefault, vision.policy.decision);
    const planId = input.steps.length > 0 ? input.input.planId || makePlanId(input.input, input.steps) : input.input.planId || null;
    const policyReason = resolvePolicyReason(status, input.hardBlocks, input.mutationRequested, input.approvalRequired, input.blockedByDefault, input.discovery);
    const selected = input.discovery.selected;
    return {
      contractVersion: ZAVORTH_ANDROID_ADB_BRIDGE_CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'ZavorthAndroidAdbBridgeService',
      status,
      action: input.action,
      adb: {
        binary: this.adbBinary,
        available: input.discovery.available,
        liveRequested: input.input.live === true,
        readOnlyCommandsExecuted: input.discovery.readOnlyCommandsExecuted + input.evidence.readOnlyCommandsExecuted,
        mutationCommandsExecuted: 0,
        lastError: input.discovery.error || input.evidence.errors[0] || null,
      },
      device: {
        selectedSerial: selected?.serial || input.input.deviceSerial || null,
        state: selected?.state || (input.input.deviceSerial ? 'unknown' : 'unknown'),
        connected: Boolean(selected),
        authorized: selected?.state === 'authorized',
        devices: input.discovery.devices,
        packageName: input.input.packageName || null,
        activityName: input.evidence.currentActivity || input.input.activityName || null,
        screenState: inferScreenState(input),
      },
      doctor: {
        adbAvailable: input.discovery.available,
        deviceConnected: Boolean(selected),
        authorization: selected?.state === 'authorized'
          ? 'authorized'
          : selected?.state === 'unauthorized'
            ? 'unauthorized'
            : selected ? 'unknown'
              : 'missing',
        screenReadable: Boolean(input.evidence.screenText || input.evidence.uiXml || input.evidence.screenshot),
        packageVisible: Boolean(input.input.packageName || input.evidence.currentActivity),
        activityVisible: Boolean(input.evidence.currentActivity || input.input.activityName),
      },
      evidence: {
        screenshot: input.evidence.screenshot,
        uiDump: input.evidence.uiDump,
        logcat: input.evidence.logcat,
        currentActivity: input.evidence.currentActivity || input.input.activityName || null,
        preferredSource: preferredSource(input.evidence),
        redactionCount: vision.redaction.count,
      },
      plan: {
        id: planId,
        status: resolvePlanStatus(input.action, input.steps, input.hardBlocks, input.approvalRequired, input.blockedByDefault, input.input.approvalId),
        steps: input.steps,
        mutationRequested: input.mutationRequested,
        approvalRequired: input.approvalRequired,
        approvalId: input.input.approvalId || null,
      },
      policy: {
        decision,
        profile: 'android-adb-gate-4',
        reason: policyReason,
        mutationAllowed: false,
        providerPayloadMinimized: true,
      },
      hardBlocks: input.hardBlocks,
      safety: {
        readOnlyAdbOnlyWithoutApproval: true,
        tapSwipeTextKeyRequireApproval: true,
        intentRequiresApproval: true,
        installUninstallBlockedByDefault: true,
        destructiveAdbBlocked: true,
        screenshotArtifactRefOnly: true,
        uiDumpRedacted: true,
        logcatFilteredRedacted: true,
        noRawImageSerialized: true,
        rawSecretSerialized: false,
        liveMutationPerformed: false,
      },
      vision,
      receipts: [
        receipt('policy', decision, policyReason),
        receipt('vision', vision.policy.decision, 'Android evidence was minimized through Vision Control Plane.'),
        ...input.receipts,
      ],
      commands: {
        status: '/device status',
        doctor: '/device android doctor',
        screenshot: '/device screenshot',
        inspect: '/device inspect',
        plan: '/device plan',
        approve: '/device approve <plan>',
        cancel: '/device cancel',
        nextAction: 'Credential vault - Natural Agent Use And Subagent Perception',
      },
      nextSafeAction: nextSafeAction(status, input),
    };
  }

  private buildReceipts(input: {
    action: ZavorthAndroidAdbAction;
    input: ZavorthAndroidAdbInput;
    discovery: AdbDiscovery;
    evidence: EvidenceBundle;
    hardBlocks: HardBlockResult;
    steps: ZavorthAndroidAdbPlanStep[];
    approvalRequired: boolean;
    blockedByDefault: boolean;
  }): ZavorthAndroidAdbReceipt[] {
    const receipts: ZavorthAndroidAdbReceipt[] = [];
    receipts.push(receipt('adb', input.discovery.available ? 'done' : 'attention', input.discovery.available ? 'adb devices -l completed.' : input.discovery.error || 'ADB is unavailable.'));
    if (input.discovery.selected) {
      receipts.push(receipt('device', input.discovery.selected.state === 'authorized' ? 'done' : 'attention', `Device ${input.discovery.selected.serial} is ${input.discovery.selected.state}.`));
    }
    if (input.evidence.screenshot || input.evidence.uiDump || input.evidence.logcat) {
      receipts.push(receipt('artifact', 'done', 'Android evidence was stored as artifact references only.'));
    }
    if (input.steps.length > 0) {
      receipts.push(receipt(
        'plan',
        input.blockedByDefault || input.hardBlocks.matched ? 'blocked' : input.approvalRequired ? 'approval-required' : 'done',
        input.blockedByDefault ? 'Install/uninstall or destructive ADB plans are blocked by default.'
          : input.approvalRequired ? 'Device tap, swipe, text, keyevent and intent plans require owner approval.'
            : 'Read-only Android plan is ready.',
      ));
    }
    if (input.action === 'device.approve' && input.input.approvalId) {
      receipts.push(receipt('approval', 'done', 'Approval reference accepted for preview; live mutation remains disabled in Connector registry.'));
    }
    if (input.action === 'device.cancel') {
      receipts.push(receipt('cancel', 'done', 'Device bridge cancel is represented as a safe preview; no mutation command was running.'));
    }
    if (input.hardBlocks.matched) {
      receipts.push(receipt('block', 'blocked', input.hardBlocks.reason || 'Device request blocked by hard safety policy.'));
    }
    return receipts;
  }

  private buildActions(snapshot: ZavorthAndroidAdbSnapshot): SurfaceResponseAction[] {
    const actions: SurfaceResponseAction[] = [
      commandAction('device-status', 'Status', snapshot.commands.status, 'primary'),
      commandAction('device-doctor', 'Doctor', snapshot.commands.doctor, 'secondary'),
      commandAction('device-screenshot', 'Screenshot', snapshot.commands.screenshot, 'secondary'),
      commandAction('device-inspect', 'Inspect', snapshot.commands.inspect, 'secondary'),
      commandAction('device-plan', 'Plan', snapshot.commands.plan, 'secondary'),
      {
        ...commandAction('device-approve', 'Approve', snapshot.plan.id ? `/device approve ${snapshot.plan.id}` : snapshot.commands.approve, 'success'),
        confirmationRequired: true,
        disabled: !snapshot.plan.id || snapshot.status === 'blocked',
      },
      commandAction('device-cancel', 'Cancel', snapshot.commands.cancel, 'danger'),
    ];
    if (['adb-unavailable', 'no-device', 'unauthorized'].includes(snapshot.status)) {
      actions.push(
        commandAction('device-doctor-again', 'Revalidar USB', '/device android doctor', 'primary'),
        commandAction('device-inspect-after-setup', 'try de novo', '/device inspect', 'secondary'),
      );
    }
    return actions;
  }
}

function buildAndroidSetupBlocks(snapshot: ZavorthAndroidAdbSnapshot): SurfaceResponse['blocks'] {
  if (!['adb-unavailable', 'no-device', 'unauthorized'].includes(snapshot.status)) {
    return [];
  }
  const items =
    snapshot.status === 'adb-unavailable'
      ? [
          'The natural request already tried to use read-only ADB.',
          'ADB is not available on this host.',
          'Install Android Platform Tools or put adb on PATH.',
          'Then run: /device android doctor',
        ]
      : snapshot.status === 'unauthorized'
        ? [
            'The phone was found, but ADB is not authorized yet.',
            'Unlock Android and accept the "Allow USB debugging" prompt.',
            'Then run: /device android doctor',
          ]
        : [
            'The natural request already tried to find an authorized Android device.',
            'Connect the phone over USB.',
            'Enable Developer Options and USB Debugging.',
            'Aceite o prompt de authorization ADB no celular.',
            'after run: /device android doctor',
          ];
  return [
    {
      kind: 'list',
      title: 'Enable connected phone',
      tone: 'warning',
      items: [
        ...items,
        'When ready, "look at my phone" uses screenshot/UI dump read-only automatically.',
      ],
    },
  ];
}

class LocalAdbRunner implements ZavorthAdbRunner {
  public run(args: string[], options: ZavorthAdbRunOptions = {}): ZavorthAdbCommandResult {
    const binary = options.binary || 'adb';
    const encoding = options.encoding === 'buffer' ? 'buffer' : 'utf8';
    const result = spawnSync(binary, args, {
      encoding,
      timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    const stdoutBytes = Buffer.isBuffer(result.stdout) ? result.stdout : null;
    const stdoutText = Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : String(result.stdout || '');
    const stderrText = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr || '');
    return {
      ok: !result.error && result.status === 0,
      code: result.status,
      stdoutText,
      stderrText,
      stdoutBytes,
      error: result.error ? result.error.message : null,
    };
  }
}

function normalizeAction(value: unknown): ZavorthAndroidAdbAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'list' || normalized === 'devices' || normalized === 'device.list') return 'device.list';
  if (normalized === 'doctor' || normalized === 'android doctor' || normalized === 'device.doctor') return 'device.doctor';
  if (normalized === 'observe' || normalized === 'inspect' || normalized === 'device.observe' || normalized === 'device.inspect') return 'device.observe';
  if (normalized === 'screenshot' || normalized === 'capture' || normalized === 'device.screenshot') return 'device.screenshot';
  if (normalized === 'ui_dump' || normalized === 'uidump' || normalized === 'dump' || normalized === 'device.ui_dump') return 'device.ui_dump';
  if (normalized === 'logcat' || normalized === 'logs' || normalized === 'device.logcat') return 'device.logcat';
  if (normalized === 'plan' || normalized === 'device.plan') return 'device.plan';
  if (normalized === 'approve' || normalized === 'device.approve') return 'device.approve';
  if (normalized === 'cancel' || normalized === 'stop' || normalized === 'device.cancel') return 'device.cancel';
  return 'device.status';
}

function emptyDiscovery(): AdbDiscovery {
  return {
    available: true,
    devices: [],
    selected: null,
    error: null,
    readOnlyCommandsExecuted: 0,
  };
}

function parseDevices(value: string, selectedSerial: string | null): ZavorthAndroidDeviceInfo[] {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^list of devices/i.test(line))
    .map((line) => {
      const [serial = '', stateRaw = '', ...rest] = line.split(/\s+/);
      const details = rest.join(' ');
      return {
        serial,
        state: normalizeDeviceState(stateRaw),
        model: details.match(/\bmodel:([^\s]+)/)?.[1] || null,
        product: details.match(/\bproduct:([^\s]+)/)?.[1] || null,
        transportId: details.match(/\btransport_id:([^\s]+)/)?.[1] || null,
        selected: selectedSerial ? serial === selectedSerial : false,
      };
    })
    .filter((entry) => entry.serial.length > 0);
}

function normalizeDeviceState(value: string): ZavorthAndroidDeviceState {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'device') return 'authorized';
  if (normalized === 'unauthorized') return 'unauthorized';
  if (normalized === 'offline') return 'offline';
  return 'unknown';
}

function selectDevice(devices: ZavorthAndroidDeviceInfo[], selectedSerial: string | null): ZavorthAndroidDeviceInfo | null {
  const selected = selectedSerial
    ? devices.find((device) => device.serial === selectedSerial) || null
    : devices.find((device) => device.state === 'authorized') || devices[0] || null;
  if (!selected) return null;
  return {
    ...selected,
    selected: true,
  };
}

function buildPlanSteps(action: ZavorthAndroidAdbAction, input: ZavorthAndroidAdbInput): ZavorthAndroidAdbPlanStep[] {
  const steps: ZavorthAndroidAdbPlanStep[] = [];
  if (action === 'device.cancel') {
    steps.push(planStep('cancel', 'Cancel current device bridge preview', [], null, null));
    return steps;
  }
  if (['device.observe', 'device.screenshot', 'device.ui_dump', 'device.logcat', 'device.doctor'].includes(action)) {
    if (action === 'device.observe' || action === 'device.doctor') steps.push(planStep('read-current-activity', 'Read current foreground activity', ['shell', 'dumpsys', 'window', 'windows'], null, null));
    if (action === 'device.observe' || action === 'device.screenshot') steps.push(planStep('capture-screenshot', 'Capture screenshot as artifact reference', ['exec-out', 'screencap', '-p'], null, null));
    if (action === 'device.observe' || action === 'device.ui_dump') steps.push(planStep('dump-ui', 'Dump Android UI XML as redacted artifact', ['shell', 'uiautomator', 'dump'], null, null));
    if (action === 'device.logcat') steps.push(planStep('read-logcat', 'Read filtered logcat tail', ['logcat', '-d', '-t'], null, null));
    return steps;
  }
  if (action !== 'device.plan' && action !== 'device.approve') {
    return steps;
  }
  if (input.targetText) {
    steps.push(planStep('tap', 'Tap approved visible coordinate or element', ['shell', 'input', 'tap', '<x>', '<y>'], input.targetText || null, null));
  }
  if (input.payload) {
    steps.push(planStep('type-text', 'Type approved text after preview', ['shell', 'input', 'text', '<redacted>'], input.targetText || null, input.payload || input.objective || null));
  }
  if (input.packageName || input.activityName) {
    steps.push(planStep('start-intent', 'Start approved package/activity after preview', ['shell', 'am', 'start', '<package>/<activity>'], input.activityName || input.packageName || null, null));
  }
  return dedupeSteps(steps);
}

function planStep(
  kind: ZavorthAndroidAdbPlanStepKind,
  label: string,
  adbArgsPreview: string[],
  targetText: string | null,
  payloadPreview: string | null,
): ZavorthAndroidAdbPlanStep {
  const mutation = MUTATING_STEP_KINDS.has(kind);
  const blockedByDefault = kind === 'install' || kind === 'uninstall';
  return {
    id: `device-step-${kind}`,
    kind,
    label,
    adbArgsPreview,
    targetText: targetText ? safePreview(targetText, 80) : null,
    payloadPreview: payloadPreview ? safePreview(payloadPreview, 80) : null,
    mutation,
    requiresApproval: mutation && !blockedByDefault,
    blockedByDefault,
    risk: blockedByDefault ? 'forbidden' : mutation ? 'high' : 'low',
  };
}

function dedupeSteps(steps: ZavorthAndroidAdbPlanStep[]): ZavorthAndroidAdbPlanStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (seen.has(step.kind)) return false;
    seen.add(step.kind);
    return true;
  });
}

function detectHardBlocks(input: ZavorthAndroidAdbInput, evidence: EvidenceBundle): HardBlockResult {
  const haystack = [
    input.objective,
    input.packageName,
    input.activityName,
    input.screenText,
    input.uiXml,
    input.targetText,
    input.payload,
    evidence.screenText,
    evidence.uiXml,
    evidence.logcatText,
    evidence.currentActivity,
  ].map((entry) => String(entry || '')).join('\n');
  const matches = SENSITIVE_RULES.filter((rule) => rule.pattern.test(haystack));
  const risks = [...new Set(matches.map((entry) => entry.risk))];
  return {
    matched: risks.length > 0,
    risks,
    reason: matches.map((entry) => entry.reason).join(' ') || null,
  };
}

function resolveStatus(input: {
  action: ZavorthAndroidAdbAction;
  input: ZavorthAndroidAdbInput;
  discovery: AdbDiscovery;
  hardBlocks: HardBlockResult;
  mutationRequested: boolean;
  approvalRequired: boolean;
  blockedByDefault: boolean;
  evidence: EvidenceBundle;
}): ZavorthAndroidAdbStatus {
  if (input.hardBlocks.matched || input.blockedByDefault) return 'blocked';
  if (input.approvalRequired || input.mutationRequested) return 'approval-required';
  if ((input.input.live || ['device.status', 'device.list', 'device.doctor'].includes(input.action)) && !input.discovery.available) return 'adb-unavailable';
  if (input.input.live && !input.discovery.selected) return 'no-device';
  if (input.discovery.selected && input.discovery.selected.state === 'unauthorized') return 'unauthorized';
  if (input.discovery.selected && input.discovery.selected.state !== 'authorized') return 'attention';
  if (input.evidence.errors.length > 0) return 'attention';
  return 'ready';
}

function resolvePolicyDecision(
  status: ZavorthAndroidAdbStatus,
  hardBlocks: HardBlockResult,
  mutationRequested: boolean,
  approvalRequired: boolean,
  blockedByDefault: boolean,
  visionDecision: ZavorthVisionPolicyDecision,
): ZavorthVisionPolicyDecision {
  if (hardBlocks.matched || blockedByDefault || status === 'blocked') return 'deny';
  if (approvalRequired || mutationRequested) return 'require_owner_approval';
  if (visionDecision === 'allow_with_redaction' || status === 'redacted') return 'allow_with_redaction';
  return 'allow_readonly';
}

function resolvePolicyReason(
  status: ZavorthAndroidAdbStatus,
  hardBlocks: HardBlockResult,
  mutationRequested: boolean,
  approvalRequired: boolean,
  blockedByDefault: boolean,
  discovery: AdbDiscovery,
): string {
  if (hardBlocks.matched) return hardBlocks.reason || 'Android device request was blocked by hard policy.';
  if (blockedByDefault) return 'ADB install/uninstall and destructive operations are blocked by default.';
  if (status === 'adb-unavailable') return discovery.error || 'ADB is unavailable; install platform-tools or provide an ADB binary.';
  if (status === 'no-device') return 'No authorized Android device was found for live observation.';
  if (status === 'unauthorized') return 'Android device is connected but not authorized for ADB.';
  if (approvalRequired) return 'Android tap, swipe, text input, keyevent and intent actions require owner approval.';
  if (mutationRequested) return 'Android mutation remains preview-only even with an approval reference in Connector registry.';
  return 'Read-only Android ADB observation is allowed; live mutation is disabled.';
}

function resolvePlanStatus(
  action: ZavorthAndroidAdbAction,
  steps: ZavorthAndroidAdbPlanStep[],
  hardBlocks: HardBlockResult,
  approvalRequired: boolean,
  blockedByDefault: boolean,
  approvalId: string | null | undefined,
): ZavorthAndroidAdbSnapshot['plan']['status'] {
  if (hardBlocks.matched || blockedByDefault) return 'blocked';
  if (steps.length === 0) return action === 'device.cancel' ? 'cancelled-preview' : 'none';
  if (approvalRequired) return 'approval-required';
  if (action === 'device.approve' && approvalId) return 'approved-preview';
  return 'planned';
}

function nextSafeAction(status: ZavorthAndroidAdbStatus, input: {
  hardBlocks: HardBlockResult;
  mutationRequested: boolean;
  approvalRequired: boolean;
  discovery: AdbDiscovery;
}): string {
  if (input.hardBlocks.matched || status === 'blocked') return 'Use read-only inspect on a non-sensitive app, or ask for a safe explanation.';
  if (status === 'adb-unavailable') return 'Install Android platform-tools or configure adb, then run /device android doctor.';
  if (status === 'no-device') return 'Connect a USB device with ADB enabled, then run /device android doctor.';
  if (status === 'unauthorized') return 'Confirm the ADB authorization prompt on the phone before live observation.';
  if (input.approvalRequired || input.mutationRequested) return 'Review the preview and attach owner approval before any tap, swipe, text, keyevent or intent.';
  return 'Observe first, then request /device plan before touching the phone.';
}

function preferredSource(evidence: EvidenceBundle): ZavorthAndroidAdbSnapshot['evidence']['preferredSource'] {
  if (evidence.uiXml || evidence.screenText) return evidence.uiXml ? 'adb-ui-dump' : 'provided';
  if (evidence.logcatText) return 'adb-logcat';
  if (evidence.screenshot) return 'adb-screenshot';
  return 'none';
}

function inferScreenState(input: {
  hardBlocks: HardBlockResult;
  evidence: EvidenceBundle;
}): ZavorthAndroidAdbSnapshot['device']['screenState'] {
  if (input.hardBlocks.risks.some((risk) => risk === 'credential-or-mfa-screen' || risk === 'banking-or-payment' || risk === 'wallet-or-seed')) {
    return 'locked-or-sensitive';
  }
  if (input.evidence.screenText || input.evidence.uiXml || input.evidence.screenshot) return 'available';
  return 'unknown';
}

function joinEvidence(input: ZavorthAndroidAdbInput, evidence: EvidenceBundle): string {
  return [
    input.screenText,
    evidence.screenText,
    input.uiXml,
    evidence.uiXml,
    input.logcatText,
    evidence.logcatText,
    evidence.currentActivity,
    input.objective,
  ].map((entry) => String(entry || '').trim()).filter(Boolean).join('\n');
}

function filterLogcat(value: string, maxLines: number): string {
  const lines = String(value || '')
    .split(/\r?\n/)
    .filter((line) => !/\b(password|token|secret|authorization|bearer|cookie)\b/i.test(line))
    .slice(-Math.max(1, Math.min(maxLines, 500)));
  return lines.join('\n').trim();
}

function extractCurrentActivity(value: string): string | null {
  const text = String(value || '');
  return text.match(/\bmCurrentFocus=.*?\s([A-Za-z0-9_.]+\/[A-Za-z0-9_.$]+)/)?.[1]
    || text.match(/\bmFocusedApp=.*?\s([A-Za-z0-9_.]+\/[A-Za-z0-9_.$]+)/)?.[1]
    || null;
}

function writeArtifact(
  root: string,
  kind: ZavorthAndroidAdbArtifactRef['kind'],
  extension: string,
  bytes: Buffer,
  mime: string,
): ZavorthAndroidAdbArtifactRef {
  fs.mkdirSync(root, { recursive: true });
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const displayName = `android-${kind}-${hash.slice(0, 12)}.${extension}`;
  const artifactPath = path.join(root, displayName);
  fs.writeFileSync(artifactPath, bytes);
  return {
    id: `android-artifact-${kind}-${hash.slice(0, 16)}`,
    kind,
    path: artifactPath,
    mime,
    displayName,
    hash,
    rawContentSerialized: false,
    redactedBeforeProvider: true,
  };
}

function makePlanId(input: ZavorthAndroidAdbInput, steps: ZavorthAndroidAdbPlanStep[]): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify({
      serial: input.deviceSerial || null,
      objective: input.objective || null,
      steps: steps.map((step) => step.kind),
    }))
    .digest('hex');
  return `device-plan-${hash.slice(0, 16)}`;
}

function receipt(
  kind: ZavorthAndroidAdbReceipt['kind'],
  status: ZavorthAndroidAdbReceipt['status'],
  reason: string,
): ZavorthAndroidAdbReceipt {
  return {
    id: `device-${kind}-${safeId(status)}-${hashShort(reason)}`,
    kind,
    status,
    reason,
    rawSecretSerialized: false,
  };
}

function mapReceiptStatus(status: ZavorthAndroidAdbReceipt['status']): SurfaceReceiptStatus {
  if (status === 'allow_readonly') return 'allowed';
  if (status === 'allow_with_redaction') return 'allowed_with_redaction';
  if (status === 'require_user_confirmation') return 'require_user_confirmation';
  if (status === 'require_admin_policy' || status === 'require_owner_approval' || status === 'approval-required') return 'require_admin_policy';
  if (status === 'deny') return 'denied';
  if (status === 'blocked') return 'blocked';
  if (status === 'attention' || status === 'skipped') return 'blocked';
  return 'done';
}

function commandAction(
  id: string,
  label: string,
  command: string,
  style: SurfaceResponseAction['style'],
): SurfaceResponseAction {
  return {
    id,
    label,
    kind: 'command',
    command,
    callbackData: command,
    style,
  };
}

function hashShort(value: unknown): string {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 8);
}

function safePreview(value: unknown, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function safeId(value: unknown): string {
  const text = String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return text || 'item';
}
