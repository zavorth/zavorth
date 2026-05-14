export type FeedbackTelemetryCheckStatus = 'pass' | 'warn' | 'fail';

export type FeedbackTelemetryCheck = {
  id: string;
  title: string;
  status: FeedbackTelemetryCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type FeedbackTelemetryScreenshotSpec = {
  id: 'desktop' | 'mobile';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type FeedbackTelemetryContractSnapshot = {
  phase: '52';
  surface: 'feedback-loop';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  route: '/feedback';
  fixturePath: 'data/feedback-loop.ts';
  requiredCommands: string[];
  screenshots: FeedbackTelemetryScreenshotSpec[];
  checks: FeedbackTelemetryCheck[];
  nextRecommendedPhase: {
    phase: 'complete';
    title: string;
    reason: string;
  };
};

export const FEEDBACK_TELEMETRY_REQUIRED_COPY = [
  'Feedback, telemetry opt-in and product loop',
  'Telemetry desligada por padrao',
  'Feedback opt-in',
  'preview redigido',
  'revoke/delete local',
  'Product feedback ledger',
  'product-feedback-ledger.json',
  'feedback-preview-redacted.json',
  'issue/report template',
  'agregador sem payload sensivel',
  'sem depender de cloud obrigatoria',
] as const;

export const FEEDBACK_TELEMETRY_REQUIRED_COMMANDS = [
  'feedback:preview',
  'feedback:revoke',
  'feedback:delete',
] as const;

export const FEEDBACK_TELEMETRY_REQUIRED_LINKS = [
  '/feedback',
  '/docs#feedback-loop',
  '/privacy',
  '/release',
] as const;

export const FEEDBACK_TELEMETRY_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'telemetry ligada por padrao',
  'envio automatico',
  'sem opt-in',
  'sem redaction',
  'payload bruto enviado',
] as const;

export const FEEDBACK_TELEMETRY_SCREENSHOTS: FeedbackTelemetryScreenshotSpec[] = [
  {
    id: 'desktop',
    fileName: 'feedback-loop-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'mobile',
    fileName: 'feedback-loop-mobile.png',
    viewport: { width: 390, height: 1200 },
  },
];
