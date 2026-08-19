import path from 'path';
import { parseEnvInt } from '../envParsers';

import {
  APPDATA_FALLBACK,
  LOCALAPPDATA_FALLBACK,
  USERPROFILE_FALLBACK,
  deriveExternalExecutorAgentId,
  parseList,
} from '../configHelpers';

import { ZavorthHomePathService } from '../../services/ZavorthHomePathService.js';

export function buildRuntimePathConfig(projectRoot: string, publicTunnelStateFileFallback: string) {
  const homePaths = new ZavorthHomePathService({ projectRoot, env: process.env }).resolvePaths();
  const dataPath = (...segments: string[]) => path.join(homePaths.dataDir, ...segments);
  const runtimePath = (...segments: string[]) => path.join(homePaths.runtimeDir, ...segments);
  return {
    // Memory
    memoryWindowSize: parseEnvInt(process.env.MEMORY_WINDOW_SIZE, 20),

    // Tokens
    maxTokens: parseEnvInt(process.env.MAX_TOKENS, 2000),

    // Video processing
    videoChunkConcurrency: parseEnvInt(process.env.VIDEO_CHUNK_CONCURRENCY, 2),
    videoContextRetentionDays: parseEnvInt(process.env.VIDEO_CONTEXT_RETENTION_DAYS, 30),
    videoContextMaxFiles: parseEnvInt(process.env.VIDEO_CONTEXT_MAX_FILES, 120),
    tempFileRetentionHours: parseEnvInt(process.env.TEMP_FILE_RETENTION_HOURS, 2),

    // Paths
    workspaceRoot: process.env.WORKSPACE_ROOT || projectRoot,
    defaultWorkspace: process.env.DEFAULT_WORKSPACE || projectRoot,
    zavorthHomeRoot: homePaths.homeRoot,
    dataDir: homePaths.dataDir,
    tmpDir: homePaths.tmpDir,
    runtimeDir: homePaths.runtimeDir,
    receiptsDir: homePaths.receiptsDir,
    credentialsDir: homePaths.credentialsDir,
    skillsDir: path.join(homePaths.homeRoot, '.agents', 'skills'),
    sttProvidersDir:
      process.env.ZAVORTH_STT_PROVIDERS_DIR ||
      path.join(homePaths.homeRoot, '.agents', 'stt-providers'),
    ttsProvidersDir:
      process.env.ZAVORTH_TTS_PROVIDERS_DIR ||
      path.join(homePaths.homeRoot, '.agents', 'tts-providers'),
    skillsGovernanceMode: process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE || 'casual',
    skillsCurationEnabled: (process.env.ZAVORTH_SKILLS_CURATION_ENABLED || 'true').toLowerCase() !== 'false',
    skillsCurationArchiveAfterDays: parseEnvInt(process.env.ZAVORTH_SKILLS_CURATION_ARCHIVE_AFTER_DAYS, 30),
    skillsCurationBackup: (process.env.ZAVORTH_SKILLS_CURATION_BACKUP || 'true').toLowerCase() !== 'false',
    skillsCuratorStateFile:
      process.env.ZAVORTH_SKILLS_CURATOR_STATE_FILE ||
      runtimePath('skills-curator-state.json'),
    skillsCuratorReportsDir:
      process.env.ZAVORTH_SKILLS_CURATOR_REPORTS_DIR ||
      dataPath('skills', 'curator', 'reports'),
    skillsCuratorIntervalHours: parseFloat(process.env.ZAVORTH_SKILLS_CURATOR_INTERVAL_HOURS || `${24 * 7}`),
    skillsCuratorMinIdleHours: parseFloat(process.env.ZAVORTH_SKILLS_CURATOR_MIN_IDLE_HOURS || '2'),
    skillsCuratorStaleAfterDays: parseEnvInt(process.env.ZAVORTH_SKILLS_CURATOR_STALE_AFTER_DAYS, 30),
    skillsCuratorArchiveAfterDays: parseEnvInt(
      process.env.ZAVORTH_SKILLS_CURATOR_ARCHIVE_AFTER_DAYS ||
        process.env.ZAVORTH_SKILLS_CURATION_ARCHIVE_AFTER_DAYS,
      90,
    ),
    skillsCuratorLlmReviewEnabled:
      (process.env.ZAVORTH_SKILLS_CURATOR_LLM_REVIEW_ENABLED || 'false').toLowerCase() === 'true',
    skillsCuratorLlmProvider: process.env.ZAVORTH_SKILLS_CURATOR_LLM_PROVIDER || '',
    skillsCuratorLlmModel: process.env.ZAVORTH_SKILLS_CURATOR_LLM_MODEL || '',
    skillsCuratorLlmMaxProposals: parseEnvInt(process.env.ZAVORTH_SKILLS_CURATOR_LLM_MAX_PROPOSALS, 12),
    dbPath: homePaths.dbPath,
    codexCliPath: process.env.CODEX_CLI_PATH || path.join(USERPROFILE_FALLBACK, '.codex', '.sandbox-bin', 'codex.exe'),
    codexSandbox: process.env.CODEX_SANDBOX || 'workspace-write',
    codexTimeoutSeconds: parseEnvInt(process.env.CODEX_TIMEOUT_SECONDS, 180),
    codexRemoteSessionTimeoutSeconds: parseEnvInt(process.env.CODEX_REMOTE_SESSION_TIMEOUT_SECONDS, 1800),
    codexRemoteSessionHeartbeatMs: parseEnvInt(process.env.CODEX_REMOTE_SESSION_HEARTBEAT_MS, 5000),
    codexRemoteSessionStaleMs: parseEnvInt(process.env.CODEX_REMOTE_SESSION_STALE_MS, 15000),
    externalExecutorCliPath:
      process.env.EXTERNAL_EXECUTOR_CLI_PATH ||
      (process.platform === 'win32'
        ? path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'wsl.exe')
        : 'external-executor'),
    externalExecutorTransport: process.env.EXTERNAL_EXECUTOR_TRANSPORT || (process.platform === 'win32' ? 'wsl' : 'direct'),
    externalExecutorCommand: process.env.EXTERNAL_EXECUTOR_COMMAND || 'external-executor',
    externalExecutorAgentId: process.env.EXTERNAL_EXECUTOR_AGENT_ID || deriveExternalExecutorAgentId(process.env.DEFAULT_WORKSPACE || projectRoot),
    externalExecutorThinking: process.env.EXTERNAL_EXECUTOR_THINKING || 'low',
    externalExecutorWslDistro: process.env.EXTERNAL_EXECUTOR_WSL_DISTRO || '',
    externalExecutorWslUser: process.env.EXTERNAL_EXECUTOR_WSL_USER || '',
    externalExecutorTimeoutSeconds: parseEnvInt(process.env.EXTERNAL_EXECUTOR_TIMEOUT_SECONDS, 240),
    zavorthBridgeCliPath: process.env.ZAVORTH_BRIDGE_CLI_PATH || path.join(LOCALAPPDATA_FALLBACK, 'Programs', 'ZavorthBridge', 'bin', 'zavorthBridge.cmd'),
    zavorthBridgeMode: process.env.ZAVORTH_BRIDGE_MODE || 'agent',
    zavorthBridgeProfileName: process.env.ZAVORTH_BRIDGE_PROFILE_NAME || 'zavorth-model-test',
    zavorthBridgeWindowStrategy: process.env.ZAVORTH_BRIDGE_WINDOW_STRATEGY || 'reuse-window',
    zavorthBridgeReuseLiveSession: (process.env.ZAVORTH_BRIDGE_REUSE_LIVE_SESSION || 'true').toLowerCase() !== 'false',
    zavorthBridgeStartNewConversationPerTask: (process.env.ZAVORTH_BRIDGE_START_NEW_CONVERSATION_PER_TASK || 'false').toLowerCase() === 'true',
    zavorthBridgeAutoCleanBeforeTask: (process.env.ZAVORTH_BRIDGE_AUTO_CLEAN_BEFORE_TASK || 'false').toLowerCase() === 'true',
    zavorthBridgePreferredModelDefault: process.env.ZAVORTH_BRIDGE_PREFERRED_MODEL || '',
    zavorthBridgeDir: dataPath('agent-bridge', 'zavorth-bridge'),
    zavorthBridgePromptDir: dataPath('agent-bridge', 'zavorth-bridge', 'handoffs'),
    zavorthBridgePendingDir: dataPath('agent-bridge', 'zavorth-bridge', 'pending'),
    zavorthBridgeResponseDir: dataPath('agent-bridge', 'zavorth-bridge', 'responses'),
    zavorthBridgeControlRequestDir: dataPath('agent-bridge', 'zavorth-bridge', 'control', 'requests'),
    zavorthBridgeControlResultDir: dataPath('agent-bridge', 'zavorth-bridge', 'control', 'results'),
    zavorthBridgeRuntimeDir: dataPath('agent-bridge', 'zavorth-bridge', 'runtime'),
    zavorthBridgePreferencesFile: dataPath('agent-bridge', 'zavorth-bridge', 'runtime', 'preferences.json'),
    zavorthBridgeBrainDir:
      process.env.ZAVORTH_BRIDGE_BRAIN_DIR ||
      path.join(USERPROFILE_FALLBACK, '.gemini', 'zavorthBridge', 'brain'),
    zavorthBridgeLogsDir:
      process.env.ZAVORTH_BRIDGE_LOGS_DIR ||
      path.join(APPDATA_FALLBACK, 'ZavorthBridge', 'logs'),
    zavorthBridgeAutomationEnabled: (process.env.ZAVORTH_BRIDGE_AUTOMATION_ENABLED || 'true').toLowerCase() !== 'false',
    zavorthBridgeAutomationDelaySeconds: parseEnvInt(process.env.ZAVORTH_BRIDGE_AUTOMATION_DELAY_SECONDS, 18),
    zavorthBridgeAutomationMaxAttempts: parseEnvInt(process.env.ZAVORTH_BRIDGE_AUTOMATION_MAX_ATTEMPTS, 2),
    zavorthBridgeWindowTitle: process.env.ZAVORTH_BRIDGE_WINDOW_TITLE || 'ZavorthBridge',
    zavorthBridgeUiScriptPath: path.resolve(projectRoot, 'scripts', 'zavorth-bridge-window-automation-v2.ps1'),
    zavorthBridgeStartScriptPath: path.resolve(projectRoot, 'scripts', 'start-zavorth-bridge-debug.mjs'),
    zavorthBridgeAutoHotkeyPath:
      process.env.ZAVORTH_BRIDGE_AUTOHOTKEY_PATH ||
      path.join(LOCALAPPDATA_FALLBACK, 'Programs', 'AutoHotkey', 'v2', 'AutoHotkey64.exe'),
    zavorthBridgeAutoHotkeyScriptPath: path.resolve(projectRoot, 'scripts', 'zavorth-bridge-model-switch.ahk'),
    zavorthBridgeControlScriptPath: path.resolve(projectRoot, 'scripts', 'zavorth-bridge-control.ps1'),
    zavorthBridgeCaptureScriptPath: path.resolve(projectRoot, 'scripts', 'zavorth-bridge-window-capture.ps1'),
    zavorthBridgeAllowedModelsPath: path.resolve(projectRoot, 'config', 'zavorth-bridge-allowed-models.json'),
    zavorthBridgeControlLogsDir: path.resolve(projectRoot, 'data', 'zavorth-bridge-control', 'logs'),
    zavorthBridgePromptTimeoutSeconds: parseEnvInt(process.env.ZAVORTH_BRIDGE_PROMPT_TIMEOUT_SECONDS, 150),
    zavorthBridgeWorkspaceBootstrapTimeoutSeconds: parseEnvInt(process.env.ZAVORTH_BRIDGE_WORKSPACE_BOOTSTRAP_TIMEOUT_SECONDS, 20),
    zavorthBridgePromptCaptureDir: path.resolve(projectRoot, 'data', 'zavorth-bridge-prompt', 'captures'),
    zavorthBridgeStateDbPath:
      process.env.ZAVORTH_BRIDGE_STATE_DB_PATH ||
      path.join(APPDATA_FALLBACK, 'ZavorthBridge', 'User', 'globalStorage', 'state.vscdb'),
    zavorthBridgeControlRuntimeDir: path.resolve(projectRoot, 'data', 'zavorth-bridge-control', 'runtime'),
    mailboxBridgeDir:
      process.env.ZAVORTH_MAILBOX_DIR || dataPath('agent-bridge', 'mailbox'),
    mailboxInboxDir:
      process.env.ZAVORTH_MAILBOX_INBOX_DIR ||
      path.join(process.env.ZAVORTH_MAILBOX_DIR || dataPath('agent-bridge', 'mailbox'), 'inbox'),
    mailboxProcessedDir:
      process.env.ZAVORTH_MAILBOX_PROCESSED_DIR ||
      path.join(process.env.ZAVORTH_MAILBOX_DIR || dataPath('agent-bridge', 'mailbox'), 'processed'),
    mailboxRejectedDir:
      process.env.ZAVORTH_MAILBOX_REJECTED_DIR ||
      path.join(process.env.ZAVORTH_MAILBOX_DIR || dataPath('agent-bridge', 'mailbox'), 'rejected'),
    mailboxRuntimeDir:
      process.env.ZAVORTH_MAILBOX_RUNTIME_DIR ||
      path.join(process.env.ZAVORTH_MAILBOX_DIR || dataPath('agent-bridge', 'mailbox'), 'runtime'),
    mailboxSeenDir:
      process.env.ZAVORTH_MAILBOX_SEEN_DIR ||
      path.join(
        process.env.ZAVORTH_MAILBOX_RUNTIME_DIR ||
          path.join(process.env.ZAVORTH_MAILBOX_DIR || dataPath('agent-bridge', 'mailbox'), 'runtime'),
        'seen',
      ),
    mailboxStatusFile:
      process.env.ZAVORTH_MAILBOX_STATUS_FILE ||
      path.join(
        process.env.ZAVORTH_MAILBOX_RUNTIME_DIR ||
          path.join(process.env.ZAVORTH_MAILBOX_DIR || dataPath('agent-bridge', 'mailbox'), 'runtime'),
        'last-status.txt',
      ),
    mailboxLegacyPath:
      process.env.ZAVORTH_MAILBOX_PATH ||
      dataPath('agent-bridge', 'mailbox', 'legacy', 'caixa_zavorthBridge.txt'),
    remoteModeScriptPath: path.resolve(projectRoot, 'scripts', 'remote-mode.ps1'),
    remoteModeStateFile: runtimePath('remote-mode-state.json'),
    operatorModeStateFile: runtimePath('operator-mode-state.json'),
    presentationModeStateFile: runtimePath('presentation-mode-state.json'),
    demoModeStateFile: runtimePath('demo-mode-state.json'),
    demoGuideStateFile: runtimePath('demo-guide-state.json'),
    dailyReportStateFile: runtimePath('daily-report-state.json'),
    operationalModeStateFile: runtimePath('operational-mode-state.json'),
    runtimeDiagnosticsFile: runtimePath('runtime-diagnostics.json'),
    integrationHubStateFile:
      process.env.ZAVORTH_INTEGRATION_HUB_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'integration-hub-state.json'),
    integrationHubSecretsFile:
      process.env.ZAVORTH_INTEGRATION_HUB_SECRETS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'integration-hub-secrets.json'),
    integrationHubDoctorReportFile:
      process.env.ZAVORTH_INTEGRATION_HUB_DOCTOR_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'integration-hub-doctor-last.json'),
    integrationHubProbeStateFile:
      process.env.ZAVORTH_INTEGRATION_HUB_PROBE_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'integration-hub-probes.json'),
    integrationHubProbeTimeoutMs: parseEnvInt(
      process.env.ZAVORTH_INTEGRATION_HUB_PROBE_TIMEOUT_MS,
      6000,
    ),
    securityAuditStatusFile:
      process.env.ZAVORTH_SECURITY_AUDIT_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'security-audit-last.json'),
    securityAuditTrailDir:
      process.env.ZAVORTH_SECURITY_AUDIT_TRAIL_DIR ||
      path.resolve(projectRoot, 'data', 'runtime', 'security-audit-trail'),
    securityPreflightStatusFile:
      process.env.ZAVORTH_SECURITY_PREFLIGHT_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'security-preflight-last.json'),
    telemetryEventsFile:
      process.env.ZAVORTH_TELEMETRY_EVENTS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'telemetry-events.jsonl'),
    evalHistoryFile:
      process.env.ZAVORTH_EVAL_HISTORY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'eval-history.json'),
    lastPublishStatusFile:
      process.env.ZAVORTH_LAST_PUBLISH_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'last-publish.json'),
    publishHistoryFile:
      process.env.ZAVORTH_PUBLISH_HISTORY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'publish-history.json'),
    publishArchiveDir:
      process.env.ZAVORTH_PUBLISH_ARCHIVE_DIR ||
      path.resolve(projectRoot, 'data', 'publish-archives'),
    maintenanceStatusFile:
      process.env.ZAVORTH_MAINTENANCE_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'maintenance-last.json'),
    maintenanceAutomationStateFile:
      process.env.ZAVORTH_MAINTENANCE_AUTOMATION_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'maintenance-automation-state.json'),
    maintenanceAutomationReportFile:
      process.env.ZAVORTH_MAINTENANCE_AUTOMATION_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'maintenance-recurring-last.json'),
    automationDeliveryReportFile:
      process.env.ZAVORTH_AUTOMATION_DELIVERY_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'automation-deliveries.jsonl'),
    automationWebhookOutboxFile:
      process.env.ZAVORTH_AUTOMATION_WEBHOOK_OUTBOX_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'automation-webhook-outbox.jsonl'),
    nodeMeshSmokeReportFile:
      process.env.ZAVORTH_NODE_MESH_SMOKE_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'node-mesh-smoke-last.json'),
    nodeMeshSmokeMaxAgeMs: parseEnvInt(
      process.env.ZAVORTH_NODE_MESH_SMOKE_MAX_AGE_MS,
      43200000,
    ),
    systemOverlordSmokeReportFile:
      process.env.ZAVORTH_SYSTEM_OVERLORD_SMOKE_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'system-overlord-smoke-last.json'),
    systemOverlordSmokeMaxAgeMs: parseEnvInt(
      process.env.ZAVORTH_SYSTEM_OVERLORD_SMOKE_MAX_AGE_MS,
      43200000,
    ),
    channelProviderDoctorReportFile:
      process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'channel-provider-doctor-last.json'),
    channelProviderDoctorMaxAgeMs: parseEnvInt(
      process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_MAX_AGE_MS,
      43200000,
    ),
    remoteTransportDoctorReportFile:
      process.env.ZAVORTH_REMOTE_TRANSPORT_DOCTOR_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'remote-transport-doctor-last.json'),
    remoteTransportDoctorMaxAgeMs: parseEnvInt(
      process.env.ZAVORTH_REMOTE_TRANSPORT_DOCTOR_MAX_AGE_MS,
      43200000,
    ),
    supervisedReloadReportFile:
      process.env.ZAVORTH_SUPERVISED_RELOAD_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'supervised-reload-last.json'),
    supervisedReloadNotificationFile:
      process.env.ZAVORTH_SUPERVISED_RELOAD_NOTIFICATION_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'supervised-reload-pending-notification.json'),
    autoRepairReportFile:
      process.env.ZAVORTH_AUTOREPAIR_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'autorepair-last.json'),
    zavorthBridgeRemoteDoctorReportFile:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_REMOTE_DOCTOR_REPORT_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-bridge-remote-doctor-last.json'),
    zavorthBridgeRemoteDoctorHistoryFile:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_REMOTE_DOCTOR_HISTORY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-bridge-remote-doctor-history.json'),
    zavorthBridgeRemoteDoctorRepairCooldownMinutes: parseEnvInt(
      process.env.ZAVORTH_ZAVORTH_BRIDGE_REMOTE_DOCTOR_REPAIR_COOLDOWN_MINUTES,
      10,
    ),
    zavorthBridgeRemoteDoctorFlappingWindowMinutes: parseEnvInt(
      process.env.ZAVORTH_ZAVORTH_BRIDGE_REMOTE_DOCTOR_FLAPPING_WINDOW_MINUTES,
      20,
    ),
    zavorthBridgeRemoteDoctorFlappingThreshold: parseEnvInt(
      process.env.ZAVORTH_ZAVORTH_BRIDGE_REMOTE_DOCTOR_FLAPPING_THRESHOLD,
      3,
    ),
    zavorthBridgeMobileLeaseTtlMs: parseEnvInt(
      process.env.ZAVORTH_ZAVORTH_BRIDGE_MOBILE_LEASE_TTL_MS,
      2 * 60 * 60 * 1000,
    ),
    zavorthBridgeMobileLeaseFile:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_MOBILE_LEASE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-bridge-mobile-lease.json'),
    zavorthBridgeMobileLeaseHistoryFile:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_MOBILE_LEASE_HISTORY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-bridge-mobile-lease-history.jsonl'),
    zavorthBridgePublicTunnelEnabled:
      (process.env.ZAVORTH_ZAVORTH_BRIDGE_PUBLIC_TUNNEL_ENABLED || 'true').toLowerCase() !== 'false',
    zavorthBridgePublicTunnelCliPath:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_PUBLIC_TUNNEL_CLI_PATH || 'cloudflared',
    zavorthBridgePublicTunnelReadyTimeoutMs: parseEnvInt(
      process.env.ZAVORTH_ZAVORTH_BRIDGE_PUBLIC_TUNNEL_READY_TIMEOUT_MS,
      15000,
    ),
    zavorthBridgePublicTunnelStateFile:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_PUBLIC_TUNNEL_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-bridge-public-tunnel.json'),
    zavorthBridgePublicTunnelLogFile:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_PUBLIC_TUNNEL_LOG_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-bridge-public-tunnel.log'),
    zavorthBridgePublicTunnelHostScriptPath:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_PUBLIC_TUNNEL_HOST_SCRIPT_PATH ||
      path.resolve(projectRoot, 'scripts', 'zavorth-bridge-public-tunnel-host.mjs'),
    zavorthPublicTunnelEnabled:
      (process.env.ZAVORTH_PUBLIC_TUNNEL_ENABLED || 'true').toLowerCase() !== 'false',
    zavorthPublicTunnelCliPath:
      process.env.ZAVORTH_PUBLIC_TUNNEL_CLI_PATH || 'cloudflared',
    zavorthPublicTunnelReadyTimeoutMs: parseEnvInt(
      process.env.ZAVORTH_PUBLIC_TUNNEL_READY_TIMEOUT_MS,
      15000,
    ),
    zavorthPublicTunnelStateFile:
      process.env.ZAVORTH_PUBLIC_TUNNEL_STATE_FILE ||
      publicTunnelStateFileFallback,
    zavorthPublicTunnelLogFile:
      process.env.ZAVORTH_PUBLIC_TUNNEL_LOG_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-public-tunnel.log'),
    zavorthPublicTunnelHostScriptPath:
      process.env.ZAVORTH_PUBLIC_TUNNEL_HOST_SCRIPT_PATH ||
      path.resolve(projectRoot, 'scripts', 'public-tunnel-host.mjs'),
    AIGatewayGatewayReadyTimeoutMs: parseEnvInt(
      process.env.ZAVORTH_AIGateway_GATEWAY_READY_TIMEOUT_MS,
      15000,
    ),
    AIGatewayGatewayStatusFile:
      process.env.ZAVORTH_AIGateway_GATEWAY_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'ai-gateway-last.json'),
    AIGatewaySyncStatusFile:
      process.env.ZAVORTH_AIGateway_SYNC_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'AIGateway-sync-last.json'),
    ZavorthTerminalSyncStatusFile:
      process.env.ZAVORTH_ZAVORTH_BRIDGE_REMOTE_SYNC_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-terminal-sync-last.json'),
    AIGatewayCompatibilityStatusFile:
      process.env.ZAVORTH_AIGateway_COMPAT_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'AIGateway-compat-last.json'),
    AIGatewayOverlayFile:
      process.env.ZAVORTH_AIGateway_OVERLAY_FILE ||
      path.resolve(projectRoot, 'config', 'AIGateway-overlay.json'),
    AIGatewayGatewayEntrypointFile:
      process.env.ZAVORTH_AIGateway_GATEWAY_ENTRYPOINT_FILE ||
      path.resolve(projectRoot, 'scripts', 'start-ai-gateway-runtime.mjs'),
    maintenanceAutomationEnabled:
      (process.env.ZAVORTH_MAINTENANCE_AUTOMATION_ENABLED || 'true').toLowerCase() !== 'false',
    maintenanceAutomationHour: parseEnvInt(process.env.ZAVORTH_MAINTENANCE_AUTOMATION_HOUR, 4),
    maintenanceAutomationMinute: parseEnvInt(process.env.ZAVORTH_MAINTENANCE_AUTOMATION_MINUTE, 30),
    maintenanceAutomationPriorityCooldownMs: parseEnvInt(
      process.env.ZAVORTH_MAINTENANCE_AUTOMATION_PRIORITY_COOLDOWN_MS,
      3600000,
    ),
    dailyReportEnabled: (process.env.ZAVORTH_DAILY_REPORT_ENABLED || 'true').toLowerCase() !== 'false',
    dailyReportHour: parseEnvInt(process.env.ZAVORTH_DAILY_REPORT_HOUR, 9),
    dailyReportMinute: parseEnvInt(process.env.ZAVORTH_DAILY_REPORT_MINUTE, 0),
    dailyReportRoles: parseList(process.env.ZAVORTH_DAILY_REPORT_ROLES || 'admin'),
    capabilityLifecycleStateFile:
      process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'capability-lifecycle-state.json'),
    modeEscalationStateFile:
      process.env.ZAVORTH_MODE_ESCALATION_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'mode-escalation-state.json'),
    desktopResourceLatestFile:
      process.env.ZAVORTH_DESKTOP_RESOURCE_LATEST_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'desktop-resource-latest.json'),
    desktopResourceHistoryFile:
      process.env.ZAVORTH_DESKTOP_RESOURCE_HISTORY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'desktop-resource-history.jsonl'),
    desktopResourceHistoryMaxEntries: parseEnvInt(process.env.ZAVORTH_DESKTOP_RESOURCE_HISTORY_MAX_ENTRIES, 60),
    companionsStateFile:
      process.env.ZAVORTH_COMPANIONS_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'companions-state.json'),
    workspaceLoadProfilesFile:
      process.env.ZAVORTH_WORKSPACE_LOAD_PROFILES_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'workspace-load-profiles.json'),
    workspaceProfilesDir: path.resolve(projectRoot, 'data', 'workspace-profiles'),
    operationalMemoryDir: path.resolve(projectRoot, 'data', 'operational-memory'),
    vendorMirrorDir: path.resolve(projectRoot, 'data', 'vendor-mirrors'),
    vendorWorktreeDir: path.resolve(projectRoot, 'data', 'vendor-worktrees'),
    AIGatewaySidecarWorktreeDir:
      process.env.AIGateway_SIDECAR_WORKTREE_DIR ||
      path.resolve(projectRoot, 'data', 'vendor-worktrees', 'AIGateway'),
    AIGatewaySidecarLogFile:
      process.env.AIGateway_SIDECAR_LOG_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'AIGateway-sidecar.log'),
    AIGatewaySidecarStatusFile:
      process.env.AIGateway_SIDECAR_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'AIGateway-sidecar.json'),
    ZavorthTerminalSidecarWorktreeDir:
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_WORKTREE_DIR ||
      path.resolve(projectRoot, 'apps', 'zavorth-terminal'),
    ZavorthTerminalSidecarLogFile:
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_LOG_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-terminal-sidecar.log'),
    ZavorthTerminalSidecarStatusFile:
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'zavorth-terminal-sidecar.json'),
    capabilityPluginsDir: process.env.ZAVORTH_CAPABILITY_PLUGINS_DIR || path.resolve(projectRoot, 'config', 'capability-plugins'),
    mcpServersManifestPath:
      process.env.ZAVORTH_MCP_SERVERS_MANIFEST_PATH ||
      path.resolve(projectRoot, 'config', 'mcp-servers.json'),
    hostSupervisorLockFile: path.resolve(projectRoot, 'data', 'runtime', 'host-supervisor.lock.json'),
    hostAutoRepairStateFile: path.resolve(projectRoot, 'data', 'runtime', 'host-autorepair-state.json'),
    processLockFile: path.resolve(projectRoot, 'data', 'runtime', 'zavorth-runtime.lock.json'),
    telegramProcessLockFile: path.resolve(projectRoot, 'data', 'runtime', 'telegram-bot.lock.json'),
    gatewaySessionLedgerDir:
      process.env.ZAVORTH_GATEWAY_SESSION_LEDGER_DIR ||
      path.resolve(projectRoot, 'data', 'runtime', 'gateway-session-ledger'),
    selfmodPreviewDir:
      process.env.ZAVORTH_SELFMOD_PREVIEW_DIR ||
      path.resolve(projectRoot, 'tmp', 'selfmod-previews'),
    selfmodGoalPreviewDir:
      process.env.ZAVORTH_SELFMOD_GOAL_PREVIEW_DIR ||
      path.resolve(projectRoot, 'tmp', 'selfmod-goal-previews'),
    selfmodHistoryDir:
      process.env.ZAVORTH_SELFMOD_HISTORY_DIR ||
      path.resolve(projectRoot, 'data', 'runtime', 'selfmod-history'),
    selfmodShadowWorkspaceDir:
      process.env.ZAVORTH_SELFMOD_SHADOW_WORKSPACE_DIR ||
      path.resolve(projectRoot, 'tmp', 'selfmod-shadow-workspaces'),
    selfmodPatternMemoryFile:
      process.env.ZAVORTH_SELFMOD_PATTERN_MEMORY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'selfmod-pattern-memory.json'),
    supervisedLauncherScriptPath: path.resolve(projectRoot, 'scripts', 'launch-zavorth-supervised.ps1'),
    supervisedReloadRequestScriptPath: path.resolve(projectRoot, 'scripts', 'request-supervised-reload.ps1'),
    supervisedAutoRepairRequestScriptPath: path.resolve(projectRoot, 'scripts', 'request-supervised-autorepair.ps1'),
    windowsSessionStatusScriptPath: path.resolve(projectRoot, 'scripts', 'windows-session-status.ps1'),
    stitchArtifactsDir: path.resolve(projectRoot, 'data', 'artifacts', 'stitch'),
    stitchTimeoutSeconds: parseEnvInt(process.env.STITCH_TIMEOUT_SECONDS, 240),
    stitchDefaultDeviceType: process.env.STITCH_DEFAULT_DEVICE_TYPE || 'AGNOSTIC',
    stitchDefaultModelId: process.env.STITCH_DEFAULT_MODEL_ID || '',
    autoRepairMaxAttempts: parseEnvInt(process.env.ZAVORTH_AUTOREPAIR_MAX_ATTEMPTS, 2),
    autoRepairPlannerConfidenceThreshold: parseFloat(
      process.env.ZAVORTH_AUTOREPAIR_PLANNER_CONFIDENCE_THRESHOLD || '0.45',
    ),
    backupRetentionDays: parseEnvInt(process.env.ZAVORTH_BACKUP_RETENTION_DAYS, 7),
    backupRetentionCount: parseEnvInt(process.env.ZAVORTH_BACKUP_RETENTION_COUNT, 3),
    runtimeMaintenanceIntervalMs: parseEnvInt(
      process.env.ZAVORTH_RUNTIME_MAINTENANCE_INTERVAL_MS,
      15 * 60 * 1000,
    ),
    goalLoopDaemonEnabled: (process.env.ZAVORTH_GOAL_LOOP_DAEMON_ENABLED || 'true').toLowerCase() !== 'false',
    goalLoopDaemonIntervalMs: parseEnvInt(process.env.ZAVORTH_GOAL_LOOP_DAEMON_INTERVAL_MS, 15000),
    goalLoopDaemonLeaseMs: parseEnvInt(process.env.ZAVORTH_GOAL_LOOP_DAEMON_LEASE_MS, 5 * 60 * 1000),
    goalLoopDaemonStaleAfterMs: parseEnvInt(process.env.ZAVORTH_GOAL_LOOP_DAEMON_STALE_AFTER_MS, 10 * 60 * 1000),
    goalLoopDaemonMaxItems: parseEnvInt(process.env.ZAVORTH_GOAL_LOOP_DAEMON_MAX_ITEMS, 5),
    userModelDaemonEnabled: (process.env.ZAVORTH_USER_MODEL_DAEMON_ENABLED || 'true').toLowerCase() !== 'false',
    userModelDaemonIntervalMs: parseEnvInt(process.env.ZAVORTH_USER_MODEL_DAEMON_INTERVAL_MS, 5 * 60 * 1000),
    userModelDaemonMinTurns: parseEnvInt(process.env.ZAVORTH_USER_MODEL_DAEMON_MIN_TURNS, 5),
    userModelDaemonEnableLlmReasoning: (process.env.ZAVORTH_USER_MODEL_DAEMON_ENABLE_LLM || 'true').toLowerCase() !== 'false',
    userModelDaemonLlmProvider: process.env.ZAVORTH_USER_MODEL_DAEMON_LLM_PROVIDER || undefined,
    userModelDaemonLlmModel: process.env.ZAVORTH_USER_MODEL_DAEMON_LLM_MODEL || undefined,
    userModelDaemonLlmMaxPasses: parseEnvInt(process.env.ZAVORTH_USER_MODEL_DAEMON_LLM_MAX_PASSES, 3),
    runtimeLogRotationMaxBytes: parseEnvInt(process.env.ZAVORTH_RUNTIME_LOG_ROTATION_MAX_BYTES, 25 * 1024 * 1024),
    runtimeLogRotationMaxFiles: parseEnvInt(process.env.ZAVORTH_RUNTIME_LOG_ROTATION_MAX_FILES, 5),
    visualSmokeMaxBytes: parseEnvInt(process.env.ZAVORTH_VISUAL_SMOKE_MAX_BYTES, 1024 * 1024 * 1024),
    visualSmokeTtlMs: parseEnvInt(process.env.ZAVORTH_VISUAL_SMOKE_TTL_MS, 24 * 60 * 60 * 1000),

    // Audio
    ttsVoice: process.env.TTS_VOICE || 'en-US-JennyNeural',
    ttsVoiceEnglish:
      process.env.TTS_VOICE_EN ||
      process.env.ZAVORTH_AUDIO_TTS_EDGE_VOICE_EN ||
      '',
    ttsVoiceSpanish:
      process.env.TTS_VOICE_ES ||
      process.env.ZAVORTH_AUDIO_TTS_EDGE_VOICE_ES ||
      '',
  };
}
