export type ReleaseUxCheckStatus = 'pass' | 'warn' | 'fail';
export type ReleaseUxSource = 'package' | 'web' | 'control-plane' | 'wizard' | 'rollback' | 'changelog';

export type ReleaseUxWizardStep = {
  id: string;
  label: string;
  phase: 'readiness' | 'diff' | 'hygiene' | 'publish' | 'rollback' | 'changelog';
  command: string;
  previewOnly: boolean;
  requiresApproval: boolean;
  status: 'ready' | 'attention' | 'blocked';
  summary: string;
  evidence: string[];
};

export type ReleaseUxHumanDiff = {
  requested: {
    from: string | null;
    to: string | null;
  };
  available: boolean;
  status: 'ready' | 'attention';
  summary: string;
  docsDelta: string;
  remoteConsoleDelta: string;
  command: string;
};

export type ReleaseUxRollbackPreview = {
  targetId: string | null;
  targetLabel: string | null;
  risk: 'low' | 'medium' | 'high';
  command: string;
  previewOnly: boolean;
  confirmationRequired: boolean;
  executed: false;
  preflightStatus: 'pass' | 'warn' | 'block';
  evidence: string[];
  reversalPlan: string[];
};

export type ReleaseUxChangelog = {
  source: string;
  entries: string[];
  operatorSummary: string;
  command: string;
};

export type ReleaseUxCheck = {
  id: string;
  title: string;
  status: ReleaseUxCheckStatus;
  source: ReleaseUxSource;
  reason: string;
  evidence?: string[];
};

export type ReleaseUxWizardSnapshot = {
  gate: 'release-ux-wizard';
  surface: 'release-ux';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
    steps: number;
    approvalsRequired: number;
    changelogEntries: number;
    rollbackEvidence: number;
    heavyRuntimesStarted: false;
  };
  release: {
    channel: string;
    version: string | null;
    risk: 'low' | 'medium' | 'high';
    status: string;
  };
  wizard: {
    steps: ReleaseUxWizardStep[];
    humanDiff: ReleaseUxHumanDiff;
    rollback: ReleaseUxRollbackPreview;
    changelog: ReleaseUxChangelog;
  };
  checks: ReleaseUxCheck[];
  contracts: string[];
  commands: {
    inspect: string;
    json: string;
    gate: string;
    diff: string;
    rollbackPreview: string;
    changelog: string;
  };
  nextRecommendedGate: {
    gate: 'tenant-team-ops';
    title: string;
    reason: string;
  };
};

export const RELEASE_UX_PACKAGE_SCRIPTS = [
  'release:status',
  'release:diff',
  'release:rollback-preview',
  'release:presence',
  'release:changelog',
  'release:wizard',
  'release:wizard:json',
  'qa:release-ux',
  'qa:release-ux-wizard',
  'release:scan',
  'release:alpha',
  'release:beta',
] as const;

export const RELEASE_UX_WEB_MARKERS = [
  'id="release-ux-wizard-card"',
  'id="release-ux-readiness"',
  'id="release-ux-diff"',
  'id="release-ux-rollback"',
  'id="release-ux-changelog"',
  'data-copy="npm run release:wizard"',
  'data-copy="npm run release:diff"',
  'data-copy="npm run release:rollback-preview"',
] as const;

export const RELEASE_UX_CONTRACTS = [
  'Release wizard and preview-first flow: diff, publish, rollback, and changelog appear before any destructive action.',
  'Alpha/beta publish remains an explicit operator-approved command; the wizard does not publish by itself.',
  'Rollback always requires preflight, evidence, risk, and confirmation; preview never performs a release switch.',
  'Human diff must exist even when real history is still cold, with degraded state instead of false success.',
  'Operational changelog uses publish history and telemetry summaries; raw payload, token, and secret do not enter the first layer.',
  'ZavorthControl must expose readiness, diff, rollback, and changelog with copyable commands.',
];
