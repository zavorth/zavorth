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
    requiredFields: ['o que tentou fazer', 'o que aconteceu', 'comando publico usado', 'preview redigido revisado'],
    redactionRules: ['sem tokens', 'sem secrets', 'sem paths pessoais', 'sem payload bruto'],
    defaultSeverity: 'medium',
    safePrompt: 'Descreva o bug usando somente resumo, comando publico e preview redigido.',
  },
  {
    id: 'docs',
    title: 'Docs gap',
    requiredFields: ['pagina ou secao', 'duvida concreta', 'resultado esperado', 'comando relacionado'],
    redactionRules: ['sem workspace privado', 'sem logs brutos', 'sem credenciais'],
    defaultSeverity: 'low',
    safePrompt: 'Informe qual trecho publico ficou confuso usando apenas exemplo redigido.',
  },
  {
    id: 'install',
    title: 'Install support',
    requiredFields: ['sistema operacional', 'node/npm', 'comando publico', 'erro resumido'],
    redactionRules: ['remover path pessoal', 'redigir nomes de usuario', 'sem env vars'],
    defaultSeverity: 'high',
    safePrompt: 'Compartilhe ambiente resumido e erro redigido, sem variaveis ou caminhos pessoais.',
  },
  {
    id: 'feature',
    title: 'Feature request',
    requiredFields: ['caso de uso', 'persona', 'valor esperado', 'controle necessario'],
    redactionRules: ['sem dados de cliente', 'sem repos privados', 'sem documentos internos'],
    defaultSeverity: 'low',
    safePrompt: 'Explique o caso de uso em termos publicos com contexto redigido.',
  },
];

export const PILOT_TRIAGE_RULES: PilotTriageRule[] = [
  {
    id: 'install-high',
    area: 'install',
    severity: 'high',
    responseTarget: '1 business day',
    owner: 'runtime',
    nextAction: 'Confirmar reproduzir em fixture local e atualizar troubleshooting.',
  },
  {
    id: 'bug-medium',
    area: 'bug',
    severity: 'medium',
    responseTarget: '2 business days',
    owner: 'runtime',
    nextAction: 'Abrir triagem com comando publico e preview redigido.',
  },
  {
    id: 'docs-low',
    area: 'docs',
    severity: 'low',
    responseTarget: '3 business days',
    owner: 'docs',
    nextAction: 'Atualizar docs/recipe se o gap for reproduzivel.',
  },
  {
    id: 'release-high',
    area: 'release',
    severity: 'high',
    responseTarget: '1 business day',
    owner: 'release',
    nextAction: 'Validar manifest, rollback preview e canal afetado.',
  },
  {
    id: 'feature-low',
    area: 'feature',
    severity: 'low',
    responseTarget: 'next planning cycle',
    owner: 'product',
    nextAction: 'Registrar no backlog publico sem prometer entrega.',
  },
];

export const PILOT_LEDGER_ENTRIES: PilotLedgerEntry[] = [
  {
    id: 'pilot-local-engineering',
    scope: 'Validar quickstart, chat e approval loop em workspace fixture.',
    status: 'planned',
    startedAt: '2026-04-26',
    result: 'Pendente de piloto externo controlado.',
    followUp: 'Coletar uma friccao de install e uma de docs sem payload sensivel.',
    dataPolicy: 'redacted-only',
  },
  {
    id: 'pilot-release-operator',
    scope: 'Validar release readiness, manifest e rollback preview.',
    status: 'planned',
    startedAt: '2026-04-26',
    result: 'Pendente de operador externo.',
    followUp: 'Confirmar se canais alpha/beta/stable estao claros.',
    dataPolicy: 'no-workspace-payload',
  },
  {
    id: 'pilot-feedback-loop',
    scope: 'Validar preview, revoke/delete e ledger offline de feedback.',
    status: 'planned',
    startedAt: '2026-04-26',
    result: 'Pendente de feedback opt-in simulado.',
    followUp: 'Medir se o template evita secrets e payload bruto.',
    dataPolicy: 'redacted-only',
  },
];

export const PILOT_SUPPORT_POLICY: PilotSupportPolicy[] = [
  {
    id: 'privacy-first',
    channel: 'public issue or redacted feedback preview',
    responseWindow: 'best effort during pilot',
    boundaries: ['sem secrets', 'sem payload bruto', 'sem workspace privado'],
    escalation: 'Pedir preview redigido antes de qualquer diagnostico profundo.',
  },
  {
    id: 'install-runtime',
    channel: 'support issue',
    responseWindow: '1-2 business days for pilot blockers',
    boundaries: ['somente comando publico', 'erro resumido', 'ambiente redigido'],
    escalation: 'Reproduzir via fixture local antes de solicitar detalhes adicionais.',
  },
  {
    id: 'feature-planning',
    channel: 'feature request',
    responseWindow: 'next planning review',
    boundaries: ['sem promessa de roadmap', 'sem dados privados', 'sem parceria implicita'],
    escalation: 'Converter para proposta de etapa apenas com preview de demanda repetida.',
  },
];

export const PILOT_ZAVORTH_CONTROL_METRICS: PilotZavorthControlMetric[] = [
  {
    id: 'feedback-count-by-area',
    label: 'Feedback por area',
    aggregateOnly: true,
    excludesPayload: true,
    source: 'redacted feedback preview',
  },
  {
    id: 'severity-mix',
    label: 'Distribuicao por severidade',
    aggregateOnly: true,
    excludesPayload: true,
    source: 'triage rules',
  },
  {
    id: 'pilot-status',
    label: 'Status dos pilotos',
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
  'envio sem opt-in',
  'secret obrigatorio',
] as const;
