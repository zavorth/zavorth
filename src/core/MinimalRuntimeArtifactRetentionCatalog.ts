import path from 'path';

export type MinimalRuntimeArtifactKind =
  | 'jsonl-ledger'
  | 'jsonl-history'
  | 'json-state'
  | 'lock-state'
  | 'binary-artifact'
  | 'secret'
  | 'text-history'
  | 'text-token';

export type MinimalRuntimeArtifactStrategy =
  | 'activation-ledger-compactor'
  | 'desktop-resource-history-compactor'
  | 'agent-run-history-compactor'
  | 'workflow-job-history-compactor'
  | 'jsonl-tail-compactor'
  | 'state-size-gate'
  | 'secret-size-gate'
  | 'text-size-gate';

export type MinimalRuntimeArtifactRetentionRule = {
  fileName: string;
  owner: string;
  kind: MinimalRuntimeArtifactKind;
  strategy: MinimalRuntimeArtifactStrategy;
  maxBytes: number;
  maxLines?: number;
  maxItems?: number;
  description: string;
};

export type MinimalRuntimeArtifactRetentionSnapshot = {
  version: 1;
  rules: MinimalRuntimeArtifactRetentionRule[];
};

export class MinimalRuntimeArtifactRetentionCatalog {
  private readonly rules: MinimalRuntimeArtifactRetentionRule[];

  public constructor(rules: MinimalRuntimeArtifactRetentionRule[] = DEFAULT_RUNTIME_ARTIFACT_RETENTION_RULES) {
    this.rules = rules.map((rule) => ({
      ...rule,
      fileName: normalizeFileName(rule.fileName),
      maxBytes: positiveInteger(rule.maxBytes, 1),
      ...(rule.maxLines !== undefined ? { maxLines: positiveInteger(rule.maxLines, 1) } : {}),
      ...(rule.maxItems !== undefined ? { maxItems: positiveInteger(rule.maxItems, 1) } : {}),
    }));
  }

  public lookup(filePathOrName: string): MinimalRuntimeArtifactRetentionRule | null {
    const fileName = normalizeFileName(path.basename(filePathOrName));
    return this.rules.find((rule) => rule.fileName === fileName) || null;
  }

  public snapshot(): MinimalRuntimeArtifactRetentionSnapshot {
    return {
      version: 1,
      rules: this.rules.map((rule) => ({ ...rule })),
    };
  }
}

export const DEFAULT_RUNTIME_ARTIFACT_RETENTION_RULES: MinimalRuntimeArtifactRetentionRule[] = [
  {
    fileName: 'capability-activation-ledger.jsonl',
    owner: 'core.capability-activation',
    kind: 'jsonl-ledger',
    strategy: 'activation-ledger-compactor',
    maxBytes: 1_048_576,
    maxItems: 500,
    description: 'Receipts for capability plan, activation, replay, and rollback operations.',
  },
  {
    fileName: 'runtime-mode-ledger.jsonl',
    owner: 'core.runtime-mode-governor',
    kind: 'jsonl-ledger',
    strategy: 'state-size-gate',
    maxBytes: 524_288,
    maxLines: 5_000,
    description: 'Temporary runtime profile lease receipts for mode escalation and release.',
  },
  {
    fileName: 'desktop-resource-history.jsonl',
    owner: 'services.desktop-resource-plane',
    kind: 'jsonl-history',
    strategy: 'desktop-resource-history-compactor',
    maxBytes: 1_048_576,
    maxLines: 5_000,
    description: 'Compacted desktop resource snapshots for local diagnostics.',
  },
  {
    fileName: 'desktop-resource-latest.json',
    owner: 'services.desktop-resource-plane',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Latest full desktop resource snapshot.',
  },
  {
    fileName: 'minimal-kernel-state.json',
    owner: 'core.minimal-runtime-kernel',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Minimal runtime kernel state snapshot.',
  },
  {
    fileName: 'operations-health-fast.json',
    owner: 'ops.health',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Fast operations health state.',
  },
  {
    fileName: 'universal-agent-runs.json',
    owner: 'runtime.agent-runs',
    kind: 'json-state',
    strategy: 'agent-run-history-compactor',
    maxBytes: 8_388_608,
    maxItems: 8,
    description: 'Bounded universal agent run state; active and recent runs stay full while older terminal runs are compacted.',
  },
  {
    fileName: 'runtime-diagnostics.json',
    owner: 'ops.runtime-diagnostics',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Latest runtime diagnostics snapshot.',
  },
  {
    fileName: 'mcp-runtime-state.json',
    owner: 'runtime.mcp',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'MCP runtime state.',
  },
  {
    fileName: 'capability-lifecycle-state.json',
    owner: 'core.capability-lifecycle',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Capability lifecycle state.',
  },
  {
    fileName: 'tenant-registry.json',
    owner: 'runtime.tenant-registry',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Tenant registry state.',
  },
  {
    fileName: 'surface-identities.json',
    owner: 'runtime.surface-identities',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Surface identity registry state.',
  },
  {
    fileName: 'discord-bridge-status.json',
    owner: 'channels.discord',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 32_768,
    description: 'Discord bridge status snapshot.',
  },
  {
    fileName: 'browser-sidecar-v2.json',
    owner: 'capabilities.browser',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 32_768,
    description: 'Browser sidecar status heartbeat.',
  },
  {
    fileName: 'browser-sidecar.json',
    owner: 'capabilities.browser-sidecar',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 32_768,
    description: 'Runtime browser sidecar health heartbeat for Run Observatory.',
  },
  {
    fileName: 'sidecar-docker-bootstrap-last.json',
    owner: 'runtime.sidecar-bootstrap',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 65_536,
    description: 'Latest Docker/Firecracker sidecar bootstrap readiness report.',
  },
  {
    fileName: 'sidecar-execution-receipts.jsonl',
    owner: 'runtime.sidecar-receipts',
    kind: 'jsonl-ledger',
    strategy: 'state-size-gate',
    maxBytes: 1_048_576,
    maxLines: 5_000,
    description: 'Append-only receipts for isolated shell and browser sidecar executions.',
  },
  {
    fileName: 'browser-sidecar-v2.log',
    owner: 'capabilities.browser',
    kind: 'text-history',
    strategy: 'text-size-gate',
    maxBytes: 1_048_576,
    description: 'Browser sidecar process log.',
  },
  {
    fileName: 'browser-sidecar-latest-screenshot.png',
    owner: 'capabilities.browser',
    kind: 'binary-artifact',
    strategy: 'state-size-gate',
    maxBytes: 5_242_880,
    description: 'Latest browser sidecar screenshot artifact.',
  },
  {
    fileName: 'universal-agent-workflow-jobs.json',
    owner: 'runtime.agent-workflows',
    kind: 'json-state',
    strategy: 'workflow-job-history-compactor',
    maxBytes: 6_291_456,
    maxItems: 5,
    description: 'Bounded universal agent workflow job state; active jobs stay full while older terminal jobs are compacted.',
  },
  {
    fileName: 'authorized-host.json',
    owner: 'security.authorized-host',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 16_384,
    description: 'local authorized host binding used by the desktop/runtime boundary.',
  },
  {
    fileName: 'channel-provider-doctor-last.json',
    owner: 'channels.provider-doctor',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 65_536,
    description: 'Latest channel/provider readiness doctor result.',
  },
  {
    fileName: 'integration-action-history.jsonl',
    owner: 'integrations.action-plane',
    kind: 'jsonl-history',
    strategy: 'jsonl-tail-compactor',
    maxBytes: 1_048_576,
    maxLines: 2_000,
    maxItems: 2_000,
    description: 'Bounded integration action execution history.',
  },
  {
    fileName: 'integration-action-last.json',
    owner: 'integrations.action-plane',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 65_536,
    description: 'Latest integration action execution result.',
  },
  {
    fileName: 'node-mesh-secrets.json',
    owner: 'runtime.node-mesh',
    kind: 'secret',
    strategy: 'secret-size-gate',
    maxBytes: 16_384,
    description: 'local Node Mesh secret references and non-exportable local secret state.',
  },
  {
    fileName: 'node-mesh-state.json',
    owner: 'runtime.node-mesh',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 65_536,
    description: 'local Node Mesh status and pairing state.',
  },
  {
    fileName: 'security-audit-last.json',
    owner: 'security.audit',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 65_536,
    description: 'Latest local security audit summary.',
  },
  {
    fileName: 'local-profile-preferences.json',
    owner: 'runtime.local-profile-preferences',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 262_144,
    description: 'Unified local profile preferences for ZavorthControl, capabilities, voice, autonomy, and product modes.',
  },
  {
    fileName: 'sales-pack-business-mode-state.json',
    owner: 'runtime.local-profile-preferences.legacy-sales-pack',
    kind: 'json-state',
    strategy: 'state-size-gate',
    maxBytes: 65_536,
    description: 'Read-only legacy Business Mode preference state kept for local migration compatibility.',
  },
  {
    fileName: 'telemetry-events.jsonl',
    owner: 'telemetry.runtime-events',
    kind: 'jsonl-history',
    strategy: 'jsonl-tail-compactor',
    maxBytes: 2_097_152,
    maxLines: 5_000,
    maxItems: 5_000,
    description: 'Bounded local telemetry events used for diagnostics and learning receipts.',
  },
  {
    fileName: 'host-supervisor.lock.json',
    owner: 'runtime.host-supervisor',
    kind: 'lock-state',
    strategy: 'state-size-gate',
    maxBytes: 8_192,
    description: 'Host supervisor lock state.',
  },
  {
    fileName: 'telegram-bot.lock.json',
    owner: 'channels.telegram',
    kind: 'lock-state',
    strategy: 'state-size-gate',
    maxBytes: 8_192,
    description: 'Telegram bot lock state.',
  },
  {
    fileName: 'db-field.key',
    owner: 'runtime.local-secret',
    kind: 'secret',
    strategy: 'secret-size-gate',
    maxBytes: 4_096,
    description: 'local database field encryption key.',
  },
  {
    fileName: 'mailbox-secret.key',
    owner: 'runtime.mailbox',
    kind: 'secret',
    strategy: 'secret-size-gate',
    maxBytes: 4_096,
    description: 'local mailbox secret.',
  },
  {
    fileName: 'web-api-token.txt',
    owner: 'runtime.web-api',
    kind: 'text-token',
    strategy: 'secret-size-gate',
    maxBytes: 4_096,
    description: 'local web API token.',
  },
  {
    fileName: 'zavorth-cli-history.txt',
    owner: 'cli.repl-history',
    kind: 'text-history',
    strategy: 'text-size-gate',
    maxBytes: 65_536,
    description: 'Small CLI REPL history.',
  },
];

function normalizeFileName(fileName: string): string {
  return fileName.trim().toLowerCase();
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
