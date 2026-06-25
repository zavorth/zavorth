export const ZAVORTH_AGENT_MESH_CONSENT_CONTRACT_VERSION = '2026-05-09.agent-mesh-maestro-dynamic' as const;

export type AgentMeshProtocol =
  | 'mcp'
  | 'cli-wrapper'
  | 'websocket'
  | 'webhook'
  | 'stdio';

export type AgentMeshPermission =
  | 'execute_cli'
  | 'read_workspace'
  | 'delegate_tools'
  | 'share_context'
  | 'network_access'
  | 'filesystem_write'
  | 'process_execution'
  | 'identity_impersonation'
  | 'mcp_full_access';

export const AGENT_MESH_CRITICAL_PERMISSIONS: AgentMeshPermission[] = [
  'filesystem_write',
  'process_execution',
  'identity_impersonation',
  'mcp_full_access',
];

export type AgentMeshConnectionKind =
  | 'local-command'
  | 'local-socket'
  | 'local-url'
  | 'remote-url'
  | 'secret-ref'
  | 'unknown';

export type AgentMeshConnectionRef = {
  ref: string;
  kind: AgentMeshConnectionKind;
  label: string;
  redacted: string;
  fingerprint: string;
  secretMaterialPersisted: false;
};

export type AgentMeshBridgeStatus =
  | 'discovered_unverified'
  | 'verified_not_authorized'
  | 'authorized_ready'
  | 'authorized_degraded'
  | 'revoked'
  | 'blocked_by_policy';

export type AgentMeshDynamicCapabilities = {
  reportedToolCount: number;
  reportedChannelCount: number;
  primaryDomain: string;
  discoveredTools: string[];
  supportedProtocols: AgentMeshProtocol[];
  supportsDryRun: boolean;
  supportsCancellation: boolean;
  discoverySource?: 'driver-handshake' | 'local-fallback';
  driverStatus?: 'available' | 'unavailable' | 'failed';
};

export type AgentMeshUserConsent = {
  id: string;
  signedAt: string;
  userFingerprint: string;
  authorizedAgentId: string;
  grantedPermissions: AgentMeshPermission[];
  risksAcknowledged: string[];
  workspaceScope: string | null;
  sessionScope: string | null;
  expirationDate: string | null;
  revocable: true;
};

export type AgentMeshBridgeConfig = {
  id: string;
  agentName: string;
  agentDescription: string;
  connection: AgentMeshConnectionRef;
  primaryProtocol: AgentMeshProtocol;
  status: AgentMeshBridgeStatus;
  consent: AgentMeshUserConsent | null;
  capabilities: AgentMeshDynamicCapabilities | null;
  lastHandshakeAt: string | null;
  registeredAt: string;
};

export type AgentMeshPolicyDecision = {
  decision: 'allowed' | 'blocked' | 'requires_approval';
  reasons: string[];
  requiredPermissions: AgentMeshPermission[];
  deniedPermissions: AgentMeshPermission[];
  criticalPermissions: AgentMeshPermission[];
};

export type AgentMeshOrchestrationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_AGENT_MESH_CONSENT_CONTRACT_VERSION;
  meshId: string;
  bridges: AgentMeshBridgeConfig[];
  policy: {
    consentRequiredForEveryBridge: true;
    noBackgroundExecutionWithoutActiveSession: true;
    transparencyLogsRequired: true;
    redactSecretsBeforeDelegation: true;
    dynamicDiscoveryAllowed: true;
    rawConnectionMaterialPersisted: false;
    criticalPermissionsBlockedByDefault: true;
  };
  narrative: {
    headline: string;
    description: string;
  };
};
