export type ChannelExperienceCertificationStatus = 'certified' | 'usable' | 'partial' | 'missing';

export type ChannelExperienceCertificationCheckStatus = 'pass' | 'fail' | 'na';

export type ChannelExperienceCertificationCheck = {
  id: string;
  label: string;
  required: boolean;
  status: ChannelExperienceCertificationCheckStatus;
  detail: string;
  evidence: string[];
};

export type ChannelExperienceCertificationEntry = {
  channelId: string;
  label: string;
  status: ChannelExperienceCertificationStatus;
  readiness: string;
  transport: string;
  implementationState: string;
  score: {
    passed: number;
    required: number;
    percent: number;
  };
  summary: string;
  checks: ChannelExperienceCertificationCheck[];
  blockers: string[];
  referenceBaseline: string[];
  zavorthEvidence: string[];
  smokeCommands: string[];
};

export type ChannelExperienceCertificationSmokePlan = {
  globalCommands: string[];
  channelCommands: Array<{
    channelId: string;
    commands: string[];
  }>;
  notes: string[];
};

export type ChannelExperienceDashboardEvidence = {
  status: 'contract-ready' | 'blocked';
  note: string;
  routes: string[];
  requiredSurfaceItems: string[];
};

export type ChannelExperienceCertificationSnapshot = {
  generatedAt: string;
  contractVersion: 'channel-experience-certification.v1';
  profile: 'zavorth-channel-experience';
  summary: {
    total: number;
    certified: number;
    usable: number;
    partial: number;
    missing: number;
    blockers: number;
    requiredPassed: number;
    requiredTotal: number;
    releaseReady: boolean;
  };
  entries: ChannelExperienceCertificationEntry[];
  selected: ChannelExperienceCertificationEntry | null;
  smokePlan: ChannelExperienceCertificationSmokePlan;
  dashboardEvidence: ChannelExperienceDashboardEvidence;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
