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
    roadmapPath: 'docs/product-direction.md';
    planningPath: 'docs/product-direction.md';
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
    label: 'public runtime README',
  },
  {
    path: 'docs/product-direction.md',
    phrase: 'Public Adoption And Release Operations 53-59',
    label: 'roadmap points to cycle 53-59',
  },
  {
    path: 'docs/product-direction.md',
    phrase: 'Readiness checkpoint 2',
    label: 'public baseline 46-52',
  },
  {
    path: 'docs/product-direction.md',
    phrase: 'Readiness checkpoint 3 - Public Adoption Readiness',
    label: 'Readiness checkpoint 3 planning',
  },
] as const;

export const PUBLIC_ADOPTION_CLAIMS: PublicAdoptionReadinessClaim[] = [
  {
    id: 'local-first-governed-runtime',
    claim: 'Zavorth is a governed local-first runtime, not just a landing page.',
    evidence: [
      { kind: 'doc', path: 'README.md', phrase: 'local-first' },
      { kind: 'doc', path: 'docs/product-direction.md', phrase: 'local-first' },
    ],
  },
  {
    id: 'preview-approval-evidence',
    claim: 'The public journey promises preview, approval, and evidence.',
    evidence: [
      { kind: 'doc', path: 'docs/product-direction.md', phrase: 'preview' },
      { kind: 'service', path: 'src/services/WebsitePublicContractService.ts', phrase: 'forbiddenClaims' },
    ],
  },
  {
    id: 'fixture-first-demo',
    claim: 'The public demo can work with a fixture when real secrets are missing.',
    evidence: [
      { kind: 'service', path: 'src/services/PublicDemoContractService.ts', phrase: 'fixture' },
      { kind: 'script', path: 'scripts/public-demo.ts', phrase: 'PublicDemoContractService' },
    ],
  },
  {
    id: 'telemetry-opt-in',
    claim: 'Feedback and telemetry remain opt-in and redacted by default.',
    evidence: [
      { kind: 'service', path: 'src/services/FeedbackTelemetryContractService.ts', phrase: 'opt' },
      { kind: 'script', path: 'scripts/feedback-loop.ts', phrase: 'disabled-by-default' },
    ],
  },
  {
    id: 'verifiable-release',
    claim: 'Public releases need a verifiable bundle and rollback preview.',
    evidence: [
      { kind: 'service', path: 'src/services/PublicReleaseBundleContractService.ts', phrase: 'digest' },
      { kind: 'script', path: 'scripts/release-bundle.ts', phrase: 'PublicReleaseBundleContractService' },
    ],
  },
  {
    id: 'v1-release-train',
    claim: 'The next cycle must preserve v1.0.0 as the baseline and plan v1.x.',
    evidence: [
      { kind: 'doc', path: 'docs/product-direction.md', phrase: 'v1.x Release Train' },
      { kind: 'release', path: 'package.json', phrase: '"version": "1.0.0"' },
    ],
  },
];

export const PUBLIC_ADOPTION_RISKS: PublicAdoptionReadinessRisk[] = [
  {
    id: 'website-not-present',
    title: 'The public site may not exist in a new workspace.',
    severity: 'medium',
    mitigation: 'Use ZAVORTH_WEBSITE_REPO_ROOT or fixtures until Readiness checkpoint 4 closes deploy/preview.',
    evidencePath: 'scripts/website-public.ts',
  },
  {
    id: 'secrets-missing',
    title: 'A public user may not have integration credentials.',
    severity: 'medium',
    mitigation: 'Demo and examples must have fixtures and explicit degradation.',
    evidencePath: 'src/services/PublicDemoContractService.ts',
  },
  {
    id: 'unsafe-feedback',
    title: 'Public feedback can capture sensitive payload if poorly designed.',
    severity: 'high',
    mitigation: 'Keep telemetry opt-in, redacted preview, revoke/delete, and local ledger.',
    evidencePath: 'src/services/FeedbackTelemetryContractService.ts',
  },
  {
    id: 'release-drift',
    title: 'Tag/release can point to the wrong commit if the flow is manual.',
    severity: 'high',
    mitigation: 'Readiness checkpoint 9 requires v1.x policy and tags pointing to the final commit on main.',
    evidencePath: 'docs/product-direction.md',
  },
];

export const PUBLIC_ADOPTION_DEMO_RUNBOOK: PublicAdoptionReadinessRunbookStep[] = [
  {
    minute: '0-1',
    label: 'Open landing and explain the local-first promise.',
    route: '/',
    proof: 'Hero, runtime, governance, and public CTAs.',
    fallback: 'Use the website-public contract when the site is not running.',
  },
  {
    minute: '1-3',
    label: 'Show fixture-first demo.',
    route: '/demo',
    proof: 'Approval, artifact, replay, error, and rollback in fixture.',
    fallback: 'Run public-demo without real secrets.',
  },
  {
    minute: '3-5',
    label: 'Show first run.',
    route: '/start',
    proof: 'Requirements, preview, first execution, and cleanup.',
    fallback: 'Use first-run contract and local quickstart.',
  },
  {
    minute: '5-7',
    label: 'Show docs and examples.',
    route: '/docs',
    proof: 'Quickstart, security, troubleshooting, engineering, and recipes.',
    fallback: 'Use external-docs contract.',
  },
  {
    minute: '7-9',
    label: 'Show verifiable release.',
    route: '/release',
    proof: 'Digest, installer preview, smoke, and rollback preview.',
    fallback: 'Run release-bundle in fixture mode.',
  },
  {
    minute: '9-10',
    label: 'Close with opt-in feedback.',
    route: '/feedback',
    proof: 'Redacted preview, revoke/delete, and telemetry disabled by default.',
    fallback: 'Run feedback-loop --preview.',
  },
];
