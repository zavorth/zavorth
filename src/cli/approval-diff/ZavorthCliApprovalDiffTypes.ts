import type { ZavorthMutationRiskLevel, ZavorthMutationStatus } from '../../contracts/ZavorthMutationPlaneContract.js';

export type ZavorthCliApprovalCard = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  actionId: string;
  status: ZavorthMutationStatus;
  riskLevel: ZavorthMutationRiskLevel;
  approvalStatus: string;
  approvalReason: string;
  requestedBy: string | null;
  sourceSurface: string | null;
  expiresAt: string;
  resourceImpact: {
    ramMb: number;
    diskMb: number;
    processCount: number;
    externalExposure: string;
    recurring: boolean;
  };
  readiness: {
    total: number;
    blocked: number;
    warning: number;
    passed: number;
  };
  validationPlan: string[];
  rollbackPlan: string[];
  commands: string[];
  files: string[];
  diffCount: number;
};

export type ZavorthCliDiffEntry = {
  id: string;
  planId: string;
  path: string;
  riskLevel: string;
  summary: string;
  before: string | null;
  after: string | null;
};

export type ZavorthCliApprovalDiffSnapshot = {
  contractVersion: 'zavorth-cli-approval-diff/1';
  generatedAt: string;
  projectRoot: string;
  view: 'approvals' | 'diff';
  targetPlanId: string | null;
  summary: {
    total: number;
    pending: number;
    approved: number;
    blocked: number;
    expired: number;
    diffEntries: number;
  };
  cards: ZavorthCliApprovalCard[];
  diffs: ZavorthCliDiffEntry[];
  decision: {
    attempted: boolean;
    status: 'none' | 'approved' | 'missing_confirmation' | 'not_found' | 'unsupported';
    planId: string | null;
    message: string;
  };
  safety: {
    noHostApply: true;
    approvalRequiresYes: true;
    secretsRedacted: true;
    diffIsPreviewOnly: true;
  };
  nextActions: Array<{
    label: string;
    command: string;
    detail?: string;
  }>;
};
