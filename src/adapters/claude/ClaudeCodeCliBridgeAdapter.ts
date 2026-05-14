import type {
  SourceAgentRuntimeBridgeReadiness,
  SourceAgentRuntimePackageEvidence,
} from '../../contracts/SourceAgentRuntimeBridgeContract.js';

export type ClaudeCodeCliBridgeAdapterOptions = {
  enabledByEnv?: boolean;
  packageEvidence?: SourceAgentRuntimePackageEvidence[];
};

export class ClaudeCodeCliBridgeAdapter {
  public buildReadiness(options: ClaudeCodeCliBridgeAdapterOptions = {}): SourceAgentRuntimeBridgeReadiness {
    const hasSourceUsage = Boolean(
      options.packageEvidence?.find((evidence) =>
        evidence.packageName === '@anthropic-ai/claude-code'
        && evidence.directness !== 'not-present',
      ),
    );

    return {
      bridgeId: 'claude-code-cli',
      status: hasSourceUsage ? 'owner_decision_required' : 'missing',
      decision: 'optional-bridge-owner-gated',
      usageKind: 'claude-code-cli-backend',
      packages: ['@anthropic-ai/claude-code'],
      enabledByDefault: false,
      enabledByEnv: options.enabledByEnv === true,
      liveExecutionPerformed: false,
      dryRunAvailable: true,
      requiresOwnerApproval: true,
      activationEnvVars: [
        'ZAVORTH_CLAUDE_CODE_CLI_BRIDGE_ENABLED=true',
        'ZAVORTH_CLAUDE_CODE_CLI_CWD',
        'ZAVORTH_CLAUDE_CODE_CLI_WORKSPACE_ROOTS',
      ],
      cwdPolicy: {
        controlledCwdRequired: true,
        workspaceRootsRequired: true,
      },
      toolPolicy: {
        zavorthPolicyRequired: true,
        canUseToolRequired: true,
        approvalRequiredForWritesAndShell: true,
        bypassPermissionsAllowed: false,
      },
      artifactReceipts: {
        required: true,
        kinds: [
          'agent-runtime.bridge.plan',
          'agent-runtime.bridge.policy-decision',
          'agent-runtime.bridge.execution-receipt',
        ],
      },
      reason: hasSourceUsage
        ? 'Source has a Claude Code CLI backend; Zavorth keeps it as an owner-gated bridge instead of enabling CLI execution by default.'
        : 'Claude Code CLI usage was not found in the scanned Source checkout.',
    };
  }
}
