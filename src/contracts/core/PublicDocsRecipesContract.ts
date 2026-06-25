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
  phase: '56';
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
  nextRecommendedPhase: {
    phase: '57';
    title: string;
    reason: string;
  };
};

export const PUBLIC_DOCS_RECIPES_REQUIRED_CORE_SCRIPTS = [
  'external-docs',
  'qa:external-docs',
  'public-docs-recipes',
  'qa:public-docs-recipes',
  'qa:phase:56',
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
  'autonomo sem aprovacao',
  'sem limites',
  'segredo real obrigatorio',
  'telemetry ligada por padrao',
  'cloud obrigatoria para usar',
] as const;

export const PUBLIC_DOCS_RECIPES: PublicDocsRecipe[] = [
  {
    id: 'quickstart-first-result',
    title: 'Quickstart ate primeiro resultado verificavel',
    audience: 'Pessoa avaliando o Zavorth localmente',
    useCase: 'quickstart',
    prerequisites: [
      'Node.js 18 ou mais recente',
      'Workspace local aberto',
      'Sem secrets obrigatorios',
    ],
    commands: [
      'npm install',
      'npm run go',
      'npm run doctor',
    ],
    expectedResult: 'Primeiro health/readiness local com next action claro.',
    fixtureMode: true,
    requiresSecrets: false,
    previewFirst: true,
    risk: 'low',
    evidence: ['docs#quickstart', 'start route', 'doctor command'],
  },
  {
    id: 'engineering-approval-loop',
    title: 'Engenharia autonoma com approval e patch pequeno',
    audience: 'Desenvolvedor local',
    useCase: 'engineering',
    prerequisites: [
      'Repo local com git',
      'Permissao para revisar diff antes de aplicar',
      'Fixture de tarefa sem credenciais',
    ],
    commands: [
      'npm run chat',
      'npm run status:fast',
    ],
    expectedResult: 'Plano, preview, diff revisavel e validacao documentada.',
    fixtureMode: true,
    requiresSecrets: false,
    previewFirst: true,
    risk: 'medium',
    evidence: ['examples#engineering', 'approval guardrail', 'artifact trail'],
  },
  {
    id: 'release-readiness-audit',
    title: 'Release readiness antes de publicar',
    audience: 'Operador de release',
    useCase: 'release',
    prerequisites: [
      'Baseline v1.0.0 presente',
      'Gates locais instalados',
      'Nenhum token de publish necessario para auditar',
    ],
    commands: [
      'npm run release:status:fast',
      'npm run distribution-hardening -- --manifest',
      'npm run release:rollback-preview',
    ],
    expectedResult: 'Status de release, manifest digest e rollback preview sem publish automatico.',
    fixtureMode: true,
    requiresSecrets: false,
    previewFirst: true,
    risk: 'medium',
    evidence: ['release route', 'distribution manifest', 'rollback preview'],
  },
  {
    id: 'replay-artifact-review',
    title: 'Auditar artifacts e replay de uma entrega',
    audience: 'Revisor tecnico',
    useCase: 'replay-artifacts',
    prerequisites: [
      'Artifact/replay local ou fixture',
      'Payload sensivel redigido',
      'Sem envio externo por padrao',
    ],
    commands: [
      'npm run artifact:workbench',
      'npm run qa:artifact-workbench',
    ],
    expectedResult: 'Evidencias locais, replay redigido e resultado verificavel.',
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
    symptom: 'Dependencias ou build inicial falham.',
    firstCheck: 'Confirmar Node.js, npm install e permissao do workspace.',
    safeCommand: 'npm run doctor',
    escalation: 'Rodar npm install novamente e repetir o gate indicado.',
  },
  {
    id: 'runtime',
    symptom: 'Runtime nao responde ou fica sem next action.',
    firstCheck: 'Ler status local e confirmar perfil/capability policy.',
    safeCommand: 'npm run status:fast',
    escalation: 'Usar npm run doctor antes de tentar autorepair.',
  },
  {
    id: 'site',
    symptom: 'Site publico ou rotas exportadas parecem stale.',
    firstCheck: 'Build isolado com dist separado de next dev.',
    safeCommand: 'npm run website:build',
    escalation: 'Reiniciar dev server depois do build e repetir smoke.',
  },
  {
    id: 'feedback',
    symptom: 'Feedback ou telemetry parecem coletar dado demais.',
    firstCheck: 'Abrir preview redigido antes de qualquer envio.',
    safeCommand: 'npm run feedback:preview',
    escalation: 'Usar revoke/delete local e nao enviar payload sensivel.',
  },
];

export const PUBLIC_DOCS_NO_SECRETS_MATRIX: PublicDocsNoSecretsCapability[] = [
  {
    id: 'first-run',
    label: 'Primeiro uso local',
    command: 'npm run go',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Deteccao, preview e health check local funcionam sem credencial externa.',
  },
  {
    id: 'public-demo',
    label: 'Demo publica',
    command: 'npm run public-demo',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Historia guiada usa fixture, approval e replay redigido.',
  },
  {
    id: 'release-audit',
    label: 'Auditoria de release',
    command: 'npm run distribution-hardening',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Manifest, checksums e installer preview sao locais.',
  },
  {
    id: 'feedback-preview',
    label: 'Feedback preview',
    command: 'npm run feedback:preview',
    runsWithoutSecrets: true,
    fixtureAvailable: true,
    note: 'Preview e redacao rodam antes de qualquer envio externo.',
  },
  {
    id: 'external-publish',
    label: 'Publicacao externa',
    command: 'npm run remote:publish',
    runsWithoutSecrets: false,
    fixtureAvailable: false,
    note: 'Publish real exige credenciais do destino e fica fora do quickstart.',
  },
];
