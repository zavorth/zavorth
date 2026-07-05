export type PilotLoopCheckStatus = 'pass' | 'warn' | 'fail';

export type PilotLoopCheck = {
  id: string;
  title: string;
  status: PilotLoopCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type PilotFeedbackArea = 'bug' | 'docs' | 'install' | 'feature' | 'runtime' | 'release';
export type PilotFeedbackSeverity = 'critical' | 'high' | 'medium' | 'low';

export type PilotFeedbackTemplate = {
  id: PilotFeedbackArea;
  title: string;
  requiredFields: string[];
  redactionRules: string[];
  defaultSeverity: PilotFeedbackSeverity;
  safePrompt: string;
};

export type PilotTriageRule = {
  id: string;
  area: PilotFeedbackArea;
  severity: PilotFeedbackSeverity;
  responseTarget: string;
  owner: 'product' | 'runtime' | 'docs' | 'release';
  nextAction: string;
};

export type PilotLedgerEntry = {
  id: string;
  scope: string;
  status: 'planned' | 'active' | 'complete';
  startedAt: string;
  result: string;
  followUp: string;
  dataPolicy: 'no-workspace-payload' | 'redacted-only';
};

export type PilotSupportPolicy = {
  id: string;
  channel: string;
  responseWindow: string;
  boundaries: string[];
  escalation: string;
};

export type PilotZavorthControlMetric = {
  id: string;
  label: string;
  aggregateOnly: boolean;
  excludesPayload: boolean;
  source: string;
};

export type PilotLoopSnapshot = {
  phase: '57';
  surface: 'pilot-loop';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  projectRoot: string;
  websiteRoot: string;
  artifactDir: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  artifacts: {
    feedbackPreviewPath: string;
    pilotLedgerPath: string;
    zavorthControlPath: string;
  };
  templates: PilotFeedbackTemplate[];
  triageRules: PilotTriageRule[];
  pilotLedger: PilotLedgerEntry[];
  supportPolicy: PilotSupportPolicy[];
  zavorthControlMetrics: PilotZavorthControlMetric[];
  checks: PilotLoopCheck[];
  nextRecommendedPhase: {
    phase: '58';
    title: string;
    reason: string;
  };
};

export const PILOT_LOOP_REQUIRED_CORE_SCRIPTS = [
  'feedback-loop',
  'feedback:preview',
  'feedback:revoke',
  'feedback:delete',
  'qa:feedback-loop',
  'public-docs-recipes',
  'qa:public-docs-recipes',
  'pilot-loop',
  'qa:pilot-loop',
  'qa:phase:57',
] as const;

export const PILOT_LOOP_REQUIRED_WEBSITE_FILES = [
  'app/feedback/page.tsx',
  'data/feedback-loop.ts',
  'app/docs/page.tsx',
] as const;

export const PILOT_FEEDBACK_TEMPLATES: PilotFeedbackTemplate[] = [
  {
    id: 'bug',
    title: 'Bug report',
    requiredFields: ['what you tried to do', 'what happened', 'public command used', 'reviewed redacted preview'],
    redactionRules: ['no tokens', 'no secrets', 'no personal paths', 'no raw payload'],
    defaultSeverity: 'medium',
    safePrompt: 'Describe the bug using only summary, public command, and redacted preview.',
  },
  {
    id: 'docs',
    title: 'Docs gap',
    requiredFields: ['page or section', 'specific question', 'expected result', 'related command'],
    redactionRules: ['no private workspace', 'no raw logs', 'no credentials'],
    defaultSeverity: 'low',
    safePrompt: 'Describe which public section was confusing using only a redacted example.',
  },
  {
    id: 'install',
    title: 'Install support',
    requiredFields: ['operating system', 'node/npm', 'public command', 'summarized error'],
    redactionRules: ['remove personal path', 'redact user names', 'no environment variables'],
    defaultSeverity: 'high',
    safePrompt: 'Share a summarized environment and redacted error, without variables or personal paths.',
  },
  {
    id: 'feature',
    title: 'Feature request',
    requiredFields: ['use case', 'persona', 'expected value', 'required control'],
    redactionRules: ['no customer data', 'no private repositories', 'no internal documents'],
    defaultSeverity: 'low',
    safePrompt: 'Explain the use case in public terms with redacted context.',
  },
];

export const PILOT_TRIAGE_RULES: PilotTriageRule[] = [
  {
    id: 'install-high',
    area: 'install',
    severity: 'high',
    responseTarget: '1 business day',
    owner: 'runtime',
    nextAction: 'Confirm reproduction in a local fixture and update troubleshooting.',
  },
  {
    id: 'bug-medium',
    area: 'bug',
    severity: 'medium',
    responseTarget: '2 business days',
    owner: 'runtime',
    nextAction: 'Open triage with the public command and redacted preview.',
  },
  {
    id: 'docs-low',
    area: 'docs',
    severity: 'low',
    responseTarget: '3 business days',
    owner: 'docs',
    nextAction: 'Update docs/recipe if the gap is reproducible.',
  },
  {
    id: 'release-high',
    area: 'release',
    severity: 'high',
    responseTarget: '1 business day',
    owner: 'release',
    nextAction: 'Validate manifest, rollback preview, and affected channel.',
  },
  {
    id: 'feature-low',
    area: 'feature',
    severity: 'low',
    responseTarget: 'next planning cycle',
    owner: 'product',
    nextAction: 'Register in the public backlog without promising delivery.',
  },
];

export const PILOT_LEDGER_ENTRIES: PilotLedgerEntry[] = [
  {
    id: 'pilot-local-engineering',
    scope: 'Validate quickstart, chat, and approval loop in a fixture workspace.',
    status: 'planned',
    startedAt: '2026-04-26',
    result: 'Pending controlled external pilot.',
    followUp: 'Collect one install friction and one docs friction without sensitive payload.',
    dataPolicy: 'redacted-only',
  },
  {
    id: 'pilot-release-operator',
    scope: 'Validate release readiness, manifest, and rollback preview.',
    status: 'planned',
    startedAt: '2026-04-26',
    result: 'Pending external operator.',
    followUp: 'Confirm whether alpha/beta/stable channels are clear.',
    dataPolicy: 'no-workspace-payload',
  },
  {
    id: 'pilot-feedback-loop',
    scope: 'Validate preview, revoke/delete, and offline feedback ledger.',
    status: 'planned',
    startedAt: '2026-04-26',
    result: 'Pending simulated opt-in feedback.',
    followUp: 'Measure whether the template avoids secrets and raw payload.',
    dataPolicy: 'redacted-only',
  },
];

export const PILOT_SUPPORT_POLICY: PilotSupportPolicy[] = [
  {
    id: 'privacy-first',
    channel: 'public issue or redacted feedback preview',
    responseWindow: 'best effort during pilot',
    boundaries: ['no secrets', 'no raw payload', 'no private workspace'],
    escalation: 'Request a redacted preview before any deep diagnosis.',
  },
  {
    id: 'install-runtime',
    channel: 'support issue',
    responseWindow: '1-2 business days for pilot blockers',
    boundaries: ['public command only', 'summarized error', 'redacted environment'],
    escalation: 'Reproduce through a local fixture before requesting additional details.',
  },
  {
    id: 'feature-planning',
    channel: 'feature request',
    responseWindow: 'next planning review',
    boundaries: ['no roadmap promise', 'no private data', 'no implied partnership'],
    escalation: 'Convert to a stage proposal only with previewed repeated demand.',
  },
];

export const PILOT_ZAVORTH_CONTROL_METRICS: PilotZavorthControlMetric[] = [
  {
    id: 'feedback-count-by-area',
    label: 'Feedback by area',
    aggregateOnly: true,
    excludesPayload: true,
    source: 'redacted feedback preview',
  },
  {
    id: 'severity-mix',
    label: 'Severity distribution',
    aggregateOnly: true,
    excludesPayload: true,
    source: 'triage rules',
  },
  {
    id: 'pilot-status',
    label: 'Pilot status',
    aggregateOnly: true,
    excludesPayload: true,
    source: 'local pilot ledger',
  },
  {
    id: 'follow-up-aging',
    label: 'Follow-ups pendentes',
    aggregateOnly: true,
    excludesPayload: true,
    source: 'local pilot ledger',
  },
];

export const PILOT_LOOP_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'telemetry ligada por padrao',
  'envio automatico',
  'payload bruto enviado',
  'sending without opt-in',
  'secret required',
] as const;
