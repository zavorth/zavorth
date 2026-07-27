import type { RuntimeOfficialAccessReport } from '../runtime/access/RuntimeOfficialAccessService.js';
import {
  ZAVORTH_CLI_BRAND_NAME,
  formatZavorthMascotBlock,
} from './ZavorthCliMascot.js';
import { paintCliTone } from './ZavorthCliVisualTheme.js';

import { logger } from '../logger.js';
import {
  buildZavorthFailureExplanation,
  formatZavorthFailureExplanation,
  renderZavorthFailureExplanation,
} from './ZavorthCliFailureExplanation.js';
export type ZavorthGoLauncherSnapshot = {
  skipped: boolean;
  applied: boolean;
  mode: string;
  error: string | null;
};

export type ZavorthGoAppOpenSnapshot = {
  skipped: boolean;
  opened: boolean;
  targetUrl: string | null;
};

export type ZavorthGoFirstRunSnapshot = {
  configured: boolean;
  profilePath: string;
  userDisplayName?: string | null;
  agentDisplayName?: string | null;
};

export type ZavorthGoRenderOptions = {
  launcher?: ZavorthGoLauncherSnapshot | null;
  appOpen?: ZavorthGoAppOpenSnapshot | null;
  dryRun?: boolean;
  firstRun?: ZavorthGoFirstRunSnapshot | null;
};

function applyZavorthPublicBranding(output: string): string {
  if (process.env.ZAVORTH_PUBLIC_CLI !== '1') {
    return output;
  }

  return output
    .replace(/\bZavorth\b/gu, 'Zavorth')
    .replace(/\bzavorth\b/gu, 'zavorth');
}

export function formatZavorthGoReport(
  report: RuntimeOfficialAccessReport,
  options: ZavorthGoRenderOptions = {},
): string {
  const ready = report.local.ready;
  const header = formatZavorthMascotBlock([
    paintCliTone(ZAVORTH_CLI_BRAND_NAME, 'brand'),
    ready ? 'Input ready' : 'Input has not responded yet',
    options.dryRun
      ? paintCliTone('Dry-run completed; nada foi alterado', 'muted')
      : (ready ? paintCliTone('Opening the best available entry', 'muted') : paintCliTone('Use the safe diagnostic path', 'muted')),
  ]);

  const lines = [
    ...header,
    '',
    ready ? `${paintCliTone('*', 'success')} Zavorth ready`
      : `${paintCliTone('!', 'warning')} Adjustment required`,
    '',
    ...buildZavorthGoPrimaryLines(report, options),
  ];

  return applyZavorthPublicBranding(lines.join('\n'));
}

export function formatZavorthGoFailure(error: unknown): string {
  return formatZavorthFailureExplanation({
    kind: 'runtime-not-running',
    error,
    whatHappened: 'Zavorth could not open Home.',
    likelyCause: 'The local runtime, Home, or browser target did not answer safely.',
    nextStep: 'Run the doctor, then retry with a dry-run preview.',
    tryCommand: 'zavorth doctor',
  });
}

function buildZavorthGoPrimaryLines(
  report: RuntimeOfficialAccessReport,
  options: ZavorthGoRenderOptions,
): string[] {
  if (report.local.ready) {
    return buildReadyGoLines(report, options);
  }

  return buildBlockedGoLines(report, options);
}

function buildReadyGoLines(
  report: RuntimeOfficialAccessReport,
  options: ZavorthGoRenderOptions,
): string[] {
  const homeUrl = resolveHomeUrl(report, options);
  const lines = [
    paintCliTone('Home', 'muted'),
    homeUrl ? `  > Zavorth ZavorthControl: ${homeUrl}`
      : '  > Zavorth ZavorthControl at /zavorthControl',
    '',
    paintCliTone('Areas principais', 'muted'),
    '  > Inbox | Tasks | Approvals | Receipts | Connectors',
    '',
    paintCliTone('Start from the terminal if you prefer', 'muted'),
    '  > zavorth chat',
    '',
    paintCliTone('Receipts and state', 'muted'),
    '  > zavorth receipts',
    '',
    paintCliTone('If something looks wrong', 'muted'),
    '  > zavorth doctor',
  ];

  const firstRunLines = buildFirstRunLines(options.firstRun || null);
  if (firstRunLines.length > 0) {
    lines.splice(6, 0, '', paintCliTone('Primeiro usage', 'muted'), ...firstRunLines.map((line) => `  > ${line}`));
  }

  const openedLabel = buildOpenedLabel(options.appOpen || null);
  if (openedLabel) {
    lines.push('', paintCliTone(openedLabel.title, 'muted'), `  > ${openedLabel.value}`);
  } else if (report.local.appUrl && normalizeHomeUrl(report.local.appUrl) !== homeUrl) {
    lines.push('', paintCliTone('Interface local', 'muted'), `  > ${normalizeHomeUrl(report.local.appUrl)}`);
  }

  const launcherLine = buildLauncherLine(options.launcher || null);
  if (launcherLine) {
    lines.push('', paintCliTone('shortcut do sistema', 'muted'), `  > ${launcherLine}`);
  }

  if (options.dryRun) {
    lines.push('', paintCliTone('Note', 'muted'), '  > dry-run: nothing was applied.');
  }

  return lines;
}

function resolveHomeUrl(
  report: RuntimeOfficialAccessReport,
  options: ZavorthGoRenderOptions,
): string | null {
  const openedTarget = String(options.appOpen?.targetUrl || '').trim();
  if (openedTarget) {
    return normalizeHomeUrl(openedTarget);
  }

  const localTarget = String(report.local.appUrl || '').trim();
  if (localTarget) {
    return normalizeHomeUrl(localTarget);
  }

  const remoteTarget = String(report.remote.appUrl || '').trim();
  return remoteTarget ? normalizeHomeUrl(remoteTarget) : null;
}

function buildBlockedGoLines(
  report: RuntimeOfficialAccessReport,
  options: ZavorthGoRenderOptions,
): string[] {
  const lines = renderZavorthFailureExplanation(
    buildZavorthFailureExplanation({
      kind: 'runtime-not-running',
      whatHappened: 'Zavorth could not reach the local Home.',
      likelyCause: buildShortBlockerLine(report),
      nextStep: 'Use doctor to separate missing setup, port, build, and runtime blockers.',
      tryCommand: 'zavorth doctor',
    }),
    { includeHeader: false },
  ).split('\n');

  const firstRunLines = buildFirstRunLines(options.firstRun || null);
  if (firstRunLines.length > 0) {
    lines.push('', paintCliTone('First Use', 'muted'), ...firstRunLines.map((line) => `  > ${line}`));
  }

  lines.push('', paintCliTone('After That', 'muted'), '  > zavorth status');

  if (options.dryRun) {
    lines.push('', paintCliTone('Note', 'muted'), '  > dry-run: nothing was applied.');
  }

  const openedLabel = buildOpenedLabel(options.appOpen || null);
  if (openedLabel) {
    lines.push('', paintCliTone(openedLabel.title, 'muted'), `  > ${openedLabel.value}`);
  }

  return lines;
}

function buildFirstRunLines(firstRun: ZavorthGoFirstRunSnapshot | null): string[] {
  if (!firstRun || firstRun.configured) {
    return [];
  }
  return [
    'local profile not yet configured.',
    'zavorth setup --dry-run',
    'zavorth setup',
  ];
}

function buildShortBlockerLine(report: RuntimeOfficialAccessReport): string {
  if (!report.local.ready) {
    return 'the local host or Home has not responded yet.';
  }
  if (report.local.trust.applied === false) {
    return 'this computer still needs authorization.';
  }
  return 'Zavorth needs a check before opening.';
}

function buildOpenedLabel(appOpen: ZavorthGoAppOpenSnapshot | null): { title: string; value: string } | null {
  if (!appOpen || appOpen.skipped || !appOpen.targetUrl) {
    return null;
  }

  return {
    title: appOpen.opened ? 'Open Interface' : 'Interface',
    value: normalizeHomeUrl(appOpen.targetUrl),
  };
}

function buildLauncherLine(launcher: ZavorthGoLauncherSnapshot | null): string | null {
  if (!launcher || launcher.skipped) {
    return null;
  }
  if (launcher.applied) {
    return `ready (${launcher.mode})`;
  }
  if (launcher.error) {
    return `not applied (${launcher.error})`;
  }
  return 'not applied';
}

function normalizeHomeUrl(value: string | null): string {
  const target = String(value || '').trim();
  if (!target) {
    return '';
  }
  try {
    const url = new URL(target);
    if (url.pathname.replace(/\/+$/u, '') === '/zavorthControl') {
      url.pathname = '/zavorthControl';
      url.search = '';
      url.hash = '';
      return url.toString();
    }
  } catch (error: unknown) {
    logger.warn('[Zavorth Cli Go Renderer] search failed', error);
    return target.replace(/\/zavorthControl(?:[...#].*)...$/u, '/zavorthControl');
  }
  return target;
}
