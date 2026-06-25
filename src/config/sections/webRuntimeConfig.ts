import path from 'path';

import { parseList } from '../configHelpers';
import { parseEnvInt } from '../envParsers';

export function buildWebRuntimeConfig(projectRoot: string) {
  return {
    zavorthWebHost: process.env.ZAVORTH_WEB_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1'),
    zavorthWebPort: parseEnvInt(process.env.ZAVORTH_WEB_PORT || process.env.PORT, 3000),
    zavorthWebAuthToken: process.env.ZAVORTH_WEB_AUTH_TOKEN || '',
    zavorthWebAuthTokenFile:
      process.env.ZAVORTH_WEB_AUTH_TOKEN_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'web-api-token.txt'),
    trustedDeviceAccessStateFile:
      process.env.ZAVORTH_TRUSTED_DEVICE_ACCESS_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'trusted-device-access.json'),
    zavorthEchoEdgeAuthToken: process.env.ZAVORTH_ECHO_EDGE_AUTH_TOKEN || '',
    zavorthEchoEdgeAuthTokenFile:
      process.env.ZAVORTH_ECHO_EDGE_AUTH_TOKEN_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'echo-edge-token.txt'),
    zavorthEchoEdgeAllowLoopbackAuthBypass:
      (process.env.ZAVORTH_ECHO_EDGE_ALLOW_LOOPBACK_AUTH_BYPASS || 'true').toLowerCase() !== 'false',
    zavorthEchoEdgeTrustProxyHeaders:
      (process.env.ZAVORTH_ECHO_EDGE_TRUST_PROXY_HEADERS || 'false').toLowerCase() === 'true',
    zavorthEchoEdgeRateLimitWindowMs: parseEnvInt(process.env.ZAVORTH_ECHO_EDGE_RATE_LIMIT_WINDOW_MS, 30000),
    zavorthEchoEdgeReadRateLimitMaxRequests: parseEnvInt(process.env.ZAVORTH_ECHO_EDGE_READ_RATE_LIMIT_MAX_REQUESTS, 90),
    zavorthEchoEdgeExecuteRateLimitMaxRequests: parseEnvInt(process.env.ZAVORTH_ECHO_EDGE_EXECUTE_RATE_LIMIT_MAX_REQUESTS, 12),
    zavorthEchoEdgeResolveRateLimitMaxRequests: parseEnvInt(process.env.ZAVORTH_ECHO_EDGE_RESOLVE_RATE_LIMIT_MAX_REQUESTS, 30),
    zavorthEchoEdgeMaxBodyBytes: parseEnvInt(process.env.ZAVORTH_ECHO_EDGE_MAX_BODY_BYTES, 32768),
    dashboardRuntimeStateFile:
      process.env.ZAVORTH_DASHBOARD_RUNTIME_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'dashboard-runtime.json'),
    mcpRuntimeStateFile:
      process.env.ZAVORTH_MCP_RUNTIME_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'mcp-runtime-state.json'),
    nodeMeshStateFile:
      process.env.ZAVORTH_NODE_MESH_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'node-mesh-state.json'),
    nodeMeshSecretsFile:
      process.env.ZAVORTH_NODE_MESH_SECRETS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'node-mesh-secrets.json'),
    nodeMeshInvocationFile:
      process.env.ZAVORTH_NODE_MESH_INVOCATION_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'node-mesh-invocations.json'),
    nodeMeshHeartbeatIntervalMs: parseEnvInt(process.env.ZAVORTH_NODE_MESH_HEARTBEAT_INTERVAL_MS, 15000),
    nodeMeshHeartbeatStaleMs: parseEnvInt(process.env.ZAVORTH_NODE_MESH_HEARTBEAT_STALE_MS, 45000),
    nodeMeshPairingDraftStaleMs: parseEnvInt(process.env.ZAVORTH_NODE_MESH_PAIRING_DRAFT_STALE_MS, 43200000),
    nodeMeshInvocationPendingMaxAgeMs: parseEnvInt(process.env.ZAVORTH_NODE_MESH_INVOCATION_PENDING_MAX_AGE_MS, 86400000),
    pluginRegistryStateFile:
      process.env.ZAVORTH_PLUGIN_REGISTRY_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'plugin-registry-state.json'),
    learningPlaneStateFile:
      process.env.ZAVORTH_LEARNING_PLANE_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'learning-plane-state.json'),
    learningPlaneMaxCandidates: parseEnvInt(process.env.ZAVORTH_LEARNING_PLANE_MAX_CANDIDATES, 40),
    layeredMemoryBudgetPerLayer: parseEnvInt(process.env.ZAVORTH_LAYERED_MEMORY_BUDGET_PER_LAYER, 12),
    platformRegistryCatalogFile:
      process.env.ZAVORTH_PLATFORM_REGISTRY_CATALOG_FILE ||
      path.resolve(projectRoot, 'config', 'platform-registry.json'),
    platformRegistryRemoteUrl:
      process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_URL || '',
    platformRegistryRemoteToken:
      process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_TOKEN || '',
    platformRegistryRemoteAllowedHosts: parseList(
      process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_ALLOWED_HOSTS || '',
    ),
    platformRegistryRemoteAllowHttpHosts: parseList(
      process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_ALLOW_HTTP_HOSTS || '',
    ),
    platformRegistryRemoteExpectedSha256:
      String(process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_EXPECTED_SHA256 || '').trim().toLowerCase(),
    platformRegistryRemoteCacheFile:
      process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_CACHE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'platform-registry-remote-cache.json'),
    platformRegistryRemoteStatusFile:
      process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'platform-registry-remote-status.json'),
    platformRegistryRemoteMaxAgeMs: parseEnvInt(process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_MAX_AGE_MS, 43200000),
    platformRegistryRemoteSyncTimeoutMs: parseEnvInt(process.env.ZAVORTH_PLATFORM_REGISTRY_REMOTE_SYNC_TIMEOUT_MS, 8000),
    workflowRunDir:
      process.env.ZAVORTH_WORKFLOW_RUN_DIR ||
      path.resolve(projectRoot, 'data', 'runtime', 'workflow-runs'),
    surfaceIdentityStateFile:
      process.env.ZAVORTH_SURFACE_IDENTITY_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'surface-identities.json'),
    tenantRegistryStateFile:
      process.env.ZAVORTH_TENANT_REGISTRY_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'tenant-registry.json'),
  };
}
