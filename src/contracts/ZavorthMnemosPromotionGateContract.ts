export const ZAVORTH_MNEMOS_PROMOTION_GATE_VERSION = 'mnemos-promotion-gate-v1';

export type ZavorthMnemosPromotionStatus =
  | 'preview-ready'
  | 'applied'
  | 'blocked';

export type ZavorthMnemosPromotionCandidate = {
  id: string;
  targetPage: 'architecture' | 'dependencies' | 'memory' | 'operations' | 'providers' | 'skills';
  fact: string;
  source: string;
  confidence: number;
};

export type ZavorthMnemosPromotionConflict = {
  id: string;
  candidateId: string;
  existingFact: string;
  contradictionRule: string;
  recommendation: string;
};

export type ZavorthMnemosPromotionInput = {
  candidates?: ZavorthMnemosPromotionCandidate[] | null;
  apply?: boolean;
  approvalId?: string | null;
};

export type ZavorthMnemosPromotionSnapshot = {
  version: typeof ZAVORTH_MNEMOS_PROMOTION_GATE_VERSION;
  generatedAt: string;
  status: ZavorthMnemosPromotionStatus;
  candidates: ZavorthMnemosPromotionCandidate[];
  conflicts: ZavorthMnemosPromotionConflict[];
  apply: {
    requested: boolean;
    applied: boolean;
    approvalRequired: boolean;
    approvalSatisfied: boolean;
    approvalId: string | null;
    mutatedFiles: string[];
    blockers: string[];
  };
  safety: {
    secretsRedacted: true;
    provenanceLinked: true;
    dryRunDefault: true;
  };
  receipt: {
    id: string;
    durableMutation: boolean;
    approvalId: string | null;
  };
};
