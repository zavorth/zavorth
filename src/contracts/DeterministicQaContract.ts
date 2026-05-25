export type DeterministicQaTier = 'quick' | 'standard' | 'release';
export type DeterministicQaLayer =
  | 'typecheck'
  | 'contract'
  | 'unit'
  | 'integration'
  | 'smoke'
  | 'product'
  | 'release';

export type DeterministicQaGateSpec = {
  id: string;
  label: string;
  tier: DeterministicQaTier;
  layer: DeterministicQaLayer;
  command: string;
  packageScript: string | null;
  maxDurationMs: number;
  required: boolean;
  requiresNetwork: boolean;
  startsPersistentProcess: boolean;
  producesJson: boolean;
  reason: string;
};

export type DeterministicQaCheckStatus = 'pass' | 'warn' | 'fail';

export type DeterministicQaCheck = {
  id: string;
  title: string;
  status: DeterministicQaCheckStatus;
  reason: string;
  evidence?: string[];
};

export type DeterministicQaMatrixSnapshot = {
  phase: '41';
  surface: 'deterministic-qa-matrix';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    gates: number;
    required: number;
    passed: number;
    warnings: number;
    failed: number;
    maxReleaseDurationMs: number;
  };
  tiers: Record<DeterministicQaTier, {
    gates: string[];
    maxDurationMs: number;
    command: string;
  }>;
  gates: DeterministicQaGateSpec[];
  checks: DeterministicQaCheck[];
  contracts: string[];
  nextRecommendedPhase: {
    phase: '45';
    title: string;
    reason: string;
  };
};

export const DETERMINISTIC_QA_GATES: DeterministicQaGateSpec[] = [
  {
    id: 'runtime-check',
    label: 'TypeScript runtime check',
    tier: 'quick',
    layer: 'typecheck',
    command: 'npm run runtime:check --silent',
    packageScript: 'runtime:check',
    maxDurationMs: 360_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'garante que contratos TS do runtime continuam validos',
  },
  {
    id: 'product-quality',
    label: 'Product Quality Contract',
    tier: 'quick',
    layer: 'contract',
    command: 'npm run qa:product-quality --silent -- --json',
    packageScript: 'qa:product-quality',
    maxDurationMs: 180_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: true,
    reason: 'protege jornada oficial, aliases, docs e anti-ruido da CLI',
  },
  {
    id: 'cli-visual-contract',
    label: 'CLI visual contract',
    tier: 'quick',
    layer: 'unit',
    command: 'npm run test:cli --silent',
    packageScript: 'test:cli',
    maxDurationMs: 240_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'bloqueia regressao visual de primeira camada',
  },
  {
    id: 'end-to-end-flows',
    label: 'End-to-end flow harness',
    tier: 'standard',
    layer: 'integration',
    command: 'npm run qa:flows --silent',
    packageScript: 'qa:flows',
    maxDurationMs: 240_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'trava fluxos reais de comando, aprovacao, fallback e continuidade',
  },
  {
    id: 'sandbox-host-readiness',
    label: 'Sandbox host readiness',
    tier: 'standard',
    layer: 'smoke',
    command: 'npm run qa:phase:38 --silent',
    packageScript: 'qa:phase:38',
    maxDurationMs: 420_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'mantem sandbox forte honesto por host sem bloquear Windows local',
  },
  {
    id: 'product-experience',
    label: 'Product experience aggregate',
    tier: 'release',
    layer: 'product',
    command: 'npm run qa:product-experience --silent -- --skip-build --json',
    packageScript: 'qa:product-experience',
    maxDurationMs: 420_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: true,
    reason: 'valida modos, escalonamento, Dashboard, paridade e memoria',
  },
  {
    id: 'architecture-gate',
    label: 'Architecture gate',
    tier: 'release',
    layer: 'release',
    command: 'npm run qa:architecture --silent',
    packageScript: 'qa:architecture',
    maxDurationMs: 240_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'mantem fronteiras e postura arquitetural antes de release',
  },
  {
    id: 'full-build',
    label: 'Build completo',
    tier: 'release',
    layer: 'release',
    command: 'npm run build --silent',
    packageScript: 'build',
    maxDurationMs: 480_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'fecha TypeScript, surface syntax e launchers',
  },
];

export const DETERMINISTIC_QA_CONTRACTS = [
  'Todo gate required precisa de package script verificavel.',
  'Nenhum gate da matriz default pode exigir rede externa.',
  'Nenhum gate da matriz default pode deixar processo persistente.',
  'Gates com JSON precisam declarar producesJson=true.',
  'Quick deve ser subconjunto de Standard, e Standard deve ser subconjunto de Release.',
  'Cada gate precisa ter budget maxDurationMs explicito.',
];
