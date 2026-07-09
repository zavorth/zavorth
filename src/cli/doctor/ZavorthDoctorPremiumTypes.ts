export type ZavorthDoctorPremiumStatus = 'pass' | 'warn' | 'fail';

export type ZavorthDoctorPremiumCheck = {
  id: string;
  title: string;
  status: ZavorthDoctorPremiumStatus;
  summary: string;
  impact: string;
  fixCommand: string | null;
  canAutoFix: boolean;
  evidence?: string[];
};

export type ZavorthDoctorPremiumSnapshot = {
  contractVersion: 'zavorth-doctor-premium/1';
  generatedAt: string;
  projectRoot: string;
  status: ZavorthDoctorPremiumStatus;
  summary: {
    pass: number;
    warn: number;
    fail: number;
    total: number;
  };
  checks: ZavorthDoctorPremiumCheck[];
  nextActions: Array<{
    label: string;
    command: string;
    detail?: string;
  }>;
  safety: {
    noSecretInOutput: true;
    noRuntimeStart: true;
    fixRequiresExplicitFlag: true;
  };
};
