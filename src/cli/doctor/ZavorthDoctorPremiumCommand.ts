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
};

export function runZavorthDoctorPremium(input: RunZavorthDoctorPremiumInput): {
  exitCode: number;
  output: string;
  snapshot: ZavorthDoctorPremiumSnapshot;
} {
  const snapshot = buildZavorthDoctorPremiumSnapshot({ projectRoot: input.projectRoot });
  const output = input.json ? `${JSON.stringify(snapshot, null, 2)}\n` : `${renderZavorthDoctorPremium(snapshot)}\n`;
  const exitCode = input.strict && snapshot.status !== 'pass' ? 1 : 0;
  return { exitCode, output, snapshot };
}

export function renderZavorthDoctorPremium(snapshot: ZavorthDoctorPremiumSnapshot): string {
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
    ...snapshot.checks.map(checkToPanel),
  ];

  return renderZavorthPremiumCliScreen({
    title: 'Doctor',
    subtitle: 'Local setup, provider, gateway, channels and safety readiness.',
    mode: 'compact',
    statusRows: snapshot.checks.map((check) => ({
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
      body: 'This diagnostic redacts secrets, does not start persistent runtime services, and only suggests fixes unless an explicit fix command is used.',
    },
  });
}

function checkToPanel(check: ZavorthDoctorPremiumCheck): ZavorthPremiumCliPanel {
  return {
    title: check.title,
    accent: accentForDoctorStatus(check.status),
    lines: [
      `Status: ${check.status}`,
      `What happened: ${check.summary}`,
      `Impact: ${check.impact}`,
      check.fixCommand ? `Try: ${check.fixCommand}` : 'Try: no action needed',
      ...(check.evidence && check.evidence.length > 0 ? ['', 'Evidence:', ...check.evidence.map((entry) => `- ${entry}`)] : []),
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
