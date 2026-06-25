export type IntegrationConnectorId =
  | 'composio'
  | 'nango'
  | 'pipedream'
  | 'zapier'
  | 'n8n'
  | 'workato';

export type IntegrationConnectorCapability =
  | 'agent_tools'
  | 'oauth'
  | 'actions'
  | 'mcp'
  | 'workflows'
  | 'sync'
  | 'proxy';

export type IntegrationConnectorManifest = {
  id: IntegrationConnectorId;
  label: string;
  summary: string;
  docsUrl: string;
  env: {
    apiKey: string | null;
    baseUrl: string | null;
    healthUrl?: string | null;
    executeUrl?: string | null;
  };
  defaultBaseUrl: string | null;
  capabilities: IntegrationConnectorCapability[];
  toolDiscovery: {
    supported: boolean;
    endpoint: string | null;
    summary: string;
  };
  toolExecution: {
    supported: boolean;
    endpointTemplate: string | null;
    requiresApproval: true;
  };
};

export type IntegrationConnectorDoctorStatus = 'ready' | 'missing_config' | 'failed' | 'unsupported_probe';

export type IntegrationConnectorDoctor = {
  generatedAt: string;
  id: IntegrationConnectorId;
  label: string;
  status: IntegrationConnectorDoctorStatus;
  configured: boolean;
  baseUrl: string | null;
  checkedTarget: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
  summary: string;
  nextAction: string;
  safety: {
    secretsRedacted: true;
    actionHarnessRequired: true;
    externalExecutionApprovalGated: true;
  };
};

export type IntegrationConnectorSnapshot = {
  contractVersion: 'integration-connector-mesh/1';
  generatedAt: string;
  manifests: IntegrationConnectorManifest[];
  doctors: IntegrationConnectorDoctor[];
  summary: {
    total: number;
    configured: number;
    ready: number;
  };
};

export type IntegrationConnectorExecutePreview = {
  connectorId: IntegrationConnectorId;
  toolSlug: string;
  method: 'POST';
  target: string;
  inputPreview: Record<string, unknown>;
  requiresApproval: true;
  secretsSerialized: false;
};
