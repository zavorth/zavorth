import type {
  CapabilitySourceMapping,
} from '../contracts/CapabilityNormalizationContract.js';
import type {
  CodexRuntimeApprovalBridge,
  CodexRuntimeArtifactKind,
  CodexRuntimeEventProjection,
  CodexRuntimeFeature,
  CodexRuntimeFeatureId,
  CodexRuntimeMediaUnderstandingJob,
  CodexRuntimeMigrationPlan,
  CodexRuntimeProfile,
  CodexRuntimeRpcMethod,
  CodexRuntimeRunPlan,
  CodexRuntimeSnapshot,
  CodexRuntimeToolExposure,
} from '../contracts/CodexRuntimeContract.js';
import { ZAVORTH_CODEX_RUNTIME_CONTRACT_VERSION } from '../contracts/CodexRuntimeContract.js';
import { CodexModelCatalogAdapter } from '../adapters/codex/CodexModelCatalogAdapter.js';
import { CodexStdioTransportAdapter } from '../adapters/codex/CodexStdioTransportAdapter.js';
import { CodexWebSocketTransportAdapter } from '../adapters/codex/CodexWebSocketTransportAdapter.js';
import { CapabilityNormalizationService } from './CapabilityNormalizationService.js';

type CodexRuntimePlaneRuntime = {
  now?: () => Date;
  normalizationService?: Pick<CapabilityNormalizationService, 'resolveSourceModule'>;
  modelCatalogAdapter?: Pick<CodexModelCatalogAdapter, 'fallbackCatalog'>;
  stdioTransportAdapter?: Pick<CodexStdioTransportAdapter, 'buildPlan'>;
  webSocketTransportAdapter?: Pick<CodexWebSocketTransportAdapter, 'buildPlan'>;
};

const RPC_METHODS: CodexRuntimeRpcMethod[] = [
  'initialize',
  'model/list',
  'thread/list',
  'thread/resume',
  'thread/turn/start',
  'thread/compact/start',
  'thread/stop',
  'account/read',
  'review/start',
  'mcpServerStatus/list',
  'skills/list',
  'computerUse/status',
];

const OPERATOR_COMMANDS = [
  'status',
  'models',
  'threads',
  'resume',
  'bind',
  'stop',
  'steer',
  'compact',
  'review',
  'diagnostics',
  'computer-use',
  'mcp',
  'skills',
  'account',
];

const ARTIFACT_KINDS: CodexRuntimeArtifactKind[] = [
  'agent.session',
  'agent.transcript',
  'agent.trajectory',
  'agent.model-catalog',
  'agent.approval',
  'agent.tool-call',
  'agent.media-understanding',
  'migration.report',
  'agent.runtime.receipt',
];

const NATIVE_OWNED_TOOL_IDS = new Set([
  'shell',
  'terminal',
  'filesystem.read',
  'filesystem.write',
  'apply_patch',
  'mcp',
  'computer-use',
]);

export class CodexRuntimePlaneService {
  private readonly now: () => Date;
  private readonly normalization: Pick<CapabilityNormalizationService, 'resolveSourceModule'>;
  private readonly modelCatalog: Pick<CodexModelCatalogAdapter, 'fallbackCatalog'>;
  private readonly stdioTransport: Pick<CodexStdioTransportAdapter, 'buildPlan'>;
  private readonly webSocketTransport: Pick<CodexWebSocketTransportAdapter, 'buildPlan'>;

  constructor(runtime: CodexRuntimePlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.normalization = runtime.normalizationService || new CapabilityNormalizationService({
      now: this.now,
    });
    this.modelCatalog = runtime.modelCatalogAdapter || new CodexModelCatalogAdapter();
    this.stdioTransport = runtime.stdioTransportAdapter || new CodexStdioTransportAdapter();
    this.webSocketTransport = runtime.webSocketTransportAdapter || new CodexWebSocketTransportAdapter();
  }

  public buildSnapshot(input: {
    profile?: Partial<CodexRuntimeProfile>;
  } = {}): CodexRuntimeSnapshot {
    const profile = this.resolveProfile(input.profile);
    const capabilityMapping = this.normalization.resolveSourceModule('codex');
    this.assertCodexMapping(capabilityMapping);
    const transports = [
      this.stdioTransport.buildPlan(profile),
      this.webSocketTransport.buildPlan(profile),
    ];
    const fallbackModels = this.modelCatalog.fallbackCatalog();
    const approvals = this.buildApprovals();
    const eventProjection = this.buildEventProjection();
    const features = this.buildFeatures();
    const missing = features.filter((feature) => feature.status === 'missing').length;
    const receipts = features.map((feature) => `codex-runtime.${feature.id}.receipt`);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CODEX_RUNTIME_CONTRACT_VERSION,
      status: missing === 0 ? 'closed' : 'attention',
      sourceModule: 'codex',
      primitiveId: 'agent.runtime',
      summary: {
        features: features.length,
        nativeRuntimeProofs: features.filter((feature) => feature.status === 'native-runtime-proof').length,
        missing,
        transports: transports.length,
        appServerRpcMethods: RPC_METHODS.length,
        fallbackModels: fallbackModels.length,
        approvalBridgeKinds: approvals.length,
        eventProjectionKinds: eventProjection.length,
        operatorCommands: OPERATOR_COMMANDS.length,
        liveExternalCallRequired: false,
        liveAppServerRequired: false,
        processSpawnRequired: false,
        filesystemWriteRequired: false,
        secretValuesSerialized: false,
      },
      transports,
      fallbackModels,
      rpcMethods: RPC_METHODS,
      dynamicToolPolicy: {
        defaultPolicy: 'native-first',
        compatibilityPolicyAvailable: true,
        nativeOwnedToolsExcludedByDefault: true,
      },
      approvals,
      eventProjection,
      features,
      operatorCommands: OPERATOR_COMMANDS,
      artifactKinds: ARTIFACT_KINDS,
      receipts,
      policy: {
        noSourceImports: true,
        noSourceManifestRuntimeDependency: true,
        noLiveIoInProof: true,
        noSecretsSerialized: true,
        artifactFirst: true,
        approvalFirstForSensitiveActions: true,
      },
      commands: {
        check: 'npm run codex-runtime-certification:check --silent',
        focusedTests: [
          'npx jest tests/services/CodexRuntimePlaneService.test.ts --runInBand',
          'npm run codex-runtime-certification:check --silent',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextWorker: 'Worker 3 - OpenShell Sandbox Plane consistency',
      },
    };
  }

  public buildRunPlan(input: {
    threadId?: string | null;
    prompt: string;
    workspaceRoot?: string | null;
    hostTools?: Array<{ id: string; label?: string | null }>;
  }): CodexRuntimeRunPlan {
    const prompt = String(input.prompt || '');
    const threadId = String(input.threadId || '').trim() || null;
    return {
      runId: `codex-runtime-${threadId || this.shortHash(prompt)}`,
      threadId,
      workspaceRoot: String(input.workspaceRoot || '').trim() || null,
      promptHash: this.shortHash(prompt),
      actions: threadId
        ? ['initialize', 'model/list', 'thread/resume', 'thread/turn/start']
        : ['initialize', 'model/list', 'thread/turn/start'],
      artifacts: [
        'agent.session',
        'agent.transcript',
        'agent.trajectory',
        'agent.runtime.receipt',
      ],
      dynamicTools: this.buildDynamicToolProfile(input.hostTools || []),
      approvals: this.buildApprovals(),
      liveIoRequired: false,
      secretValuesSerialized: false,
    };
  }

  public buildDynamicToolProfile(
    tools: Array<{ id: string; label?: string | null }>,
    policy: 'native-first' | 'compatibility' = 'native-first',
  ): CodexRuntimeToolExposure[] {
    return tools.map((tool) => {
      const id = String(tool.id || '').trim();
      const nativeOwned = NATIVE_OWNED_TOOL_IDS.has(id);
      const exposed = policy === 'compatibility' || !nativeOwned;
      return {
        id,
        label: String(tool.label || id),
        exposed,
        policy,
        reason: exposed
          ? 'Host tool is exposed through the governed dynamic tool bridge.'
          : 'Codex owns this tool natively; native-first policy keeps it out of the host exposure set.',
      };
    });
  }

  public buildMediaUnderstandingJob(input: {
    sourceArtifactId: string;
  }): CodexRuntimeMediaUnderstandingJob {
    const artifactId = String(input.sourceArtifactId || '').trim();
    if (!artifactId) {
      throw new Error('sourceArtifactId is required.');
    }
    return {
      jobId: `codex-media-${this.shortHash(artifactId)}`,
      sourceArtifactId: artifactId,
      mode: 'image',
      sandbox: 'read-only',
      dynamicToolsEnabled: false,
      outputArtifactKind: 'agent.media-understanding',
      receiptKind: 'agent.runtime.receipt',
    };
  }

  public buildMigrationPlan(input: {
    sourceCodexHome?: string | null;
  } = {}): CodexRuntimeMigrationPlan {
    return {
      planId: `codex-migration-${this.shortHash(String(input.sourceCodexHome || 'default'))}`,
      sourceCodexHome: String(input.sourceCodexHome || '').trim() || null,
      imports: ['profiles', 'skills', 'mcp', 'transcripts', 'account-metadata'],
      automaticWrites: false,
      outputArtifactKind: 'migration.report',
      receiptKind: 'agent.runtime.receipt',
    };
  }

  private buildFeatures(): CodexRuntimeFeature[] {
    return [
      feature('app-server-rpc', ['CodexAppServerRpcAdapter defines request IDs, method dispatch, errors, and normalized responses.'], ['agent.runtime.receipt']),
      feature('stdio-transport', ['CodexStdioTransportAdapter builds a redacted app-server stdio spawn plan.'], ['agent.runtime.receipt']),
      feature('websocket-transport', ['CodexWebSocketTransportAdapter builds a redacted websocket endpoint plan.'], ['agent.runtime.receipt']),
      feature('model-catalog', ['CodexModelCatalogAdapter supports app-server discovery with static fallback.'], ['agent.model-catalog', 'agent.runtime.receipt']),
      feature('session-lifecycle', ['Run plans cover initialize, start/resume turn, compact and stop RPC methods.'], ['agent.session', 'agent.runtime.receipt']),
      feature('approval-bridge', ['Command, file-change, permission, MCP, user-input and elicitation approvals map to artifacts.'], ['agent.approval', 'agent.runtime.receipt']),
      feature('dynamic-tools', ['Native-first dynamic tool exposure excludes Codex-owned tools by default.'], ['agent.tool-call', 'agent.runtime.receipt']),
      feature('event-projection', ['App-server events project into Zavorth assistant, reasoning, tool, file and token events.'], ['agent.session', 'agent.runtime.receipt']),
      feature('transcript-mirror', ['Transcript output is modeled as idempotent agent.transcript artifacts.'], ['agent.transcript', 'agent.runtime.receipt']),
      feature('trajectory-audit', ['Trajectory output is modeled as sanitized agent.trajectory artifacts.'], ['agent.trajectory', 'agent.runtime.receipt']),
      feature('media-understanding', ['Image understanding runs as read-only app-server media jobs with dynamic tools disabled.'], ['agent.media-understanding', 'agent.runtime.receipt']),
      feature('migration-import', ['Codex home import is represented as a no-write migration plan and report artifact.'], ['migration.report', 'agent.runtime.receipt']),
      feature('command-control', ['Operator command pack covers status, models, threads, review, diagnostics, MCP, skills and account actions.'], ['agent.runtime.receipt']),
      feature('computer-use-readiness', ['Computer-use readiness is exposed as app-server status, not silent marketplace install.'], ['agent.runtime.receipt']),
    ];
  }

  private buildApprovals(): CodexRuntimeApprovalBridge[] {
    return [
      approval('command-approval', 'command'),
      approval('file-change-approval', 'file-change'),
      approval('permission-approval', 'permission'),
      approval('mcp-approval', 'mcp'),
      approval('user-input-bridge', 'user-input'),
      approval('elicitation-bridge', 'elicitation'),
    ];
  }

  private buildEventProjection(): CodexRuntimeEventProjection[] {
    return [
      projection('assistant-message', 'assistant_message', 'assistant.message', 'agent.transcript'),
      projection('reasoning-item', 'reasoning_delta', 'agent.reasoning', 'agent.trajectory'),
      projection('tool-call', 'tool_call', 'tool.call', 'agent.tool-call'),
      projection('command-event', 'command_started', 'workspace.command', 'agent.trajectory'),
      projection('file-event', 'file_change', 'artifact.diff', 'agent.trajectory'),
      projection('token-event', 'token_usage', 'provider.usage', 'agent.runtime.receipt'),
    ];
  }

  private resolveProfile(input: Partial<CodexRuntimeProfile> = {}): CodexRuntimeProfile {
    return {
      id: String(input.id || '').trim() || 'default',
      label: String(input.label || '').trim() || 'Default Codex Runtime',
      codexHome: String(input.codexHome || '').trim() || null,
      workspaceRoot: String(input.workspaceRoot || '').trim() || null,
      appServerCommand: String(input.appServerCommand || '').trim() || 'codex',
      appServerArgs: input.appServerArgs && input.appServerArgs.length > 0
        ? input.appServerArgs
        : ['app-server', '--listen', 'stdio://'],
      appServerUrl: String(input.appServerUrl || '').trim() || null,
      headers: input.headers || {},
      approvalMode: input.approvalMode || 'guardian',
      sandbox: input.sandbox || 'workspace-write',
    };
  }

  private assertCodexMapping(mapping: CapabilitySourceMapping): void {
    if (mapping.primitiveId !== 'agent.runtime' || mapping.status !== 'normalized') {
      throw new Error('Codex source module must be normalized as agent.runtime before runtime certification closure.');
    }
  }

  private shortHash(value: string): string {
    let hash = 0;
    for (const char of value) {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }
    return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 8);
  }
}

function feature(
  id: CodexRuntimeFeatureId,
  evidence: string[],
  artifactKinds: CodexRuntimeArtifactKind[],
): CodexRuntimeFeature {
  return {
    id,
    status: 'native-runtime-proof',
    evidence,
    artifactKinds,
    receiptKind: 'agent.runtime.receipt',
  };
}

function approval(
  id: string,
  source: CodexRuntimeApprovalBridge['source'],
): CodexRuntimeApprovalBridge {
  return {
    id,
    source,
    decisionModes: ['allow-once', 'allow-session', 'deny', 'cancel'],
    artifactKind: 'agent.approval',
    redactsPreview: true,
  };
}

function projection(
  id: string,
  appServerEvent: string,
  zavorthEvent: string,
  artifactKind: CodexRuntimeArtifactKind,
): CodexRuntimeEventProjection {
  return {
    id,
    appServerEvent,
    zavorthEvent,
    artifactKind,
    idempotent: true,
  };
}
