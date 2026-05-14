export type PublicAdoptionReadinessCheckStatus = 'pass' | 'warn' | 'fail';

export type PublicAdoptionReadinessCheck = {
  id: string;
  title: string;
  status: PublicAdoptionReadinessCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type PublicAdoptionReadinessEvidence = {
  kind: 'doc' | 'service' | 'script' | 'gate' | 'release' | 'website-route';
  path: string;
  phrase?: string;
};

export type PublicAdoptionReadinessClaim = {
  id: string;
  claim: string;
  evidence: PublicAdoptionReadinessEvidence[];
};

export type PublicAdoptionReadinessRisk = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
  evidencePath: string;
};

export type PublicAdoptionReadinessRunbookStep = {
  minute: string;
  label: string;
  route: string;
  proof: string;
  fallback: string;
};

export type PublicAdoptionReadinessSnapshot = {
  phase: '53';
  surface: 'public-adoption-readiness';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  projectRoot: string;
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
    readinessScore: number;
  };
  baseline: {
    release: 'v1.0.0';
    packageName: string;
    packageVersion: string;
    roadmapPath: 'docs/11-roadmap.md';
    planningPath: 'docs/76-public-adoption-architecture.md';
  };
  requiredScripts: string[];
  launchChecklist: PublicAdoptionReadinessCheck[];
  claims: PublicAdoptionReadinessClaim[];
  risks: PublicAdoptionReadinessRisk[];
  demoRunbook: PublicAdoptionReadinessRunbookStep[];
  checks: PublicAdoptionReadinessCheck[];
  nextRecommendedPhase: {
    phase: '54';
    title: string;
    reason: string;
  };
};

export const PUBLIC_ADOPTION_REQUIRED_CORE_SCRIPTS = [
  'website:public',
  'qa:website-public',
  'public-demo',
  'qa:public-demo',
  'first-run',
  'qa:first-run',
  'external-docs',
  'qa:external-docs',
  'distribution-policy',
  'qa:distribution-policy',
  'release-bundle',
  'qa:release-bundle',
  'feedback-loop',
  'qa:feedback-loop',
  'qa:public-product',
  'public-adoption',
  'qa:public-adoption',
  'qa:phase:53',
] as const;

export const PUBLIC_ADOPTION_REQUIRED_DOCS = [
  {
    path: 'README.md',
    phrase: 'Zavorth',
    label: 'README publico do runtime',
  },
  {
    path: 'docs/11-roadmap.md',
    phrase: 'Public Adoption And Release Operations 53-59',
    label: 'roadmap aponta para o ciclo 53-59',
  },
  {
    path: 'docs/75-public-productization-architecture.md',
    phrase: 'Fase 52',
    label: 'baseline publica 46-52',
  },
  {
    path: 'docs/76-public-adoption-architecture.md',
    phrase: 'Fase 53 - Public Adoption Readiness',
    label: 'planejamento da Fase 53',
  },
] as const;

export const PUBLIC_ADOPTION_CLAIMS: PublicAdoptionReadinessClaim[] = [
  {
    id: 'local-first-governed-runtime',
    claim: 'Zavorth e um runtime local-first governado, nao apenas uma landing.',
    evidence: [
      { kind: 'doc', path: 'README.md', phrase: 'local-first' },
      { kind: 'doc', path: 'docs/75-public-productization-architecture.md', phrase: 'local-first' },
    ],
  },
  {
    id: 'preview-approval-evidence',
    claim: 'A jornada publica promete preview, aprovacao e evidencia.',
    evidence: [
      { kind: 'doc', path: 'docs/75-public-productization-architecture.md', phrase: 'preview' },
      { kind: 'service', path: 'src/services/WebsitePublicContractService.ts', phrase: 'forbiddenClaims' },
    ],
  },
  {
    id: 'fixture-first-demo',
    claim: 'A demo publica pode funcionar com fixture quando secrets reais faltarem.',
    evidence: [
      { kind: 'service', path: 'src/services/PublicDemoContractService.ts', phrase: 'fixture' },
      { kind: 'script', path: 'scripts/public-demo.ts', phrase: 'PublicDemoContractService' },
    ],
  },
  {
    id: 'telemetry-opt-in',
    claim: 'Feedback e telemetry continuam opt-in e redigidos por padrao.',
    evidence: [
      { kind: 'service', path: 'src/services/FeedbackTelemetryContractService.ts', phrase: 'opt' },
      { kind: 'script', path: 'scripts/feedback-loop.ts', phrase: 'disabled-by-default' },
    ],
  },
  {
    id: 'verifiable-release',
    claim: 'Releases publicos precisam de bundle verificavel e rollback preview.',
    evidence: [
      { kind: 'service', path: 'src/services/PublicReleaseBundleContractService.ts', phrase: 'digest' },
      { kind: 'script', path: 'scripts/release-bundle.ts', phrase: 'PublicReleaseBundleContractService' },
    ],
  },
  {
    id: 'v1-release-train',
    claim: 'O proximo ciclo deve preservar v1.0.0 como baseline e planejar v1.x.',
    evidence: [
      { kind: 'doc', path: 'docs/76-public-adoption-architecture.md', phrase: 'v1.x Release Train' },
      { kind: 'release', path: 'package.json', phrase: '"version": "1.0.0"' },
    ],
  },
];

export const PUBLIC_ADOPTION_RISKS: PublicAdoptionReadinessRisk[] = [
  {
    id: 'website-not-present',
    title: 'Site publico pode nao existir em uma workspace nova.',
    severity: 'medium',
    mitigation: 'Usar ZAVORTH_WEBSITE_REPO_ROOT ou fixtures ate a Fase 54 fechar deploy/preview.',
    evidencePath: 'scripts/website-public.ts',
  },
  {
    id: 'secrets-missing',
    title: 'Usuario publico pode nao ter credenciais de integracao.',
    severity: 'medium',
    mitigation: 'Demo e examples devem ter fixtures e degradacao explicita.',
    evidencePath: 'src/services/PublicDemoContractService.ts',
  },
  {
    id: 'unsafe-feedback',
    title: 'Feedback publico pode capturar payload sensivel se for mal desenhado.',
    severity: 'high',
    mitigation: 'Manter telemetry opt-in, preview redigido, revoke/delete e ledger local.',
    evidencePath: 'src/services/FeedbackTelemetryContractService.ts',
  },
  {
    id: 'release-drift',
    title: 'Tag/release pode apontar para commit errado se o fluxo for manual.',
    severity: 'high',
    mitigation: 'Fase 59 exige politica v1.x e tags apontando para commit final em main.',
    evidencePath: 'docs/76-public-adoption-architecture.md',
  },
];

export const PUBLIC_ADOPTION_DEMO_RUNBOOK: PublicAdoptionReadinessRunbookStep[] = [
  {
    minute: '0-1',
    label: 'Abrir landing e explicar promessa local-first.',
    route: '/',
    proof: 'Hero, runtime, governance e CTAs publicos.',
    fallback: 'Usar contrato website-public quando o site nao estiver rodando.',
  },
  {
    minute: '1-3',
    label: 'Mostrar demo fixture-first.',
    route: '/demo',
    proof: 'Approval, artifact, replay, erro e rollback em fixture.',
    fallback: 'Rodar public-demo sem secrets reais.',
  },
  {
    minute: '3-5',
    label: 'Mostrar first run.',
    route: '/start',
    proof: 'Requisitos, preview, primeira execucao e cleanup.',
    fallback: 'Usar first-run contract e quickstart local.',
  },
  {
    minute: '5-7',
    label: 'Mostrar docs e examples.',
    route: '/docs',
    proof: 'Quickstart, seguranca, troubleshooting, engenharia e recipes.',
    fallback: 'Usar external-docs contract.',
  },
  {
    minute: '7-9',
    label: 'Mostrar release verificavel.',
    route: '/release',
    proof: 'Digest, installer preview, smoke e rollback preview.',
    fallback: 'Rodar release-bundle em modo fixture.',
  },
  {
    minute: '9-10',
    label: 'Fechar com feedback opt-in.',
    route: '/feedback',
    proof: 'Preview redigido, revoke/delete e telemetry desligada por padrao.',
    fallback: 'Rodar feedback-loop --preview.',
  },
];
