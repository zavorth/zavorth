export const ZAVORTH_DASHBOARD_VISUAL_QA_VERSION = 'zavorth-dashboard-visual-qa.v1' as const;

export type ZavorthDashboardVisualQaStatus = 'evidence-ready' | 'plan-ready' | 'blocked';

export type ZavorthDashboardVisualQaViewport = {
  id: 'desktop' | 'mobile';
  width: number;
  height: number;
};

export type ZavorthDashboardVisualQaScenario = {
  id: string;
  label: string;
  route: string;
  fixture: string;
  requiredEvidence: string[];
};

export type ZavorthDashboardVisualQaArtifact = {
  id: string;
  path: string;
  type: 'html' | 'png' | 'json';
  exists: boolean;
};

export type ZavorthDashboardVisualQaSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_DASHBOARD_VISUAL_QA_VERSION;
  status: ZavorthDashboardVisualQaStatus;
  summary: {
    scenarios: number;
    viewports: number;
    artifactsPresent: number;
    artifactsExpected: number;
    evidenceReady: boolean;
  };
  viewports: ZavorthDashboardVisualQaViewport[];
  scenarios: ZavorthDashboardVisualQaScenario[];
  artifacts: ZavorthDashboardVisualQaArtifact[];
  commands: {
    report: string;
    json: string;
    check: string;
    preview: string;
    capture: string;
    nextStep: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};
