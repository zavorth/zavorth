import {
  renderPremiumActions,
  renderPremiumKeyValueTable,
  renderPremiumPanel,
  renderPremiumStatusRows,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStatus,
} from '../premium/index.js';
import { buildZavorthDoctorPremiumSnapshot } from './ZavorthDoctorCheckRegistry.js';
import type {
  ZavorthDoctorPremiumCheck,
  ZavorthDoctorPremiumSnapshot,
  ZavorthDoctorPremiumStatus,
} from './ZavorthDoctorPremiumTypes.js';

export type RunZavorthDoctorPremiumInput = {
  projectRoot: string;
  json?: boolean;
  strict?: boolean;
  verbose?: boolean;
};

export function runZavorthDoctorPremium(input: RunZavorthDoctorPremiumInput): {
  exitCode: number;
  output: string;
  snapshot: ZavorthDoctorPremiumSnapshot;
} {
  const snapshot = buildZavorthDoctorPremiumSnapshot({ projectRoot: input.projectRoot });
  const output = input.json ? `${JSON.stringify(snapshot, null, 2)}\n` : `${renderZavorthDoctorPremium(snapshot, {
    verbose: input.verbose,
  })}\n`;
  const exitCode = input.strict && snapshot.status !== 'pass' ? 1 : 0;
  return { exitCode, output, snapshot };
}

export function renderZavorthDoctorPremium(snapshot: ZavorthDoctorPremiumSnapshot, options: {
  verbose?: boolean;
} = {}): string {
  const attentionChecks = snapshot.checks.filter((check) => check.status !== 'pass');
  const visibleChecks = options.verbose
    ? snapshot.checks
    : attentionChecks.slice(0, 4);
  const panels: ZavorthPremiumCliPanel[] = [
    {
      title: 'Summary',
      accent: accentForDoctorStatus(snapshot.status),
      lines: renderPremiumKeyValueTable([
        { key: 'status', value: snapshot.status, accent: accentForDoctorStatus(snapshot.status) },
        { key: 'checks', value: `${snapshot.summary.total}` },
        { key: 'pass', value: `${snapshot.summary.pass}`, accent: 'emerald' },
        { key: 'warn', value: `${snapshot.summary.warn}`, accent: snapshot.summary.warn > 0 ? 'amber' : 'muted' },
        { key: 'fail', value: `${snapshot.summary.fail}`, accent: snapshot.summary.fail > 0 ? 'rose' : 'muted' },
      ]).split('\n'),
    },
    ...(visibleChecks.length > 0
      ? visibleChecks.map((check) => checkToPanel(check, { verbose: Boolean(options.verbose) }))
      : [{
          title: 'Everything looks ready',
          accent: 'emerald' as const,
          lines: [
            'No blocking issue found in the public doctor path.',
            'Use --verbose when you want evidence for every check.',
          ],
        }]),
  ];

  return renderZavorthPremiumCliScreen({
    title: 'Doctor',
    subtitle: 'Local setup, provider, gateway, channels and safety readiness.',
    mode: 'compact',
    statusRows: (attentionChecks.length > 0 ? attentionChecks : snapshot.checks.slice(0, 4)).map((check) => ({
      label: check.title,
      value: check.summary,
      status: statusToPremium(check.status),
      detail: check.fixCommand ? `next: ${check.fixCommand}` : null,
    })),
    panels,
    actions: snapshot.nextActions.map((action) => ({
      label: action.label,
      command: action.command,
      detail: action.detail,
      accent: 'cyan',
    })),
    notice: {
      title: 'Doctor safety',
      body: options.verbose
        ? 'Verbose mode shows local evidence with secrets redacted. It still does not start persistent services.'
        : 'Compact by default. Secrets are redacted; use --verbose for full evidence.',
    },
  });
}

function checkToPanel(check: ZavorthDoctorPremiumCheck, options: { verbose: boolean }): ZavorthPremiumCliPanel {
  const evidence = check.evidence ?? [];
  const visibleEvidence = options.verbose ? evidence : evidence.slice(0, 3);
  const hiddenEvidenceCount = Math.max(0, evidence.length - visibleEvidence.length);
  return {
    title: check.title,
    accent: accentForDoctorStatus(check.status),
    lines: [
      `Status: ${check.status}`,
      `What happened: ${check.summary}`,
      `Impact: ${check.impact}`,
      check.fixCommand ? `Try: ${check.fixCommand}` : 'Try: no action needed',
      ...(visibleEvidence.length > 0
        ? [
            '',
            options.verbose ? 'Evidence:' : 'Evidence sample:',
            ...visibleEvidence.map((entry) => `- ${entry}`),
            ...(hiddenEvidenceCount > 0 ? [`- ${hiddenEvidenceCount} more hidden in compact mode. Use --verbose.`] : []),
          ]
        : []),
    ],
  };
}

function statusToPremium(status: ZavorthDoctorPremiumStatus): ZavorthPremiumCliStatus {
  if (status === 'pass') {
    return 'ready';
  }
  if (status === 'fail') {
    return 'blocked';
  }
  return 'warning';
}

function accentForDoctorStatus(status: ZavorthDoctorPremiumStatus): 'emerald' | 'amber' | 'rose' {
  if (status === 'pass') {
    return 'emerald';
  }
  if (status === 'fail') {
    return 'rose';
  }
  return 'amber';
}

export function renderZavorthDoctorCompactActions(snapshot: ZavorthDoctorPremiumSnapshot): string {
  return renderPremiumPanel({
    title: 'Doctor actions',
    accent: 'cyan',
    lines: renderPremiumActions(snapshot.nextActions.map((action) => ({
      label: action.label,
      command: action.command,
      detail: action.detail,
    }))).split('\n'),
  });
}
