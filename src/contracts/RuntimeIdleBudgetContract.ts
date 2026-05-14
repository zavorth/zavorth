export type RuntimeIdleBudgetStatus = 'ready' | 'attention' | 'blocked';
export type RuntimeIdleBudgetCheckStatus = 'pass' | 'warn' | 'fail';
export type RuntimeIdleBudgetMetricKind = 'startup' | 'cli' | 'qa' | 'memory' | 'process';

export type RuntimeIdleBudgetMetricSpec = {
  id: string;
  label: string;
  kind: RuntimeIdleBudgetMetricKind;
  max: number;
  unit: 'ms' | 'mb' | 'count';
  source: string;
  required: boolean;
};

export type RuntimeIdleBudgetBackgroundScriptSpec = {
  script: string;
  expectedFragment: string;
  category: 'dev' | 'runtime' | 'maintenance' | 'companion';
  explicit: boolean;
  reason: string;
};

export type RuntimeIdleBudgetCheck = {
  id: string;
  title: string;
  status: RuntimeIdleBudgetCheckStatus;
  reason: string;
  evidence?: string[];
};

export type RuntimeIdleBudgetSnapshot = {
  phase: '45';
  surface: 'runtime-idle-budget';
  generatedAt: string;
  status: RuntimeIdleBudgetStatus;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
    metrics: number;
    backgroundScripts: number;
  };
  metrics: RuntimeIdleBudgetMetricSpec[];
  backgroundScripts: RuntimeIdleBudgetBackgroundScriptSpec[];
  checks: RuntimeIdleBudgetCheck[];
  contracts: string[];
  commands: {
    inspect: string;
    json: string;
    benchmark: string;
    desktopDoctor: string;
  };
  nextRecommendedPhase: {
    phase: '40';
    title: string;
    reason: string;
  };
};

export const RUNTIME_IDLE_BUDGET_METRICS: RuntimeIdleBudgetMetricSpec[] = [
  {
    id: 'gateway-host-boot',
    label: 'Gateway host boot',
    kind: 'startup',
    max: 500,
    unit: 'ms',
    source: 'qa/budgets/alpha.json benchmark-boot.json',
    required: true,
  },
  {
    id: 'cli-status-fast',
    label: 'CLI status fast',
    kind: 'cli',
    max: 6000,
    unit: 'ms',
    source: 'qa/budgets/alpha.json benchmark-boot.json',
    required: true,
  },
  {
    id: 'cli-doctor-fast',
    label: 'CLI doctor fast',
    kind: 'cli',
    max: 12000,
    unit: 'ms',
    source: 'qa/budgets/alpha.json benchmark-boot.json',
    required: true,
  },
  {
    id: 'cli-ops-access-fast',
    label: 'CLI ops access fast',
    kind: 'cli',
    max: 1500,
    unit: 'ms',
    source: 'qa/budgets/alpha.json benchmark-boot.json',
    required: true,
  },
  {
    id: 'quick-qa-budget',
    label: 'QA deterministic quick tier',
    kind: 'qa',
    max: 780000,
    unit: 'ms',
    source: 'DeterministicQaMatrixService',
    required: true,
  },
  {
    id: 'zavorth-idle-memory',
    label: 'Zavorth idle memory',
    kind: 'memory',
    max: 512,
    unit: 'mb',
    source: 'DesktopResourcePlaneService cached snapshot',
    required: false,
  },
  {
    id: 'zavorth-idle-processes',
    label: 'Zavorth idle node processes',
    kind: 'process',
    max: 3,
    unit: 'count',
    source: 'DesktopResourcePlaneService cached snapshot',
    required: false,
  },
];

export const RUNTIME_IDLE_BACKGROUND_SCRIPTS: RuntimeIdleBudgetBackgroundScriptSpec[] = [
  {
    script: 'dev',
    expectedFragment: 'nodemon',
    category: 'dev',
    explicit: true,
    reason: 'watcher de desenvolvimento, nunca gate default.',
  },
  {
    script: 'dev:supervised',
    expectedFragment: 'src/host.ts',
    category: 'dev',
    explicit: true,
    reason: 'host supervisionado para desenvolvimento local.',
  },
  {
    script: 'start',
    expectedFragment: 'dist/index.js',
    category: 'runtime',
    explicit: true,
    reason: 'runtime principal, acionado manualmente.',
  },
  {
    script: 'start:supervised',
    expectedFragment: 'dist/host.js',
    category: 'runtime',
    explicit: true,
    reason: 'host supervisionado, acionado manualmente.',
  },
  {
    script: 'nodes:host',
    expectedFragment: 'node-mesh-host',
    category: 'companion',
    explicit: true,
    reason: 'node mesh host explicito.',
  },
  {
    script: 'ops:maintain:scheduled',
    expectedFragment: 'ops-maintain-recurring',
    category: 'maintenance',
    explicit: true,
    reason: 'manutencao recorrente supervisionada, fora do perfil core por padrao.',
  },
  {
    script: 'start:ai-gateway',
    expectedFragment: 'start-ai-gateway-runtime',
    category: 'runtime',
    explicit: true,
    reason: 'gateway dedicado, acionado sob demanda.',
  },
  {
    script: 'agent:start',
    expectedFragment: 'agent start',
    category: 'companion',
    explicit: true,
    reason: 'companion/agent externo, acionado explicitamente.',
  },
];

export const RUNTIME_IDLE_CONTRACTS = [
  'O perfil core nao inicia sidecar ou watcher por padrao.',
  'Gates de idle/performance leem estado passivo e nao iniciam processo persistente.',
  'Benchmarks de startup ficam em qa:bench:boot e nao rodam dentro do gate rapido.',
  'Scripts de background precisam ser explicitos e rotulados.',
  'Budgets de CLI/status/doctor precisam vir de qa/budgets/alpha.json.',
  'Leitura live de desktop resource e opcional; ausencia de cache gera aviso, nao falso bloqueio.',
];
