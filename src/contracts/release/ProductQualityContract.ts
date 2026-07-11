export type ProductQualityCheckStatus = 'pass' | 'warn' | 'fail';

export type ProductQualityCommandFamily =
  | 'first-run'
  | 'work'
  | 'operations'
  | 'capabilities'
  | 'memory'
  | 'release'
  | 'advanced';

export type ProductQualityCommandSpec = {
  command: string;
  family: ProductQualityCommandFamily;
  summary: string;
  localAlias?: string;
  jsonExample?: string;
};

export type ProductQualityDocSpec = {
  path: string;
  label: string;
  requiredPhrases: string[];
  advancedPhrase?: string;
};

export type ProductQualityRule = {
  id: string;
  title: string;
  description: string;
  severity: 'blocking' | 'warning';
};

export type ProductQualityCheck = {
  id: string;
  title: string;
  status: ProductQualityCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type ProductQualityContractSnapshot = {
  gate: 'product-quality';
  surface: 'product-quality-contract';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  officialJourney: string[];
  commandSpecs: ProductQualityCommandSpec[];
  rules: ProductQualityRule[];
  checks: ProductQualityCheck[];
  nextRecommendedGate: {
    gate: 'deterministic-qa';
    title: string;
    reason: string;
  };
};

export const PRODUCT_QUALITY_OFFICIAL_JOURNEY = [
  'zavorth setup',
  'zavorth go',
  'zavorth chat',
  'zavorth status',
  'zavorth doctor',
] as const;

export const PRODUCT_QUALITY_COMMANDS: ProductQualityCommandSpec[] = [
  {
    command: 'zavorth setup',
    family: 'first-run',
    summary: 'prepares profile, provider, host, and initial access',
    localAlias: 'onboard',
  },
  {
    command: 'zavorth go',
    family: 'first-run',
    summary: 'starts the supervised runtime and opens the best surface',
    localAlias: 'go',
  },
  {
    command: 'zavorth chat',
    family: 'work',
    summary: 'opens the official conversational terminal',
    localAlias: 'chat',
  },
  {
    command: 'zavorth run "<pedido>"',
    family: 'work',
    summary: 'sends a single natural-language request',
  },
  {
    command: 'zavorth continue',
    family: 'work',
    summary: 'resumes the current work without a slash command',
  },
  {
    command: 'zavorth status',
    family: 'operations',
    summary: 'shows the short current status',
    localAlias: 'status',
    jsonExample: 'zavorth status --json',
  },
  {
    command: 'zavorth doctor',
    family: 'operations',
    summary: 'shows blockers and a clear next step',
    localAlias: 'doctor',
    jsonExample: 'zavorth doctor --json',
  },
  {
    command: 'zavorth cockpit',
    family: 'operations',
    summary: 'consolidates status, doctor, brief, tasks, and artifacts',
    localAlias: 'cockpit',
    jsonExample: 'zavorth cockpit --json',
  },
  {
    command: 'zavorth capabilities list',
    family: 'capabilities',
    summary: 'shows capabilities, risk, permission, MCP allowlist, and fallback',
    localAlias: 'capabilities',
    jsonExample: 'zavorth capabilities list --json',
  },
  {
    command: 'zavorth tasks',
    family: 'capabilities',
    summary: 'shows Task OS with formal states',
    localAlias: 'tasks',
    jsonExample: 'zavorth tasks --json',
  },
  {
    command: 'zavorth artifacts task latest',
    family: 'capabilities',
    summary: 'lists artifacts persisted by task',
    localAlias: 'artifacts',
    jsonExample: 'zavorth artifacts task latest --json',
  },
  {
    command: 'zavorth supervisor plan "<pedido>"',
    family: 'capabilities',
    summary: 'builds a supervised DAG when the task justifies it',
    localAlias: 'supervisor',
    jsonExample: 'zavorth supervisor plan "fix a bug" --json',
  },
  {
    command: 'zavorth memory review',
    family: 'memory',
    summary: 'shows learned memories, retention, and correction actions',
    localAlias: 'memory:review',
    jsonExample: 'zavorth memory review --json',
  },
  {
    command: 'zavorth heal --preview',
    family: 'operations',
    summary: 'shows the recovery plan without executing',
    localAlias: 'heal',
    jsonExample: 'zavorth heal --preview --json',
  },
  {
    command: 'zavorth release status',
    family: 'release',
    summary: 'shows channel, version, risk, rollback, and remote presence',
    localAlias: 'release:status',
    jsonExample: 'zavorth release status --json',
  },
  {
    command: 'zavorth nodes',
    family: 'advanced',
    summary: 'shows companions and devices without raw inventory',
  },
  {
    command: 'zavorth plugins list',
    family: 'advanced',
    summary: 'shows plugins, skills, MCPs, collections, and recipes in a compact format',
  },
];

export const PRODUCT_QUALITY_DOCS: ProductQualityDocSpec[] = [
  {
    path: 'README.md',
    label: 'Main README',
    requiredPhrases: [
      'First Use In 60 Seconds',
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'zavorth doctor',
      '--json',
    ],
    advancedPhrase: 'Advanced And Maintenance Track',
  },
  {
    path: 'docs/quickstart.md',
    label: 'Quickstart',
    requiredPhrases: [
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'zavorth doctor',
      '--json',
    ],
  },
  {
    path: 'docs/zavorth-cli.md',
    label: 'Canonical CLI',
    requiredPhrases: [
      'Happy Path',
      'Human Output Vs JSON',
      'CLI Quality Checklist',
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'zavorth doctor',
    ],
  },
  {
    path: 'docs/product-direction.md',
    label: 'CLI UX Diagnosis',
    requiredPhrases: [
      'a short official path',
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'CLI stage acceptance checklist',
    ],
  },
];

export const PRODUCT_QUALITY_RULES: ProductQualityRule[] = [
  {
    id: 'journey-first',
    title: 'Official journey first',
    description: 'README and quickstart must present setup -> go -> chat before internal scripts.',
    severity: 'blocking',
  },
  {
    id: 'human-output',
    title: 'Short human output',
    description: 'The first human layer must show state, blockage, and next action without raw inventory.',
    severity: 'blocking',
  },
  {
    id: 'json-clean',
    title: 'Clean JSON',
    description: 'With --json, official commands must print only parseable JSON.',
    severity: 'blocking',
  },
  {
    id: 'advanced-lane',
    title: 'Labeled advanced track',
    description: 'npm run ops:*, cli:fast, and internal scripts must appear as maintenance/development.',
    severity: 'warning',
  },
  {
    id: 'first-layer-noise',
    title: 'No technical noise in the first layer',
    description: 'Terms like sessionId, chatId, control plane, stack trace, and npm run ops must not dominate the human UX.',
    severity: 'blocking',
  },
];
