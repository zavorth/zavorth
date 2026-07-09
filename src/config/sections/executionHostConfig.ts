import path from 'path';
import { parseEnvInt, parseEnvFloat } from '../envParsers';

import {
  readZavorthEnv,
  ZavorthProductMode,
  ZavorthProfile,
  resolveDefaultHostMemoryMb,
} from '../configHelpers';

export function buildExecutionHostConfig(
  projectRoot: string,
  defaultProfile: ZavorthProfile,
  defaultProductMode: ZavorthProductMode,
) {
  const firecrackerEnabled = readZavorthEnv('ZAVORTH_FIRECRACKER_ENABLED', 'false');
  const capabilityPolicy = readZavorthEnv('ZAVORTH_CAPABILITY_POLICY', 'ask-on-demand');
  const selfmodPolicy = readZavorthEnv('ZAVORTH_SELFMOD_POLICY', 'owner_trusted');
  const allowStartupInstall = readZavorthEnv('ZAVORTH_ALLOW_STARTUP_INSTALL', 'false');

  return {
    // Agent Loop
    maxIterations: parseEnvInt(process.env.MAX_ITERATIONS, 5),
    graphMaxToolRounds: parseEnvInt(process.env.ZAVORTH_GRAPH_MAX_TOOL_ROUNDS, 4),
    graphTokenBudget: parseEnvInt(process.env.ZAVORTH_GRAPH_TOKEN_BUDGET, 64000),
    graphCostBudgetUsd: parseEnvFloat(process.env.ZAVORTH_GRAPH_COST_BUDGET_USD, 1),
    graphEstimatedCostPer1kTokensUsd: parseEnvFloat(
      process.env.ZAVORTH_GRAPH_ESTIMATED_COST_PER_1K_TOKENS_USD, 0.01,
    ),
    graphResearchDeepModel: process.env.ZAVORTH_GRAPH_RESEARCH_DEEP_MODEL || '',
    graphResearchSummaryModel: process.env.ZAVORTH_GRAPH_RESEARCH_SUMMARY_MODEL || '',
    graphCodeReasoningModel: process.env.ZAVORTH_GRAPH_CODE_REASONING_MODEL || '',
    graphAutomationModel: process.env.ZAVORTH_GRAPH_AUTOMATION_MODEL || '',

    // Security / Host
    dbEncryptionKey: process.env.ZAVORTH_DB_ENCRYPTION_KEY || '',
    dbEncryptionKeyFile:
      process.env.ZAVORTH_DB_ENCRYPTION_KEY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'db-field.key'),
    secureSecretsFile:
      process.env.ZAVORTH_SECURE_SECRETS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'secure-secrets.json'),
    highRiskApprovalPin: process.env.ZAVORTH_HIGH_RISK_APPROVAL_PIN || '',
    highRiskApprovalTotpSecretRef: process.env.ZAVORTH_HIGH_RISK_TOTP_SECRET_REF || 'high-risk-approval-totp',
    highRiskApprovalAllowEnvFallback:
      (process.env.ZAVORTH_HIGH_RISK_TOTP_ALLOW_ENV_FALLBACK || 'false').toLowerCase() === 'true',
    highRiskApprovalTotpSecret: process.env.ZAVORTH_HIGH_RISK_TOTP_SECRET || '',
    hostIdentityFile:
      process.env.ZAVORTH_HOST_IDENTITY_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'authorized-host.json'),
    mailboxSecretFile:
      process.env.ZAVORTH_MAILBOX_SECRET_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'mailbox-secret.key'),
    dockerSandboxEnabled: (process.env.ZAVORTH_DOCKER_SANDBOX_ENABLED || 'true').toLowerCase() !== 'false',
    dockerSandboxRequired: (process.env.ZAVORTH_DOCKER_SANDBOX_REQUIRED || 'false').toLowerCase() === 'true',
    dockerCliPath: process.env.DOCKER_CLI_PATH || 'docker',
    dockerSandboxImage: process.env.ZAVORTH_DOCKER_SANDBOX_IMAGE || 'node:22-bullseye',
    dockerSandboxJavascriptImage:
      process.env.ZAVORTH_DOCKER_SANDBOX_JAVASCRIPT_IMAGE ||
      process.env.ZAVORTH_DOCKER_SANDBOX_IMAGE ||
      'node:22-bullseye',
    dockerSandboxPythonImage:
      process.env.ZAVORTH_DOCKER_SANDBOX_PYTHON_IMAGE || 'python:3.12-slim',
    dockerSandboxShellImage:
      process.env.ZAVORTH_DOCKER_SANDBOX_SHELL_IMAGE ||
      process.env.ZAVORTH_DOCKER_SANDBOX_IMAGE ||
      'bash:5.2',
    dockerSandboxAutoPull:
      (process.env.ZAVORTH_DOCKER_SANDBOX_AUTO_PULL || 'false').toLowerCase() === 'true',
    dockerSandboxProbeTimeoutMs: parseEnvInt(process.env.ZAVORTH_DOCKER_SANDBOX_PROBE_TIMEOUT_MS, 5000),
    dockerSandboxPullTimeoutMs: parseEnvInt(process.env.ZAVORTH_DOCKER_SANDBOX_PULL_TIMEOUT_MS, 120000),
    dockerSandboxMemoryMb: parseEnvInt(process.env.ZAVORTH_DOCKER_SANDBOX_MEMORY_MB, 1024),
    dockerSandboxCpuLimit: parseEnvFloat(process.env.ZAVORTH_DOCKER_SANDBOX_CPU_LIMIT, 1.5),
    dockerSandboxRuntime: process.env.ZAVORTH_DOCKER_SANDBOX_RUNTIME || '',
    dockerSandboxPidsLimit: parseInt(process.env.ZAVORTH_DOCKER_SANDBOX_PIDS_LIMIT || '64', 10),
    dockerSandboxReadOnly: (process.env.ZAVORTH_DOCKER_SANDBOX_READ_ONLY || 'true').toLowerCase() !== 'false',
    dockerSandboxCapDropAll: (process.env.ZAVORTH_DOCKER_SANDBOX_CAP_DROP_ALL || 'true').toLowerCase() !== 'false',
    dockerSandboxNoNewPrivileges: (process.env.ZAVORTH_DOCKER_SANDBOX_NO_NEW_PRIVILEGES || 'true').toLowerCase() !== 'false',
    dockerSandboxWorkspacePath: process.env.ZAVORTH_DOCKER_SANDBOX_WORKSPACE_PATH || '/workspace',

    // Wasm sandbox capability plane (phase 4)
    wasmSandboxEnabled: (process.env.ZAVORTH_WASM_SANDBOX_ENABLED || 'false').toLowerCase() === 'true',
    wasmSandboxMaxExecutionMs: parseEnvInt(process.env.ZAVORTH_WASM_SANDBOX_MAX_EXECUTION_MS, 5000),
    wasmSandboxMaxBytes: parseEnvInt(process.env.ZAVORTH_WASM_SANDBOX_MAX_BYTES, 262144),

    // Firecracker MicroVM (highest security tier)
    firecrackerEnabled: firecrackerEnabled.toLowerCase() === 'true',
    firecrackerTransport:
      process.platform === 'win32'
        ? ((process.env.ZAVORTH_FIRECRACKER_TRANSPORT || 'wsl').toLowerCase() === 'wsl' ? 'wsl' : 'direct')
        : 'direct',
    firecrackerWslDistro: process.env.ZAVORTH_FIRECRACKER_WSL_DISTRO || 'Ubuntu-24.04',
    firecrackerWslUser: process.env.ZAVORTH_FIRECRACKER_WSL_USER || 'root',
    firecrackerWslBridgeIdleMs: parseEnvInt(process.env.ZAVORTH_FIRECRACKER_WSL_BRIDGE_IDLE_MS, 300000),
    firecrackerBinPath: process.env.ZAVORTH_FIRECRACKER_BIN_PATH || 'firecracker',
    firecrackerKernelPath:
      process.env.ZAVORTH_FIRECRACKER_KERNEL_PATH ||
      path.resolve(projectRoot, 'data', 'firecracker', 'vmlinux'),
    firecrackerRootfsPath:
      process.env.ZAVORTH_FIRECRACKER_ROOTFS_PATH ||
      path.resolve(projectRoot, 'data', 'firecracker', 'rootfs.ext4'),
    firecrackerVcpuCount: parseEnvInt(process.env.ZAVORTH_FIRECRACKER_VCPU_COUNT, 1),
    firecrackerMemSizeMib: parseEnvInt(process.env.ZAVORTH_FIRECRACKER_MEM_SIZE_MIB, 512),
    firecrackerExecutionTimeoutMs: parseEnvInt(process.env.ZAVORTH_FIRECRACKER_EXECUTION_TIMEOUT_MS, 30000),

    asyncQueueEnabled: (process.env.ZAVORTH_ASYNC_QUEUE_ENABLED || 'true').toLowerCase() !== 'false',
    asyncQueuePollIntervalMs: parseEnvInt(process.env.ZAVORTH_ASYNC_QUEUE_POLL_INTERVAL_MS, 4000),
    asyncQueueLockTimeoutMs: parseEnvInt(process.env.ZAVORTH_ASYNC_QUEUE_LOCK_TIMEOUT_MS, 180000),
    asyncQueueWorkerId:
      process.env.ZAVORTH_ASYNC_QUEUE_WORKER_ID ||
      `${process.env.COMPUTERNAME || process.env.HOSTNAME || 'host'}-${process.pid}`,
    zavorthProfile: defaultProfile,
    zavorthProductMode: defaultProductMode,
    zavorthCapabilityPolicy:
      capabilityPolicy.trim().toLowerCase() || 'ask-on-demand',
    zavorthSelfmodPolicy:
      selfmodPolicy.trim().toLowerCase() || 'owner_trusted',
    zavorthAllowStartupInstall:
      allowStartupInstall.toLowerCase() === 'true',
    hostResourceMaxMemoryMb: parseEnvInt(process.env.ZAVORTH_HOST_MAX_MEMORY_MB, resolveDefaultHostMemoryMb(defaultProfile)),
    hostResourceMaxCpuPercent: parseEnvFloat(process.env.ZAVORTH_HOST_MAX_CPU_PERCENT, 85),
    hostResourceBreachLimit: parseEnvInt(process.env.ZAVORTH_HOST_RESOURCE_BREACH_LIMIT, 2),
    hostCrashLoopWindowMs: parseEnvInt(process.env.ZAVORTH_HOST_CRASH_LOOP_WINDOW_MS, 300000),
    hostAutoRepairCooldownMs: parseEnvInt(process.env.ZAVORTH_HOST_AUTOREPAIR_COOLDOWN_MS, 600000),
    configGitEnabled: (process.env.ZAVORTH_CONFIG_GIT_ENABLED || 'true').toLowerCase() !== 'false',
    configGitRepoDir:
      process.env.ZAVORTH_CONFIG_GIT_REPO_DIR ||
      path.resolve(projectRoot, 'data', 'config-gitops', 'repo'),
    conversationSummaryEnabled:
      (process.env.ZAVORTH_CONVERSATION_SUMMARY_ENABLED || 'true').toLowerCase() !== 'false',
    conversationSummaryMaxTurns: parseEnvInt(process.env.ZAVORTH_CONVERSATION_SUMMARY_MAX_TURNS, 12),
    conversationSummaryKeepTurns: parseEnvInt(process.env.ZAVORTH_CONVERSATION_SUMMARY_KEEP_TURNS, 6),
    conversationSummaryMaxChars: parseEnvInt(process.env.ZAVORTH_CONVERSATION_SUMMARY_MAX_CHARS, 6000),
    aiStudioMaxToolRounds: parseEnvInt(process.env.AISTUDIO_MAX_TOOL_ROUNDS, 4),
    aiStudioAllowServiceRequests: (process.env.AISTUDIO_ALLOW_SERVICE_REQUESTS || 'true').toLowerCase() !== 'false',
  };
}
