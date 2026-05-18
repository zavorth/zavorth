export const ZAVORTH_ACP_LIVE_BRIDGE_CONTRACT_VERSION = '2026-05-16.acp-live-bridge/1' as const;

export type AcpLiveBridgeStatus = 'disabled' | 'blocked' | 'ready';

export type AcpLiveBridgeCheckId =
  | 'explicit-enable'
  | 'owner-approval'
  | 'controlled-cwd'
  | 'workspace-roots'
  | 'allowed-servers'
  | 'tool-policy'
  | 'receipts';

export type AcpLiveBridgeCheck = {
  id: AcpLiveBridgeCheckId;
  label: string;
  status: 'passed' | 'failed';
  required: true;
  summary: string;
  envRefs: string[];
};

export type AcpLiveBridgeSnapshot = {
  contractVersion: typeof ZAVORTH_ACP_LIVE_BRIDGE_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'acp-live-bridge';
  generatedAt: string;
  status: AcpLiveBridgeStatus;
  headline: string;
  bridge: {
    id: 'acpx';
    protocol: 'ACP';
    transport: 'owner-gated-live-bridge';
    enabledByDefault: false;
    enabledByEnv: boolean;
    liveExecutionPerformed: false;
    dryRunAvailable: true;
  };
  checks: AcpLiveBridgeCheck[];
  summary: {
    passed: number;
    failed: number;
    requiredFailed: number;
    liveReady: boolean;
  };
  activation: {
    command: 'zavorth acp live';
    jsonCommand: 'zavorth acp live --json';
    checkCommand: 'npm run acp:live-bridge:check --silent';
    requiredEnv: string[];
  };
  policy: {
    noDefaultEnable: true;
    ownerApprovalRequired: true;
    cwdControlRequired: true;
    workspaceRootsRequired: true;
    serverAllowlistRequired: true;
    writesAndShellRequireApproval: true;
    bypassPermissionsAllowed: false;
    rawSecretsSerialized: false;
  };
  receipt: {
    kind: 'agent-runtime.acp.live-bridge-readiness';
    liveExecutionPerformed: false;
    executionAuthorityGranted: boolean;
    approvalRef: string | null;
  };
};

export type AcpLiveSessionTransportKind = 'mock-jsonrpc' | 'stdio-jsonrpc' | 'acp-sdk-stdio';

export type AcpLiveSessionStatus = 'blocked' | 'completed' | 'approval_required' | 'failed';

export type AcpLiveSessionEventKind =
  | 'bridge-readiness'
  | 'transport-opened'
  | 'initialize'
  | 'session-start'
  | 'message-send'
  | 'message-event'
  | 'tool-request'
  | 'tool-decision'
  | 'session-end'
  | 'transport-closed'
  | 'error';

export type AcpLiveSessionToolDecision = {
  requestId: string;
  toolName: string;
  decision: 'allow' | 'deny' | 'approval_required';
  reason: string;
  approvalRequired: boolean;
  liveToolExecutionPerformed: false;
};

export type AcpLiveSessionEvent = {
  kind: AcpLiveSessionEventKind;
  at: string;
  summary: string;
  data?: Record<string, unknown>;
};

export type AcpLiveSessionReceipt = {
  contractVersion: typeof ZAVORTH_ACP_LIVE_BRIDGE_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'acp-live-session';
  generatedAt: string;
  status: AcpLiveSessionStatus;
  session: {
    id: string;
    serverId: string;
    transport: AcpLiveSessionTransportKind;
    promptHash: string;
    liveExecutionPerformed: boolean;
    liveToolExecutionPerformed: false;
  };
  governance: {
    bridgeStatus: AcpLiveBridgeStatus;
    executionAuthorityGranted: boolean;
    approvalRef: string | null;
    serverAllowlisted: boolean;
    rawSecretsSerialized: false;
  };
  events: AcpLiveSessionEvent[];
  toolDecisions: AcpLiveSessionToolDecision[];
  output: {
    text: string;
    eventCount: number;
  };
};
