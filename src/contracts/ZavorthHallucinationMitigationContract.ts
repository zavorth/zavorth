export const ZAVORTH_HALLUCINATION_MITIGATION_VERSION = 'zavorth-hallucination-mitigation.v1' as const;

export type ZavorthHallucinationMitigationStatus = 'allow' | 'mitigated' | 'needs-evidence';

export type ZavorthHallucinationGroundedness =
  | 'grounded'
  | 'partially-grounded'
  | 'unsupported'
  | 'not-applicable';

export type ZavorthHallucinationFindingStatus = 'pass' | 'warning' | 'fail';

export type ZavorthHallucinationFinding = {
  id: string;
  label: string;
  status: ZavorthHallucinationFindingStatus;
  detail: string;
};

export type ZavorthHallucinationMitigationInput = {
  requestText: string;
  responseText: string;
  channel?: string | null;
  evidenceTexts?: string[];
  toolReceiptCount?: number;
  allowGeneralKnowledge?: boolean;
};

export type ZavorthHallucinationMitigationReview = {
  contractVersion: typeof ZAVORTH_HALLUCINATION_MITIGATION_VERSION;
  status: ZavorthHallucinationMitigationStatus;
  groundedness: ZavorthHallucinationGroundedness;
  outputText: string;
  evidenceSensitive: boolean;
  highStakes: boolean;
  currentOrUnstable: boolean;
  sourceRequested: boolean;
  executionClaimWithoutReceipt: boolean;
  findings: ZavorthHallucinationFinding[];
  receipt: {
    channel: string | null;
    evidenceCount: number;
    toolReceiptCount: number;
    mitigatedAt: string;
  };
};
