export const ZAVORTH_NATIVE_BROWSER_COMPUTER_USE_CONTRACT_VERSION =
  '2026-05-24.native-browser-computer-use-phase-5' as const;

export type ZavorthNativeBrowserComputerUseAction =
  | 'native.status'
  | 'browser.cdp.status'
  | 'browser.navigate'
  | 'browser.screenshot'
  | 'browser.click'
  | 'browser.type'
  | 'browser.extract'
  | 'computer.observe'
  | 'computer.plan'
  | 'computer.cancel';

export type ZavorthNativeBrowserComputerUseStatus =
  | 'ready'
  | 'needs-configuration'
  | 'approval-required'
  | 'blocked'
  | 'preview';

export type ZavorthNativeBrowserComputerUseReceipt = {
  id: string;
  kind: 'policy' | 'domain-policy' | 'sidecar' | 'browser' | 'computer-use' | 'visual' | 'approval';
  status: 'done' | 'skipped' | 'blocked' | 'approval-required';
  summary: string;
  rawSecretSerialized: false;
};

export type ZavorthNativeBrowserComputerUseCapability = {
  id: string;
  label: string;
  runtime: 'cdp-playwright-sidecar' | 'computer-use-adapter' | 'policy-kernel';
  status: 'available' | 'needs-configuration' | 'approval-required' | 'blocked';
  actions: ZavorthNativeBrowserComputerUseAction[];
  requiresApprovalForMutation: boolean;
  receiptKinds: ZavorthNativeBrowserComputerUseReceipt['kind'][];
};

export type ZavorthNativeBrowserComputerUseInput = {
  action?: ZavorthNativeBrowserComputerUseAction;
  url?: string | null;
  selector?: string | null;
  text?: string | null;
  objective?: string | null;
  targetWindow?: string | null;
  targetKind?: 'desktop-window' | 'browser-tab' | 'local-app' | 'unknown' | null;
  approvalId?: string | null;
  sourceSurface?: string | null;
  actorId?: string | null;
  live?: boolean;
  allowPrivateEgress?: boolean;
  timeoutMs?: number | null;
};

export type ZavorthNativeBrowserComputerUseSnapshot = {
  contractVersion: typeof ZAVORTH_NATIVE_BROWSER_COMPUTER_USE_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthNativeBrowserComputerUseService';
  status: ZavorthNativeBrowserComputerUseStatus;
  action: ZavorthNativeBrowserComputerUseAction;
  target: {
    url: string | null;
    origin: string | null;
    domainPolicy: 'public-read' | 'approval-required' | 'blocked' | 'unknown';
    selector: string | null;
    targetWindow: string | null;
    sourceSurface: string;
  };
  sidecar: {
    cdpPlaywrightConfigured: boolean;
    cdpPlaywrightUsed: boolean;
    runtime: 'browser-sidecar' | 'preview-only';
    supportedActions: Array<'navigate' | 'screenshot' | 'click' | 'type' | 'extract'>;
    error: string | null;
  };
  computerUse: {
    adapter: 'ComputerUseAgent';
    controlPlane: 'ZavorthComputerControlPlaneService';
    available: boolean;
    used: boolean;
    targetKind: 'desktop-window' | 'browser-tab' | 'local-app' | 'unknown';
  };
  policy: {
    decision: 'allow-read' | 'require-owner-approval' | 'deny' | 'preview-only';
    reason: string;
    clickTypeSubmitRequireApproval: true;
    policyByDomainOrSite: true;
    privateNetworkBlockedByDefault: true;
    browserReceiptsRequired: true;
    visualReceiptsRequired: true;
  };
  visualReceipts: Array<{
    id: string;
    kind: 'screenshot' | 'click' | 'type' | 'extract' | 'computer-use';
    status: 'ready' | 'approval-required' | 'blocked' | 'skipped';
    summary: string;
    redacted: true;
  }>;
  capabilities: ZavorthNativeBrowserComputerUseCapability[];
  receipts: ZavorthNativeBrowserComputerUseReceipt[];
  safety: {
    cdpPlaywrightRunsInSidecar: true;
    screenshotClickTypeExtractAreNative: true;
    computerUseAdapterIsGoverned: true;
    noClickOrTypeWithoutApproval: true;
    noPrivateNetworkByDefault: true;
    noSecretsSerialized: true;
    receiptsForVisualInteractions: true;
    liveActionNotFaked: true;
  };
  commands: {
    status: 'zavorth native browser status';
    sidecar: 'npm run browser:sidecar';
    browser: 'npm run zavorth:native-browser-computer-use -- --action browser.extract --url <url>';
    computer: 'npm run zavorth:native-browser-computer-use -- --action computer.plan';
  };
  nextSafeAction: string;
};
