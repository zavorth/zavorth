import {
  RuntimeOfficialAccessService,
  type RuntimeOfficialAccessReport,
} from '../../src/runtime/access/RuntimeOfficialAccessService.js';
import { RuntimeAccessLaunchService } from '../../src/runtime/access/RuntimeAccessLaunchService.js';
import {
  RuntimeLauncherInstallService,
  type RuntimeLauncherInstallMode,
} from '../../src/services/RuntimeLauncherInstallService.js';
import { renderCliScreen, type CliVisualPanel } from '../../src/cli/ZavorthCliVisualSystem.js';

export type OfficialInstallArgs = {
  json: boolean;
  dryRun: boolean;
  allowReadonly: boolean;
  trustLocal: boolean;
  launcher: boolean;
  openApp: boolean;
  openLocal: boolean;
  openRemote: boolean;
  openBest: boolean;
  timeoutMs: number;
  pollIntervalMs: number;
};

export type OfficialInstallFlowDefaults = Partial<OfficialInstallArgs> & {
  autoInstallRecommendedLauncher?: boolean;
  requestedLauncherMode?: RuntimeLauncherInstallMode | null;
};

export type OfficialInstallResult = {
  report: RuntimeOfficialAccessReport;
  launcher: {
    attempted: boolean;
    applied: boolean;
    skipped: boolean;
    mode: RuntimeLauncherInstallMode;
    command: string | null;
    scriptPath: string | null;
    error: string | null;
    output: string | null;
  };
  appOpen: {
    attempted: boolean;
    opened: boolean;
    skipped: boolean;
    targetUrl: string | null;
    error: string | null;
  };
};

type OfficialInstallPresentationOptions = {
  eyebrow?: string;
  title?: string;
  launcher?: OfficialInstallResult['launcher'];
  appOpen?: OfficialInstallResult['appOpen'];
  dryRun?: boolean;
  currentCommand?: string | null;
};

export function parseOfficialInstallArgs(argv: string[]): OfficialInstallArgs {
  return {
    json: argv.includes('--json'),
    dryRun: argv.includes('--dry-run'),
    allowReadonly: argv.includes('--allow-readonly'),
    trustLocal: argv.includes('--trust-local'),
    launcher: argv.includes('--launcher'),
    openApp: argv.includes('--open'),
    openLocal: argv.includes('--open-local'),
    openRemote: argv.includes('--open-remote'),
    openBest: argv.includes('--open-best'),
    timeoutMs: parseNumericFlag(argv, 'timeout-ms', 60_000),
    pollIntervalMs: parseNumericFlag(argv, 'poll-ms', 2_000),
  };
}

export async function executeOfficialInstallFlow(
  args: OfficialInstallArgs,
  defaults: OfficialInstallFlowDefaults = {},
): Promise<OfficialInstallResult> {
  const effectiveArgs: OfficialInstallArgs = {
    ...args,
    ...defaults,
    timeoutMs: defaults.timeoutMs ?? args.timeoutMs,
    pollIntervalMs: defaults.pollIntervalMs ?? args.pollIntervalMs,
  };
  const service = new RuntimeOfficialAccessService();
  const launcherInstallService = new RuntimeLauncherInstallService();
  const launchService = new RuntimeAccessLaunchService();
  const report = await service.prepare({
    dryRun: effectiveArgs.dryRun,
    autoTrustLocal: effectiveArgs.trustLocal || (!effectiveArgs.allowReadonly && !effectiveArgs.dryRun),
    timeoutMs: effectiveArgs.timeoutMs,
    pollIntervalMs: effectiveArgs.pollIntervalMs,
    requireMutableAccess: !effectiveArgs.allowReadonly,
  });

  const recommendedPlan = report.manifest.recommendedPlan || null;
  const launcherPhase = report.journey.phases.find((phase) => phase.id === 'launcher') || null;
  const recommendedLauncherMode = resolveLauncherMode(recommendedPlan?.launcherRecommendation.command || null);
  const shouldInstallRecommendedLauncher =
    defaults.autoInstallRecommendedLauncher !== false
    && !effectiveArgs.dryRun
    && !effectiveArgs.launcher
    && recommendedPlan?.primaryAction === 'open-local'
    && launcherPhase?.status === 'action'
    && recommendedLauncherMode !== null;
  const launcherMode: RuntimeLauncherInstallMode =
    recommendedLauncherMode
    || defaults.requestedLauncherMode
    || (effectiveArgs.launcher ? 'desktop' : 'startup');
  const requestedLauncherInstall = effectiveArgs.launcher || shouldInstallRecommendedLauncher;
  const launcher = requestedLauncherInstall
    ? launcherInstallService.install(launcherMode, { dryRun: effectiveArgs.dryRun })
    : {
      attempted: false,
      applied: false,
      skipped: true,
      mode: launcherMode,
      command: null,
      scriptPath: null,
      error: null,
      output: null,
    };
  const launchPreference = effectiveArgs.openRemote ? 'remote'
    : (effectiveArgs.openLocal ? 'local'
      : ((effectiveArgs.openBest || effectiveArgs.openApp) ? 'best'
        : resolveRecommendedLaunchPreference(report)));
  const launchSelection = launchPreference
    ? launchService.selectTarget(
      {
        local: {
          ready: report.local.ready,
          appUrl: report.local.appUrl,
        },
        remote: {
          ready: report.remote.ready,
          appUrl: report.remote.appUrl || null,
        },
      },
      launchPreference,
    )
    : null;
  const appOpen = launchSelection
    ? (effectiveArgs.dryRun
      ? {
        attempted: false,
        opened: false,
        skipped: true,
        targetUrl: launchSelection.url,
        error: null,
      }
      : await launchService.openSelected(launchSelection).then((result) => ({
        attempted: result.attempted,
        opened: result.ok,
        skipped: !result.attempted,
        targetUrl: result.url,
        error: result.error,
      })))
    : {
      attempted: false,
      opened: false,
      skipped: true,
      targetUrl: report.local.appUrl || report.remote.appUrl || null,
      error: null,
    };

  return {
    report,
    launcher,
    appOpen,
  };
}

export function formatOfficialInstallReport(
  report: RuntimeOfficialAccessReport,
  options: OfficialInstallPresentationOptions = {},
): string {
  const title = String(options.title || '').trim()
    || (report.local.ready ? 'Zavorth is on' : 'Zavorth still needs an adjustment');
  const eyebrow = String(options.eyebrow || '').trim() || 'Zavorth';
  const readinessTone = report.local.ready
    ? (report.remote.configured && !report.remote.ready ? 'warning' : 'success')
    : 'warning';
  const panels: CliVisualPanel[] = [
    {
      title: 'Agora',
      tone: readinessTone,
      lines: buildOfficialCurrentLines(report, options),
    },
    {
      title: 'access local',
      tone: report.local.ready ? 'success' : 'warning',
      lines: [
        report.local.ready ? `- ready em ${report.local.appUrl}`
          : `- not ready yet at ${report.local.appUrl}`,
        describeLocalTrust(report),
      ],
    },
    {
      title: 'access remote',
      tone: report.remote.ready ? 'success' : (report.remote.configured ? 'warning' : 'info'),
      lines: buildRemoteLines(report),
    },
  ];

  const openingLines = buildOpeningLines(options.launcher, options.appOpen);
  if (openingLines.length > 0) {
    panels.push({
      title: 'Abertura',
      tone: 'info',
      lines: openingLines,
    });
  }

  const nextSteps = buildPresentationNextSteps(report, options).map((step) => `- ${step}`);
  if (nextSteps.length > 0) {
    panels.push({
      title: 'Faca agora',
      tone: report.local.ready ? 'info' : 'warning',
      lines: nextSteps,
    });
  }

  return renderCliScreen({
    eyebrow,
    eyebrowTone: readinessTone,
    title,
    summary: sanitizeOfficialNarrative(report.summary),
    panels,
    mode: 'compact',
    showWordmark: false,
  });
}

function buildOfficialCurrentLines(
  report: RuntimeOfficialAccessReport,
  options: OfficialInstallPresentationOptions,
): string[] {
  const lines: string[] = [];

  if (report.local.ready) {
    lines.push('- O Zavorth already pode abrir a interface principal.');
  } else {
    lines.push(`- ${sanitizeOfficialNarrative(report.journey.summary)}`);
  }

  if (options.dryRun) {
    lines.push('- This was a dry-run: nothing was applied on this host.');
  }

  if (report.remote.ready && !report.local.ready) {
    lines.push('- O access remote already is ready, mesmo com a entrada local ainda pending.');
  }

  if (!report.remote.configured && !report.local.ready) {
    lines.push('- Remote access has not been configured in this environment yet.');
  }

  return lines.slice(0, 3);
}

export function printOfficialInstallReport(
  report: RuntimeOfficialAccessReport,
  options: OfficialInstallPresentationOptions = {},
): void {
  console.log(formatOfficialInstallReport(report, options));
}

export function resolveLauncherMode(command: string | null): RuntimeLauncherInstallMode | null {
  const normalized = String(command || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return normalized.includes('startup') ? 'startup' : 'desktop';
}

export function resolveRecommendedLaunchPreference(
  report: RuntimeOfficialAccessReport,
): 'local' | 'remote' | 'best' | null {
  const plan = report.manifest.recommendedPlan;
  if (!plan) {
    return null;
  }

  if (plan.primaryAction === 'open-local') {
    return 'local';
  }

  if (plan.primaryAction === 'trust') {
    return report.local.ready ? 'local' : 'best';
  }

  if (plan.primaryAction === 'go') {
    return 'best';
  }

  if (plan.primaryAction === 'remote') {
    return report.remote.ready ? 'remote' : null;
  }

  return null;
}

function parseNumericFlag(argv: string[], name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const inline = argv.find((entry) => entry.startsWith(prefix));
  if (inline) {
    const value = Number(inline.slice(prefix.length));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  const index = argv.findIndex((entry) => entry === `--${name}`);
  if (index >= 0) {
    const value = Number(argv[index + 1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  return fallback;
}

function describeLocalTrust(report: RuntimeOfficialAccessReport): string {
  if (report.local.trust.applied) {
    return '- authorization deste host: ok';
  }
  if (report.local.trust.attempted) {
    return `- authorization deste host: failed${report.local.trust.error ? ` (${report.local.trust.error})` : ''}`;
  }
  return '- host authorization: not applied yet';
}

function buildRemoteLines(report: RuntimeOfficialAccessReport): string[] {
  const lines: string[] = [];
  if (!report.remote.configured) {
    lines.push('- not configured yet');
  } else if (report.remote.ready) {
    lines.push(`- ready${report.remote.appUrl ? ` em ${report.remote.appUrl}` : ''}`);
  } else {
    lines.push(`- ainda pending${report.remote.appUrl ? ` em ${report.remote.appUrl}` : ''}`);
  }

  lines.push(`- token web: ${report.tokenSource === 'missing' ? 'not configured yet' : report.tokenSource}`);

  for (const issue of report.remote.issues.slice(0, 2)) {
    lines.push(`- ${sanitizeOfficialNarrative(issue)}`);
  }
  return lines;
}

function buildOpeningLines(
  launcher?: OfficialInstallResult['launcher'],
  appOpen?: OfficialInstallResult['appOpen'],
): string[] {
  const lines: string[] = [];
  if (launcher && !launcher.skipped) {
    lines.push(
      launcher.applied ? `- shortcut do sistema: ok (${launcher.mode})`
        : `- shortcut do sistema: failed${launcher.error ? ` (${launcher.error})` : ''}`,
    );
  }
  if (appOpen && !appOpen.skipped) {
    lines.push(
      appOpen.opened
        ? `- abertura da interface: ok${appOpen.targetUrl ? ` (${appOpen.targetUrl})` : ''}`
        : `- abertura da interface: failed${appOpen.error ? ` (${appOpen.error})` : ''}`,
    );
  }
  return lines;
}

function sanitizeOfficialStep(
  step: string,
  report: RuntimeOfficialAccessReport,
  options: OfficialInstallPresentationOptions = {},
): string {
  const normalized = sanitizeOfficialNarrative(step);
  if (!normalized) {
    return '';
  }

  if (/\/hostauth trust/i.test(normalized)) {
    return options.dryRun ? 'Exit dry-run when you want Zavorth to apply the local preparation for real.'
      : 'Libere a authorization deste host current para o Zavorth operar localmente.';
  }

  const currentCommand = normalizeCommandLabel(options.currentCommand || '');
  if (currentCommand && includesCommand(normalized, currentCommand)) {
    if (options.dryRun) {
      return 'Exit dry-run when you want Zavorth to apply the local preparation for real.';
    }
    if (/ZAVORTH_PUBLIC_BASE_URL/i.test(normalized)) {
      return 'set ZAVORTH_PUBLIC_BASE_URL when exposing Zavorth over HTTPS.';
    }
    if (normalized.includes('trust local')) {
      return 'Libere a authorization deste host current para o Zavorth operar localmente.';
    }
    return 'Use zavorth doctor to see exactly what is still blocking Zavorth.';
  }

  return normalized;
}

function buildPresentationNextSteps(
  report: RuntimeOfficialAccessReport,
  options: OfficialInstallPresentationOptions,
): string[] {
  const rawSteps = report.nextSteps
    .slice(0, 4)
    .map((step) => sanitizeOfficialStep(step, report, options))
    .filter(Boolean);
  const steps: string[] = [];

  for (const step of rawSteps) {
    if (!steps.some((entry) => normalizeStep(entry) === normalizeStep(step))) {
      steps.push(step);
    }
  }

  if (options.currentCommand && options.dryRun) {
    ensureStep(
      steps,
      'Exit dry-run when you want Zavorth to apply the local preparation for real.',
    );
  }

  if (!report.local.ready && !report.local.trust.applied && !options.dryRun) {
    ensureStep(steps, 'Libere a authorization deste host current para o Zavorth operar localmente.');
  }

  if (!report.remote.configured) {
    ensureStep(steps, 'set ZAVORTH_PUBLIC_BASE_URL when exposing Zavorth over HTTPS.');
  }

  if (!report.local.ready) {
    ensureStep(steps, 'Use zavorth doctor to see exactly what is still blocking Zavorth.');
  }

  return steps.slice(0, 4);
}

function sanitizeOfficialNarrative(value: string): string {
  return String(value || '')
    .replace(/runtime/gi, 'Zavorth')
    .replace(/surface/gi, 'entrada')
    .replace(/ZavorthControl/gi, 'interface principal')
    .replace(/host supervisor/gi, 'service principal')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureStep(steps: string[], step: string): void {
  if (!steps.some((entry) => normalizeStep(entry) === normalizeStep(step))) {
    steps.push(step);
  }
}

function normalizeStep(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeCommandLabel(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function includesCommand(value: string, command: string): boolean {
  const normalizedValue = normalizeStep(value);
  const normalizedCommand = normalizeCommandLabel(command);
  return Boolean(normalizedCommand) && normalizedValue.includes(normalizedCommand);
}
