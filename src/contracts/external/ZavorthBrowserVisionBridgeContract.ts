import type {
  ZavorthVisionControlPlaneSnapshot,
  ZavorthVisionPolicyDecision,
} from './ZavorthVisionControlPlaneContract.js';

export const ZAVORTH_BROWSER_VISION_BRIDGE_CONTRACT_VERSION =
  '2026-05-11.browser-vision-gate-2' as const;

export type ZavorthBrowserVisionAction =
  | 'browser.status'
  | 'browser.inspect'
  | 'browser.plan'
  | 'browser.apply';

export type ZavorthBrowserVisionStatus =
  | 'ready'
  | 'redacted'
  | 'blocked'
  | 'approval-required'
  | 'sidecar-unconfigured';

export type ZavorthBrowserEvidenceSource =
  | 'dom'
  | 'aria'
  | 'pdf'
  | 'sidecar-dom'
  | 'screenshot-needed'
  | 'operator-provided'
  | 'none';

export type ZavorthBrowserPlannedActionKind =
  | 'navigate'
  | 'inspect'
  | 'click'
  | 'fill'
  | 'submit'
  | 'download_pdf'
  | 'read_pdf';

export type ZavorthBrowserVisionInput = {
  action?: ZavorthBrowserVisionAction;
  url?: string | null;
  selector?: string | null;
  requestText?: string | null;
  domText?: string | null;
  ariaText?: string | null;
  htmlText?: string | null;
  pdfText?: string | null;
  screenshotText?: string | null;
  planId?: string | null;
  approvalId?: string | null;
  sourceSurface?: string | null;
  actorId?: string | null;
  live?: boolean;
  allowPrivateEgress?: boolean;
  timeoutMs?: number | null;
};

export type ZavorthBrowserVisionPlanStep = {
  id: string;
  kind: ZavorthBrowserPlannedActionKind;
  label: string;
  selector: string | null;
  valuePreview: string | null;
  risk: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  mutation: boolean;
};

export type ZavorthBrowserVisionReceipt = {
  id: string;
  kind: 'policy' | 'egress' | 'sidecar' | 'dom' | 'pdf' | 'plan' | 'apply';
  status: ZavorthVisionPolicyDecision | 'done' | 'blocked' | 'approval-required' | 'skipped';
  reason: string;
  rawSecretSerialized: false;
};

export type ZavorthBrowserVisionBridgeSnapshot = {
  contractVersion: typeof ZAVORTH_BROWSER_VISION_BRIDGE_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthBrowserVisionBridgeService';
  status: ZavorthBrowserVisionStatus;
  action: ZavorthBrowserVisionAction;
  target: {
    url: string | null;
    origin: string | null;
    selector: string | null;
    title: string | null;
    sourceSurface: string;
  };
  sidecar: {
    configured: boolean;
    used: boolean;
    isolated: boolean;
    runtime: 'browser-sidecar' | 'preview-only';
    actionLog: string[];
    error: string | null;
  };
  evidence: {
    preferredSource: ZavorthBrowserEvidenceSource;
    structuredDomPreferred: true;
    screenshotUsed: false;
    screenshotOnlyWhenDomInsufficient: true;
    untrustedWrapped: true;
    redactionApplied: boolean;
    redactionCount: number;
    promptInjectionQuarantined: boolean;
    pdfTreatedAsUntrusted: boolean;
    rawDomStored: false;
    rawScreenshotStored: false;
    excerpt: string;
  };
  plan: {
    id: string | null;
    status: 'none' | 'planned' | 'approval-required' | 'ready-to-apply' | 'applied-preview' | 'blocked';
    steps: ZavorthBrowserVisionPlanStep[];
    mutationRequested: boolean;
    approvalRequired: boolean;
    approvalId: string | null;
  };
  policy: {
    decision: ZavorthVisionPolicyDecision;
    profile: 'browser-vision-gate-2';
    reason: string;
    publicEgressAllowed: boolean;
    mutationAllowed: false;
    providerPayloadMinimized: true;
  };
  safety: {
    ssrfGuarded: true;
    privateNetworkBlockedByDefault: true;
    structuredDomPreferred: true;
    screenshotOnlyWhenDomInsufficient: true;
    noClickOrTypeWithoutApproval: true;
    noFormSubmitWithoutApproval: true;
    pdfIsUntrustedContent: true;
    subagentsReadOnlyMayReviewEvidence: true;
    rawSecretSerialized: false;
    liveMutationPerformed: false;
  };
  vision: ZavorthVisionControlPlaneSnapshot;
  receipts: ZavorthBrowserVisionReceipt[];
  commands: {
    status: '/computer browser status';
    inspect: '/vision browser inspect';
    plan: '/computer browser plan';
    apply: '/computer browser apply <plan>';
    nextAction: 'Approval gate - Governed Desktop Computer Use';
  };
  nextSafeAction: string;
};
