export type ProductEvidenceLocaleText = {
  'en-US': string;
  'pt-BR': string;
  [locale: string]: string;
};

export type ProductEvidenceClaimManifest = {
  id: string;
  category: string;
  claim: ProductEvidenceLocaleText;
  evidence: {
    script: string;
    artifacts: string[];
    maxAgeHours: number;
  };
  provenance: {
    source: string;
    owner: string;
  };
};

export type ProductEvidenceExecution = {
  script: string;
  exitCode: number | null;
  completedAt: string;
  outputDigest: string;
  artifactsPresent: string[];
};

export type ProductEvidenceClaimStatus = 'verified' | 'unverified';

export type ProductEvidenceScorecardClaim = {
  id: string;
  status: ProductEvidenceClaimStatus;
  marketable: boolean;
  text: string;
  reasons: string[];
};

export type ProductEvidenceScorecardResult = {
  claims: ProductEvidenceScorecardClaim[];
  status: ProductEvidenceClaimStatus;
  locale: string;
  benchmarkPolicy: {
    externalScoresAssigned: boolean;
  };
};
