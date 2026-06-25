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
  phase: '44';
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
  nextRecommendedPhase: {
    phase: '42';
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
  'qa:phase:44',
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
  'Release wizard e preview-first: diff, publish, rollback e changelog aparecem antes de qualquer acao destrutiva.',
  'Publish alpha/beta continua comando explicito e aprovado pelo operador; o wizard nao publica sozinho.',
  'Rollback sempre exige preflight, evidencia, risco e confirmacao; preview nunca executa troca de release.',
  'Diff humano deve existir mesmo quando o historico real ainda estiver frio, com estado degradado em vez de falso sucesso.',
  'Changelog operacional usa publish history e telemetry summaries; payload bruto, token e secret nao entram na primeira camada.',
  'A Dashboard deve expor readiness, diff, rollback e changelog com comandos copiaveis.',
];
