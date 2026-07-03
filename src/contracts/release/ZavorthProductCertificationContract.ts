export const ZAVORTH_PRODUCT_CERTIFICATION_VERSION = '2026-06-02.product-certification.v1' as const;

export type ZavorthProductCertificationStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthProductCertificationGate = {
  id: string;
  label: string;
  status: ZavorthProductCertificationStatus;
  summary: string;
  evidence: string[];
  nextAction: string | null;
};

export type ZavorthProductCertificationSnapshot = {
  contractVersion: typeof ZAVORTH_PRODUCT_CERTIFICATION_VERSION;
  schemaVersion: 1;
  surface: 'product-certification';
  generatedAt: string;
  status: ZavorthProductCertificationStatus;
  productLanguage: {
    name: 'Zavorth';
    positioning: 'local operating system for AI agents';
    userPromise: string;
    operatingLoop: string[];
  };
  summary: {
    gates: number;
    ready: number;
    attention: number;
    blocked: number;
    liveCredentialGated: number;
  };
  gates: ZavorthProductCertificationGate[];
  userJourney: Array<{
    step: number;
    label: string;
    command: string;
    expectedResult: string;
  }>;
  dailyUx: {
    primarySurface: 'zavorthControl';
    terminalSurface: 'zavorth tui';
    readyCommand: 'zavorth ready --product';
    certificationCommand: 'npm run qa:zavorth-product-certification --silent';
  };
  safety: {
    noSilentRiskyMutation: true;
    missingCredentialsAreSetupState: true;
    productDocsAvoidInternalPhaseLanguage: true;
    cleanInstallUsesIsolatedHome: true;
    llmReceivesCanonicalKernelSnapshot: true;
  };
};
