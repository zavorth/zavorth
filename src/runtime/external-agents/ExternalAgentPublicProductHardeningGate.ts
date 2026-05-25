export const EXTERNAL_AGENT_PUBLIC_PRODUCT_HARDENING_RULES = {
  sourceIdentityAllowedOnlyInCompatibilitySurfaces: true,
  adoptedCapabilitiesRequireCoverage: true,
  externalizedCapabilitiesRequireHealthModel: true,
  rejectedCapabilitiesRequireReason: true,
  releaseChecklistMustPass: true,
  securityReviewMustPass: true,
  dashboardMustBePrimaryZavorthSurface: true,
} as const;

export type ExternalAgentPublicSurfaceKind =
  | 'canonical-zavorth-source'
  | 'adapter-detail'
  | 'compatibility-doc'
  | 'compatibility-route'
  | 'inventory-evidence'
  | 'release-checklist';

export type ExternalAgentPublicSurface = {
  id: string;
  label: string;
  path: string;
  kind: ExternalAgentPublicSurfaceKind;
  content: string;
};

export type ExternalAgentPublicSurfaceIdentityFinding = {
  surfaceId: string;
  label: string;
  path: string;
  kind: ExternalAgentPublicSurfaceKind;
  term: string;
  excerpt: string;
};

export type ExternalAgentCapabilityDecision =
  | 'absorb'
  | 'adapt'
  | 'replace'
  | 'externalize'
  | 'reject';

export type ExternalAgentPublicCapabilityMatrixItem = {
  id: string;
  label: string;
  decision: ExternalAgentCapabilityDecision;
  publicBehavior: string;
  securityBoundary: string;
  acceptanceCriteria: string[];
  testsOrSmokes: string[];
  status: 'complete' | 'deferred' | 'blocked';
  healthAndFailureModel?: string;
  rejectReason?: string;
};

export type ExternalAgentProductHardeningChecklistCategory =
  | 'docs'
  | 'env-config'
  | 'dashboard'
  | 'release'
  | 'security'
  | 'capability-matrix';

export type ExternalAgentProductHardeningChecklistItem = {
  id: string;
  label: string;
  category: ExternalAgentProductHardeningChecklistCategory;
  status: 'pass' | 'blocked';
  evidence: string[];
};

export type ExternalAgentDashboardProductGate = {
  primarySurface: boolean;
  workflowIds: string[];
  sourceIdentityLeakScanPassed: boolean;
  cloneIndicators: string[];
};

export type ExternalAgentPublicProductHardeningOptions = {
  now?: () => Date;
  forbiddenSourceTerms?: string[];
};

export type ExternalAgentCapabilityMatrixFinding = {
  itemId: string;
  label: string;
  reason: string;
};

export type ExternalAgentPublicProductHardeningReport = {
  version: 'external-agent-public-product-hardening-report/v1';
  status: 'pass' | 'blocked';
  generatedAt: string;
  surfaceScan: {
    checked: number;
    canonicalLeaks: ExternalAgentPublicSurfaceIdentityFinding[];
    compatibilityMentions: ExternalAgentPublicSurfaceIdentityFinding[];
  };
  capabilityMatrix: {
    total: number;
    complete: boolean;
    findings: ExternalAgentCapabilityMatrixFinding[];
  };
  checklist: {
    total: number;
    passed: number;
    blocked: number;
    missingCategories: ExternalAgentProductHardeningChecklistCategory[];
  };
  dashboard: {
    primarySurface: boolean;
    workflowCoveragePassed: boolean;
    identityLeakScanPassed: boolean;
    cloneIndicators: string[];
  };
  guarantee: {
    publicCanonicalSurfacesZavorthNative: boolean;
    everyAdoptedCapabilityHasCoverage: boolean;
    releaseChecklistComplete: boolean;
    securityReviewComplete: boolean;
    dashboardIsPrimaryProductSurface: boolean;
  };
};

const REQUIRED_CHECKLIST_CATEGORIES: ExternalAgentProductHardeningChecklistCategory[] = [
  'docs',
  'env-config',
  'dashboard',
  'release',
  'security',
  'capability-matrix',
];

const REQUIRED_COMMAND_CENTER_WORKFLOWS = [
  'sessions.resume',
  'channels.review',
  'capabilities.review',
  'runtime.doctor',
];

const COMPATIBILITY_SURFACE_KINDS = new Set<ExternalAgentPublicSurfaceKind>([
  'adapter-detail',
  'compatibility-doc',
  'compatibility-route',
  'inventory-evidence',
]);

function nowIso(now?: () => Date): string {
  return (now || (() => new Date()))().toISOString();
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function buildExcerpt(content: string, term: string): string {
  const index = content.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) {
    return '';
  }
  const start = Math.max(0, index - 40);
  const end = Math.min(content.length, index + term.length + 40);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

function findSurfaceIdentityMentions(
  surface: ExternalAgentPublicSurface,
  forbiddenTerms: string[],
): ExternalAgentPublicSurfaceIdentityFinding[] {
  return forbiddenTerms
    .map((term) => normalizeText(term))
    .filter(Boolean)
    .filter((term) => surface.content.toLowerCase().includes(term.toLowerCase()))
    .map((term) => ({
      surfaceId: surface.id,
      label: surface.label,
      path: surface.path,
      kind: surface.kind,
      term,
      excerpt: buildExcerpt(surface.content, term),
    }));
}

function evaluateCapabilityMatrix(
  items: ExternalAgentPublicCapabilityMatrixItem[],
): ExternalAgentCapabilityMatrixFinding[] {
  return items.flatMap((item) => {
    const findings: ExternalAgentCapabilityMatrixFinding[] = [];
    if (item.status !== 'complete') {
      findings.push({
        itemId: item.id,
        label: item.label,
        reason: 'Capability matrix item must be complete before the public hardening gate passes.',
      });
    }
    if (item.acceptanceCriteria.length === 0) {
      findings.push({
        itemId: item.id,
        label: item.label,
        reason: 'Capability matrix item requires acceptance criteria.',
      });
    }
    if (item.decision === 'absorb' || item.decision === 'adapt' || item.decision === 'replace') {
      if (item.testsOrSmokes.length === 0) {
        findings.push({
          itemId: item.id,
          label: item.label,
          reason: 'Adopted capability requires at least one test or smoke command.',
        });
      }
    }
    if (item.decision === 'externalize' && !normalizeText(item.healthAndFailureModel)) {
      findings.push({
        itemId: item.id,
        label: item.label,
        reason: 'Externalized capability requires a health and failure model.',
      });
    }
    if (item.decision === 'reject' && !normalizeText(item.rejectReason)) {
      findings.push({
        itemId: item.id,
        label: item.label,
        reason: 'Rejected capability requires a documented reason.',
      });
    }
    return findings;
  });
}

function missingChecklistCategories(
  items: ExternalAgentProductHardeningChecklistItem[],
): ExternalAgentProductHardeningChecklistCategory[] {
  const passingCategories = new Set(
    items
      .filter((item) => item.status === 'pass')
      .map((item) => item.category),
  );
  return REQUIRED_CHECKLIST_CATEGORIES.filter((category) => !passingCategories.has(category));
}

function dashboardWorkflowCoveragePassed(gate: ExternalAgentDashboardProductGate): boolean {
  const workflows = new Set(gate.workflowIds);
  return REQUIRED_COMMAND_CENTER_WORKFLOWS.every((workflowId) => workflows.has(workflowId));
}

export function evaluateExternalAgentPublicProductHardeningGate(input: {
  surfaces: ExternalAgentPublicSurface[];
  capabilityMatrix: ExternalAgentPublicCapabilityMatrixItem[];
  checklist: ExternalAgentProductHardeningChecklistItem[];
  dashboard: ExternalAgentDashboardProductGate;
}, options: ExternalAgentPublicProductHardeningOptions = {}): ExternalAgentPublicProductHardeningReport {
  const forbiddenTerms = options.forbiddenSourceTerms || [];
  const allMentions = input.surfaces.flatMap((surface) => findSurfaceIdentityMentions(surface, forbiddenTerms));
  const compatibilityMentions = allMentions.filter((mention) => COMPATIBILITY_SURFACE_KINDS.has(mention.kind));
  const canonicalLeaks = allMentions.filter((mention) => !COMPATIBILITY_SURFACE_KINDS.has(mention.kind));
  const capabilityFindings = evaluateCapabilityMatrix(input.capabilityMatrix);
  const missingCategories = missingChecklistCategories(input.checklist);
  const blockedChecklistItems = input.checklist.filter((item) => item.status === 'blocked').length;
  const workflowCoveragePassed = dashboardWorkflowCoveragePassed(input.dashboard);
  const releaseChecklistComplete = missingCategories.length === 0 && blockedChecklistItems === 0;
  const securityReviewComplete = input.checklist.some((item) => item.category === 'security' && item.status === 'pass')
    && blockedChecklistItems === 0;
  const dashboardIsPrimaryProductSurface = input.dashboard.primarySurface
    && input.dashboard.sourceIdentityLeakScanPassed
    && workflowCoveragePassed
    && input.dashboard.cloneIndicators.length === 0;
  const guarantee = {
    publicCanonicalSurfacesZavorthNative: canonicalLeaks.length === 0,
    everyAdoptedCapabilityHasCoverage: capabilityFindings.length === 0,
    releaseChecklistComplete,
    securityReviewComplete,
    dashboardIsPrimaryProductSurface,
  };
  const status = Object.values(guarantee).every(Boolean) ? 'pass' : 'blocked';

  return {
    version: 'external-agent-public-product-hardening-report/v1',
    status,
    generatedAt: nowIso(options.now),
    surfaceScan: {
      checked: input.surfaces.length,
      canonicalLeaks,
      compatibilityMentions,
    },
    capabilityMatrix: {
      total: input.capabilityMatrix.length,
      complete: capabilityFindings.length === 0,
      findings: capabilityFindings,
    },
    checklist: {
      total: input.checklist.length,
      passed: input.checklist.filter((item) => item.status === 'pass').length,
      blocked: blockedChecklistItems,
      missingCategories,
    },
    dashboard: {
      primarySurface: input.dashboard.primarySurface,
      workflowCoveragePassed,
      identityLeakScanPassed: input.dashboard.sourceIdentityLeakScanPassed,
      cloneIndicators: input.dashboard.cloneIndicators,
    },
    guarantee,
  };
}
