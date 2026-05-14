import type {
  ZavorthVisionControlPlaneSnapshot,
  ZavorthVisionPolicyDecision,
} from './ZavorthVisionControlPlaneContract.js';

export const ZAVORTH_COMPUTER_CONTROL_PLANE_CONTRACT_VERSION =
  '2026-05-11.computer-control-phase-3' as const;

export type ZavorthComputerControlAction =
  | 'computer.status'
  | 'computer.observe'
  | 'computer.plan'
  | 'computer.approve'
  | 'computer.cancel';

export type ZavorthComputerControlStatus =
  | 'ready'
  | 'redacted'
  | 'blocked'
  | 'approval-required'
  | 'watch-mode-ready';

export type ZavorthComputerTargetKind =
  | 'desktop-window'
  | 'browser-tab'
  | 'local-app'
  | 'unknown';

export type ZavorthComputerPlanStepKind =
  | 'focus-window'
  | 'list-elements'
  | 'screenshot'
  | 'click-element'
  | 'type-text'
  | 'press-key'
  | 'pause'
  | 'cancel';

export type ZavorthComputerRiskKind =
  | 'terminal'
  | 'shell-launcher'
  | 'password-manager'
  | 'file-manager-outside-workspace'
  | 'banking-or-payment'
  | 'seed-phrase-or-wallet'
  | 'mfa-or-auth'
  | 'destructive-or-exfiltration'
  | 'unknown-mutation';

export type ZavorthComputerControlInput = {
  action?: ZavorthComputerControlAction;
  targetWindow?: string | null;
  targetKind?: ZavorthComputerTargetKind | null;
  objective?: string | null;
  screenText?: string | null;
  targetText?: string | null;
  payload?: string | null;
  planId?: string | null;
  approvalId?: string | null;
  runId?: string | null;
  sourceSurface?: string | null;
  actorId?: string | null;
  live?: boolean;
  strictApproval?: boolean | null;
  maxIterations?: number | null;
  maxScreenshots?: number | null;
  maxDurationMs?: number | null;
  idleTtlMs?: number | null;
};

export type ZavorthComputerPlanStep = {
  id: string;
  kind: ZavorthComputerPlanStepKind;
  label: string;
  targetWindow: string | null;
  targetText: string | null;
  payloadPreview: string | null;
  mutation: boolean;
  requiresApproval: boolean;
  risk: 'low' | 'medium' | 'high' | 'forbidden';
};

export type ZavorthComputerControlReceipt = {
  id: string;
  kind: 'policy' | 'vision' | 'watch-mode' | 'plan' | 'approval' | 'block' | 'cancel';
  status: ZavorthVisionPolicyDecision | 'done' | 'blocked' | 'approval-required' | 'skipped';
  reason: string;
  rawSecretSerialized: false;
};

export type ZavorthComputerControlSnapshot = {
  contractVersion: typeof ZAVORTH_COMPUTER_CONTROL_PLANE_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthComputerControlPlaneService';
  status: ZavorthComputerControlStatus;
  action: ZavorthComputerControlAction;
  target: {
    kind: ZavorthComputerTargetKind;
    windowTitle: string | null;
    sourceSurface: string;
  };
  watchMode: {
    canonicalExecutor: 'ComputerUseWatchModeService';
    available: boolean;
    used: boolean;
    runId: string | null;
    activeStatus: string | null;
    strictApprovalDefault: boolean;
    allowedApps: string[];
    allowedSites: string[];
    budgets: {
      maxIterations: number;
      maxScreenshots: number;
      maxDurationMs: number;
      idleTtlMs: number;
    };
  };
  plan: {
    id: string | null;
    status: 'none' | 'planned' | 'approval-required' | 'approved-preview' | 'cancelled-preview' | 'blocked';
    steps: ZavorthComputerPlanStep[];
    mutationRequested: boolean;
    approvalRequired: boolean;
    approvalId: string | null;
  };
  policy: {
    decision: ZavorthVisionPolicyDecision;
    profile: 'computer-control-phase-3';
    reason: string;
    mutationAllowed: false;
    providerPayloadMinimized: true;
  };
  hardBlocks: {
    matched: boolean;
    risks: ZavorthComputerRiskKind[];
    reason: string | null;
  };
  safety: {
    previewBeforeClickOrTyping: true;
    pauseCancelAlwaysAvailable: true;
    terminalAutomationBlocked: true;
    runDialogBlocked: true;
    passwordManagersBlocked: true;
    fileManagersOutsideWorkspaceBlocked: true;
    bankingWalletMfaBlocked: true;
    maxScreenshotsEnforced: true;
    maxIterationsEnforced: true;
    maxDurationEnforced: true;
    idleTimeoutEnforced: true;
    rawSecretSerialized: false;
    liveMutationPerformed: false;
  };
  vision: ZavorthVisionControlPlaneSnapshot;
  receipts: ZavorthComputerControlReceipt[];
  commands: {
    status: '/computer status';
    observe: '/computer observe';
    plan: '/computer plan';
    approve: '/computer approve <plan>';
    cancel: '/computer cancel';
    nextPhase: 'Phase 4 - Android ADB And Device Bridge';
  };
  nextSafeAction: string;
};
