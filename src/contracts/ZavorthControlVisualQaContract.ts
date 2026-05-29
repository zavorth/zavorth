export const ZAVORTH_CONTROL_VISUAL_QA_VERSION = 'zavorth-control-visual-qa.v1' as const;

export type ZavorthControlVisualQaStatus = 'evidence-ready' | 'plan-ready' | 'blocked';

export type ZavorthControlVisualQaViewport = {
  id: 'desktop' | 'mobile';
  width: number;
  height: number;
};

export type ZavorthControlVisualQaScenario = {
  id: string;
  label: string;
  route: string;
  fixture: string;
  requiredEvidence: string[];
};

export type ZavorthControlVisualQaArtifact = {
  id: string;
  path: string;
  type: 'html' | 'png' | 'json';
  exists: boolean;
};

export type ZavorthControlVisualQaSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CONTROL_VISUAL_QA_VERSION;
  status: ZavorthControlVisualQaStatus;
  summary: {
    scenarios: number;
    viewports: number;
    artifactsPresent: number;
    artifactsExpected: number;
    evidenceReady: boolean;
  };
  viewports: ZavorthControlVisualQaViewport[];
  scenarios: ZavorthControlVisualQaScenario[];
  artifacts: ZavorthControlVisualQaArtifact[];
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
