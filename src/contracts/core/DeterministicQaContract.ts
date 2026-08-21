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
  gate: 'deterministic-qa';
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
  nextRecommendedGate: {
    gate: 'runtime-idle-budget';
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
    reason: 'ensures runtime TS contracts remain valid',
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
    reason: 'protects the official journey, aliases, docs, and CLI anti-noise',
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
    reason: 'blocks first-layer visual regression',
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
    reason: 'locks real command, approval, fallback, and continuity flows',
  },
  {
    id: 'sandbox-host-readiness',
    label: 'Sandbox host readiness',
    tier: 'standard',
    layer: 'smoke',
    command: 'npm run qa:sandbox-host-readiness --silent',
    packageScript: 'qa:sandbox-host-readiness',
    maxDurationMs: 420_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'keeps strong sandbox posture honest per host without blocking local Windows',
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
    reason: 'validates modes, escalation, ZavorthControl, parity, and memory',
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
    reason: 'keeps boundaries and architectural posture before release',
  },
  {
    id: 'full-build',
    label: 'Full build',
    tier: 'release',
    layer: 'release',
    command: 'npm run build --silent',
    packageScript: 'build',
    maxDurationMs: 480_000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'closes TypeScript, surface syntax, and launchers',
  },
];

export const DETERMINISTIC_QA_CONTRACTS = [
  'Every required gate needs a verifiable package script.',
  'No default matrix gate may require an external network.',
  'No default matrix gate may leave a persistent process.',
  'JSON gates must declare producesJson=true.',
  'Quick must be a subset of Standard, and Standard must be a subset of Release.',
  'Each gate needs an explicit maxDurationMs budget.',
];
