export type PublicDocsRecipesCheckStatus = 'pass' | 'warn' | 'fail';

export type PublicDocsRecipesCheck = {
  id: string;
  title: string;
  status: PublicDocsRecipesCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type PublicDocsRecipeRisk = 'low' | 'medium' | 'high';

export type PublicDocsRecipe = {
  id: string;
  title: string;
  audience: string;
  useCase: 'quickstart' | 'engineering' | 'release' | 'replay-artifacts';
  prerequisites: string[];
  commands: string[];
  expectedResult: string;
  fixtureMode: boolean;
  requiresSecrets: boolean;
  previewFirst: boolean;
  risk: PublicDocsRecipeRisk;
  evidence: string[];
};

export type PublicDocsTroubleshootingSymptom = {
  id: 'install' | 'runtime' | 'site' | 'feedback';
  symptom: string;
  firstCheck: string;
  safeCommand: string;
  escalation: string;
};

export type PublicDocsNoSecretsCapability = {
  id: string;
  label: string;
  command: string;
  runsWithoutSecrets: boolean;
  fixtureAvailable: boolean;
  note: string;
};

export type PublicDocsRecipesFixtureResult = {
  id: string;
  status: 'pass' | 'fail';
  mode: 'fixture';
  commandsChecked: string[];
  requiresSecrets: boolean;
  mutatesHost: boolean;
  evidence: string[];
};

export type PublicDocsRecipesSnapshot = {
  gate: 'public-docs-recipes';
  surface: 'public-docs-recipes';
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
  routes: ['/docs', '/examples'];
  recipes: PublicDocsRecipe[];
  troubleshooting: PublicDocsTroubleshootingSymptom[];
  noSecretsMatrix: PublicDocsNoSecretsCapability[];
  artifacts: {
    fixtureSmokePath: string;
  };
  checks: PublicDocsRecipesCheck[];
  nextRecommendedGate: {
    gate: 'pilot-loop';
    title: string;
    reason: string;
  };
};

export const PUBLIC_DOCS_RECIPES_REQUIRED_CORE_SCRIPTS = [
  'external-docs',
  'qa:external-docs',
  'public-docs-recipes',
  'qa:public-docs-recipes',
  'go',
  'chat',
  'doctor',
  'status:fast',
  'release:status:fast',
  'release:rollback-preview',
  'distribution-hardening',
  'feedback:preview',
  'website:build',
] as const;

export const PUBLIC_DOCS_RECIPES_REQUIRED_WEBSITE_FILES = [
  'app/docs/page.tsx',
  'app/examples/page.tsx',
  'data/external-docs.ts',
  'scripts/external-docs-check.mjs',
] as const;

export const PUBLIC_DOCS_RECIPES_REQUIRED_TERMS = [
  'Quickstart',
  'Examples',
  'Troubleshooting',
  'Approvals',
  'artifacts',
  'replay',
  'fixture',
  'npm install',
  'npm run go',
  'npm run chat',
  'npm run release:status:fast',
  '/start',
  '/demo',
  '/release',
  '/feedback',
] as const;

export const PUBLIC_DOCS_RECIPES_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'autonomous without approval',
  'without limits',
  'real secret required',
  'telemetry ligada por default',
  'cloud required to use',
] as const;

export const PUBLIC_DOCS_RECIPES: PublicDocsRecipe[] = [
  {
    id: 'quickstart-first-result',
    title: 'Quickstart to the first verifiable result',
    audience: 'Person evaluating Zavorth locally',
    useCase: 'quickstart',
    prerequisites: [
      'Node.js 18 or newer',
      'Open local workspace',
      'No required secrets',
    ],
    commands: [
      'npm install',
      'npm run go',
      'npm run doctor',
    ],
    expectedResult: 'First local health/readiness result with a clear next action.',
    fixtureMode: true,
    requiresSecrets: false,
    previewFirst: true,
    risk: 'low',
    evidence: ['docs#quickstart', 'start route', 'doctor command'],
  },
  {
    id: 'engineering-approval-loop',
    title: 'Autonomous engineering with approval and a small patch',
    audience: 'local developer',
    useCase: 'engineering',
    prerequisites: [
      'local repo with git',
      'Permission to review diff before applying',
      'Credential-free task fixture',
    ],
    commands: [
      'npm run chat',
      'npm run status:fast',
    ],
    expectedResult: 'Plan, preview, reviewable diff, and documented validation.',
    fixtureMode: true,
    requiresSecrets: false,
    previewFirst: true,
    risk: 'medium',
    evidence: ['examples#engineering', 'approval guardrail', 'artifact trail'],
  },
  {
    id: 'release-readiness-audit',
    title: 'Release readiness before publishing',
    audience: 'Release operator',
    useCase: 'release',
    prerequisites: [
      'Baseline v1.0.0 present',
      'local gates installed',
      'No publish token required for auditing',
    ],
    commands: [
      'npm run release:status:fast',
      'npm run distribution-hardening -- --manifest',
      'npm run release:rollback-preview',
    ],
    expectedResult: 'Release status, manifest digest, and rollback preview without automatic publish.',
    fixtureMode: true,
    requiresSecrets: false,
    previewFirst: true,
    risk: 'medium',
    evidence: ['release route', 'distribution manifest', 'rollback preview'],
  },
  {
    id: 'replay-artifact-review',
    title: 'Audit artifacts and replay for a delivery',
    audience: 'Technical reviewer',
    useCase: 'replay-artifacts',
    prerequisites: [
      'local artifact/replay or fixture',
      'Sensitive payload redacted',
      'No external sending by default',
    ],
    commands: [
      'npm run artifact:workbench',
      'npm run qa:artifact-workbench',
    ],
    expectedResult: 'local evidence, redacted replay, and verifiable result.',
    fixtureMode: true,
    requiresSecrets: false,
    previewFirst: true,
    risk: 'low',
    evidence: ['examples#replay-artifacts', 'artifact workbench', 'redacted replay'],
  },
];

export const PUBLIC_DOCS_TROUBLESHOOTING: PublicDocsTroubleshootingSymptom[] = [
  {
    id: 'install',
    symptom: 'Dependencies or initial build fail.',
    firstCheck: 'Confirm Node.js, npm install, and workspace permission.',
    safeCommand: 'npm run doctor',
    escalation: 'Run npm install again and repeat the indicated gate.',
  },
  {
    id: 'runtime',
    symptom: 'Runtime does not respond or has no next action.',
    firstCheck: 'Read local status and confirm profile/capability policy.',
    safeCommand: 'npm run status:fast',
    escalation: 'Use npm run doctor before trying autorepair.',
  },
  {
    id: 'site',
    symptom: 'Public site or exported routes look stale.',
    firstCheck: 'Isolated build with dist separated from next dev.',
    safeCommand: 'npm run website:build',
    escalation: 'Restart the dev server after the build and repeat smoke.',
  },
  {
    id: 'feedback',
    symptom: 'Feedback or telemetry appears to collect too much data.',
    firstCheck: 'Open a redacted preview before any send.',
    safeCommand: 'npm run feedback:preview',
    escalation: 'Use local revoke/delete and do not send sensitive payload.',
  },
];

export const PUBLIC_DOCS_NO_SECRETS_MATRIX: PublicDocsNoSecretsCapability[] = [
  {
    id: 'first-run',
    label: 'local first run',
    command: 'npm run go',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Detection, preview, and local health check work without external credentials.',
  },
  {
    id: 'public-demo',
    label: 'Public demo',
    command: 'npm run public-demo',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Guided story uses fixture, approval, and redacted replay.',
  },
  {
    id: 'release-audit',
    label: 'Release audit',
    command: 'npm run distribution-hardening',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Manifest, checksums, and installer preview are local.',
  },
  {
    id: 'feedback-preview',
    label: 'Feedback preview',
    command: 'npm run feedback:preview',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Preview and redaction run before any external send.',
  },
  {
    id: 'external-publish',
    label: 'External publishing',
    command: 'npm run remote:publish',
    runsWithoutSecrets: false,
    fixtureAvailable: false,
    note: 'Real publishing requires destination credentials and stays outside the quickstart.',
  },
];
