export const RUNTIME_ADAPTER_PUBLIC_PRODUCT_HARDENING_RULES = {
  sourceIdentityAllowedOnlyInCompatibilitySurfaces: true,
  adoptedCapabilitiesRequireCoverage: true,
  externalizedCapabilitiesRequireHealthModel: true,
  rejectedCapabilitiesRequireReason: true,
  releaseChecklistMustPass: true,
  securityReviewMustPass: true,
  zavorthControlMustBePrimaryZavorthSurface: true,
} as const;

export type RuntimeAdapterPublicSurfaceKind =
  | 'canonical-zavorth-source'
  | 'adapter-detail'
  | 'compatibility-doc'
  | 'compatibility-route'
  | 'inventory-evidence'
  | 'release-checklist';

export type RuntimeAdapterPublicSurface = {
  id: string;
  label: string;
  path: string;
  kind: RuntimeAdapterPublicSurfaceKind;
  content: string;
};

export type RuntimeAdapterPublicSurfaceIdentityFinding = {
  surfaceId: string;
  label: string;
  path: string;
  kind: RuntimeAdapterPublicSurfaceKind;
  term: string;
  excerpt: string;
};

export type RuntimeAdapterCapabilityDecision =
  | 'absorb'
  | 'adapt'
  | 'replace'
  | 'externalize'
  | 'reject';

export type RuntimeAdapterPublicCapabilityMatrixItem = {
  id: string;
  label: string;
  decision: RuntimeAdapterCapabilityDecision;
  publicBehavior: string;
  securityBoundary: string;
  acceptanceCriteria: string[];
  testsOrSmokes: string[];
  status: 'complete' | 'deferred' | 'blocked';
  healthAndFailureModel?: string;
  rejectReason?: string;
};

export type RuntimeAdapterProductHardeningChecklistCategory =
  | 'docs'
  | 'env-config'
  | 'zavorthControl'
  | 'release'
  | 'security'
  | 'capability-matrix';

export type RuntimeAdapterProductHardeningChecklistItem = {
  id: string;
  label: string;
  category: RuntimeAdapterProductHardeningChecklistCategory;
  status: 'pass' | 'blocked';
  evidence: string[];
};

export type RuntimeAdapterZavorthControlProductGate = {
  primarySurface: boolean;
  workflowIds: string[];
  sourceIdentityLeakScanPassed: boolean;
  cloneIndicators: string[];
};

export type RuntimeAdapterPublicProductHardeningOptions = {
  now?: () => Date;
  forbiddenSourceTerms?: string[];
};

export type RuntimeAdapterCapabilityMatrixFinding = {
  itemId: string;
  label: string;
  reason: string;
};

export type RuntimeAdapterPublicProductHardeningReport = {
  version: 'runtime-adapter-public-product-hardening-report/v1';
  status: 'pass' | 'blocked';
  generatedAt: string;
  surfaceScan: {
    checked: number;
    canonicalLeaks: RuntimeAdapterPublicSurfaceIdentityFinding[];
    compatibilityMentions: RuntimeAdapterPublicSurfaceIdentityFinding[];
  };
  capabilityMatrix: {
    total: number;
    complete: boolean;
    findings: RuntimeAdapterCapabilityMatrixFinding[];
  };
  checklist: {
    total: number;
    passed: number;
    blocked: number;
    missingCategories: RuntimeAdapterProductHardeningChecklistCategory[];
  };
  zavorthControl: {
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
    zavorthControlIsPrimaryProductSurface: boolean;
  };
};

const REQUIRED_CHECKLIST_CATEGORIES: RuntimeAdapterProductHardeningChecklistCategory[] = [
  'docs',
  'env-config',
  'zavorthControl',
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

const COMPATIBILITY_SURFACE_KINDS = new Set<RuntimeAdapterPublicSurfaceKind>([
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
  surface: RuntimeAdapterPublicSurface,
  forbiddenTerms: string[],
): RuntimeAdapterPublicSurfaceIdentityFinding[] {
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
  items: RuntimeAdapterPublicCapabilityMatrixItem[],
): RuntimeAdapterCapabilityMatrixFinding[] {
  return items.flatMap((item) => {
    const findings: RuntimeAdapterCapabilityMatrixFinding[] = [];
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
  items: RuntimeAdapterProductHardeningChecklistItem[],
): RuntimeAdapterProductHardeningChecklistCategory[] {
  const passingCategories = new Set(
    items
      .filter((item) => item.status === 'pass')
      .map((item) => item.category),
  );
  return REQUIRED_CHECKLIST_CATEGORIES.filter((category) => !passingCategories.has(category));
}

function zavorthControlWorkflowCoveragePassed(gate: RuntimeAdapterZavorthControlProductGate): boolean {
  const workflows = new Set(gate.workflowIds);
  return REQUIRED_COMMAND_CENTER_WORKFLOWS.every((workflowId) => workflows.has(workflowId));
}

export function evaluateRuntimeAdapterPublicProductHardeningGate(input: {
  surfaces: RuntimeAdapterPublicSurface[];
  capabilityMatrix: RuntimeAdapterPublicCapabilityMatrixItem[];
  checklist: RuntimeAdapterProductHardeningChecklistItem[];
  zavorthControl: RuntimeAdapterZavorthControlProductGate;
}, options: RuntimeAdapterPublicProductHardeningOptions = {}): RuntimeAdapterPublicProductHardeningReport {
  const forbiddenTerms = options.forbiddenSourceTerms || [];
  const allMentions = input.surfaces.flatMap((surface) => findSurfaceIdentityMentions(surface, forbiddenTerms));
  const compatibilityMentions = allMentions.filter((mention) => COMPATIBILITY_SURFACE_KINDS.has(mention.kind));
  const canonicalLeaks = allMentions.filter((mention) => !COMPATIBILITY_SURFACE_KINDS.has(mention.kind));
  const capabilityFindings = evaluateCapabilityMatrix(input.capabilityMatrix);
  const missingCategories = missingChecklistCategories(input.checklist);
  const blockedChecklistItems = input.checklist.filter((item) => item.status === 'blocked').length;
  const workflowCoveragePassed = zavorthControlWorkflowCoveragePassed(input.zavorthControl);
  const releaseChecklistComplete = missingCategories.length === 0 && blockedChecklistItems === 0;
  const securityReviewComplete = input.checklist.some((item) => item.category === 'security' && item.status === 'pass')
    && blockedChecklistItems === 0;
  const zavorthControlIsPrimaryProductSurface = input.zavorthControl.primarySurface
    && input.zavorthControl.sourceIdentityLeakScanPassed
    && workflowCoveragePassed
    && input.zavorthControl.cloneIndicators.length === 0;
  const guarantee = {
    publicCanonicalSurfacesZavorthNative: canonicalLeaks.length === 0,
    everyAdoptedCapabilityHasCoverage: capabilityFindings.length === 0,
    releaseChecklistComplete,
    securityReviewComplete,
    zavorthControlIsPrimaryProductSurface,
  };
  const status = Object.values(guarantee).every(Boolean) ? 'pass' : 'blocked';

  return {
    version: 'runtime-adapter-public-product-hardening-report/v1',
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
    zavorthControl: {
      primarySurface: input.zavorthControl.primarySurface,
      workflowCoveragePassed,
      identityLeakScanPassed: input.zavorthControl.sourceIdentityLeakScanPassed,
      cloneIndicators: input.zavorthControl.cloneIndicators,
    },
    guarantee,
  };
}
